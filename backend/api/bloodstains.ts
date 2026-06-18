import { randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../lib/redis.js';
import { cors, clientIp, jsonBody, sendError, safe } from '../lib/http.js';
import { bloodstainSig, safeEqualHex } from '../lib/auth.js';
import * as C from '../lib/scores.js';

// /api/bloodstains — MULTIPLAYER ASSÍNCRONO estilo Demon's Souls / Dark Souls.
//
//   GET  ?pid=<meu>&limit=120
//        -> poças de morte ATIVAS de todos os jogadores ({id,name,x,z,money,at}).
//           `own:true` marca a poça do próprio jogador (o cliente a esconde — não dá
//           pra coletar a própria). pid de terceiros NUNCA sai na resposta.
//   POST {action:'create', token,pid,name,x,z,money,t,sig}
//        -> registra a poça no lugar da morte; money = dinheiro perdido na morte
//           (a "conta do hospital"), clampado ao BLOODSTAIN_MAX.
//   POST {action:'claim',  token,pid,id}
//        -> COLETA: GETDEL ATÔMICO na chave da poça — só o PRIMEIRO a deletar leva o
//           dinheiro (vencedor único garantido pelo Redis). O cliente credita o valor
//           localmente (economy.earn 'bloodstain'); o flush normal reflete no ledger.

type Stain = { name: string; x: number; z: number; money: number; pid: string; at: number };

// Normaliza o valor lido do Redis (objeto JSON do @upstash/redis, ou string) numa
// poça válida, ou null quando ausente/corrompida (ex.: expirou pelo TTL).
function parseStain(raw: unknown): Stain | null {
  let o: unknown = raw;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { return null; } }
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name : '';
  const x = Number(r.x), z = Number(r.z), money = Math.floor(Number(r.money));
  if (!name || !Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(money)) return null;
  return { name, x, z, money: Math.max(0, money), pid: typeof r.pid === 'string' ? r.pid : '', at: Number(r.at) || 0 };
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (cors(req, res)) return;
  if (req.method === 'GET') return list(req, res);
  if (req.method === 'POST') {
    const body = jsonBody(req);
    const action = typeof body.action === 'string' ? body.action : '';
    if (action === 'create') return create(req, res, body);
    if (action === 'claim') return claim(req, res, body);
    return sendError(res, 400, 'bad_request');
  }
  sendError(res, 405, 'method_not_allowed');
}

// GET — lista as poças ativas (mais novas primeiro). Faz poda preguiçosa: ids cujo
// blob já expirou (TTL) saem do índice aqui.
async function list(req: VercelRequest, res: VercelResponse): Promise<void> {
  const myPid = C.sanitizePid(req.query.pid);
  let limit = parseInt(String(req.query.limit), 10);
  if (!Number.isFinite(limit)) limit = C.BLOODSTAIN_RETURN;
  limit = Math.min(Math.max(limit, 1), C.BLOODSTAIN_RETURN);

  const ids = await redis.zrange<string[]>(C.BLOODSTAIN_INDEX, 0, limit - 1, { rev: true });
  if (!ids.length) return void res.status(200).json({ stains: [] });

  const raw = await redis.mget<unknown[]>(...ids.map(C.bloodstainKey));
  const stains: Array<{ id: string; name: string; x: number; z: number; money: number; at: number; own: boolean }> = [];
  const stale: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!id) continue;
    const s = parseStain(raw[i]);
    if (!s) { stale.push(id); continue; } // expirou: limpa do índice
    stains.push({ id, name: s.name, x: s.x, z: s.z, money: s.money, at: s.at, own: !!myPid && s.pid === myPid });
  }
  if (stale.length) await redis.zrem(C.BLOODSTAIN_INDEX, ...stale);
  res.status(200).json({ stains });
}

// POST create — registra a poça no lugar da morte.
async function create(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const token = typeof body.token === 'string' ? body.token : '';
  const pid = C.sanitizePid(body.pid);
  const name = C.sanitizeName(body.name);
  const x = Number(body.x), z = Number(body.z);
  const money = Math.floor(Number(body.money));
  if (!token) return sendError(res, 400, 'missing_token');
  if (!pid || !name) return sendError(res, 400, 'invalid_identity');
  if (!Number.isFinite(x) || !Number.isFinite(z)) return sendError(res, 400, 'invalid_pos');
  if (!Number.isFinite(money) || money <= 0) return sendError(res, 400, 'invalid_money');

  // rate-limit por IP (morrer é raro; trava criação em massa de poças)
  const rlKey = C.BLOODSTAIN_RL_PREFIX + clientIp(req);
  const hits = await redis.incr(rlKey);
  if (hits === 1) await redis.expire(rlKey, C.RL_WINDOW);
  if (hits > C.RL_MAX) return sendError(res, 429, 'rate_limited');

  // sessão válida + amarrada à identidade (igual aos outros endpoints)
  const sess = C.parseSession(await redis.get(C.SESSION_PREFIX + token));
  if (!sess || !sess.at) return sendError(res, 403, 'invalid_session');
  if (sess.pid && sess.pid !== pid) return sendError(res, 403, 'session_mismatch');
  if (sess.name && sess.name !== name) return sendError(res, 403, 'session_mismatch');

  // assinatura anti-adulteração (x.z.money.t): barra editar o valor na aba Network.
  if (sess.secret && C.REQUIRE_SIG) {
    const tSig = Number(body.t) || 0;
    const sig = typeof body.sig === 'string' ? body.sig : '';
    if (!safeEqualHex(sig, bloodstainSig(sess.secret, x, z, money, tSig))) return sendError(res, 403, 'bad_signature');
  }

  // clampa o dinheiro ao teto da poça e a posição aos limites do mundo
  const m = Math.min(money, C.BLOODSTAIN_MAX);
  const cx = Math.max(-C.BLOODSTAIN_COORD, Math.min(C.BLOODSTAIN_COORD, x));
  const cz = Math.max(-C.BLOODSTAIN_COORD, Math.min(C.BLOODSTAIN_COORD, z));
  const at = Date.now();
  // id CURTO (base36 do tempo + 6 hex aleatórios): cabe no charset/limite do id de tx
  // do cliente, então a coleta vira uma tx 'bloodstain' com id estável (idempotente).
  const id = at.toString(36) + randomBytes(3).toString('hex');
  const stain: Stain = { name, x: cx, z: cz, money: m, pid, at };
  await redis.set(C.bloodstainKey(id), stain, { ex: C.BLOODSTAIN_TTL });
  await redis.zadd(C.BLOODSTAIN_INDEX, { score: at, member: id });

  // poda o índice: mantém só as BLOODSTAIN_KEEP mais novas; apaga as podadas (o blob
  // some sozinho pelo TTL, mas remover já evita listar id morto).
  const card = Number(await redis.zcard(C.BLOODSTAIN_INDEX));
  if (card > C.BLOODSTAIN_KEEP) {
    const drop = await redis.zrange<string[]>(C.BLOODSTAIN_INDEX, 0, card - C.BLOODSTAIN_KEEP - 1);
    if (drop.length) {
      await redis.zrem(C.BLOODSTAIN_INDEX, ...drop);
      await redis.del(...drop.map(C.bloodstainKey));
    }
  }
  res.status(200).json({ ok: true, id });
}

// POST claim — coleta atômica (GETDEL). Só o primeiro a deletar leva o dinheiro.
async function claim(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const token = typeof body.token === 'string' ? body.token : '';
  const pid = C.sanitizePid(body.pid);
  const id = typeof body.id === 'string' ? body.id : '';
  if (!token) return sendError(res, 400, 'missing_token');
  if (!pid) return sendError(res, 400, 'invalid_identity');
  if (!/^[a-z0-9]{1,40}$/.test(id)) return sendError(res, 400, 'invalid_id');

  // sessão válida (qualquer jogador logado pode coletar)
  const sess = C.parseSession(await redis.get(C.SESSION_PREFIX + token));
  if (!sess || !sess.at) return sendError(res, 403, 'invalid_session');
  if (sess.pid && sess.pid !== pid) return sendError(res, 403, 'session_mismatch');

  // COLETA ATÔMICA: GETDEL — dois jogadores em cima da poça? Um recebe o objeto, o
  // outro recebe null. Sem corrida, sem pagar duas vezes.
  const raw = await redis.getdel(C.bloodstainKey(id));
  await redis.zrem(C.BLOODSTAIN_INDEX, id); // tira do índice (já foi / não existe mais)
  const stain = parseStain(raw);
  if (!stain) return void res.status(200).json({ ok: true, claimed: false }); // alguém pegou antes / expirou
  if (stain.pid === pid) return void res.status(200).json({ ok: true, claimed: false }); // própria poça: não paga
  res.status(200).json({ ok: true, claimed: true, money: Math.min(stain.money, C.BLOODSTAIN_MAX), name: stain.name });
}

export default safe(handler);
