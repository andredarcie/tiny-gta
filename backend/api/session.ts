import { randomUUID, randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../lib/redis.js';
import { cors, clientIp, jsonBody, sendError, safe } from '../lib/http.js';
import * as C from '../lib/scores.js';

// POST /api/session  (body opcional {pid, name})
// O jogo chama isto ao INICIAR uma partida. Devolve um token de sessão único e
// de vida curta (exigido no envio do score, dificulta replay/spam e dá ao
// servidor a duração real da partida para a checagem de plausibilidade) e —
// quando o cliente manda sua identidade (id estável + nick) — o SAVE do jogador
// (dinheiro atual + armas + músculo + casa + coletáveis), para continuar de onde
// parou. O dinheiro salvo vira a "base" da sessão, que o /api/scores soma ao
// teto de plausibilidade.
async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');

  // rate-limit da criação de token (por IP confiável): um jogador legítimo abre
  // ~1 sessão por partida; isto trava o mint em massa de tokens para fabricar
  // dinheiro no teto por tempo e o abuso de escrita/custo no Redis.
  const rlKey = C.SESS_RL_PREFIX + clientIp(req);
  const hits = await redis.incr(rlKey);
  if (hits === 1) await redis.expire(rlKey, C.RL_WINDOW);
  if (hits > C.RL_MAX) return sendError(res, 429, 'rate_limited');

  // identidade opcional: restaura o progresso só quando id + nick batem
  const body = jsonBody(req);
  const pid = C.sanitizePid(body.pid);
  const name = C.sanitizeName(body.name);
  let save: C.SaveBlob | null = null;
  if (pid && name) {
    const member = C.saveMember(pid, name);
    // 1) chave nova (só pid). 2) fallback p/ chave antiga (pid|nick): cobre o
    //    deploy e quem trocou de apelido — o save é re-gravado na chave nova no
    //    próximo flush (ver /api/scores). 3) sorted set só-dinheiro. 4) seed.
    let blob = await redis.get<C.SaveBlob>(C.saveKey(pid));
    if (!(blob && typeof blob === 'object')) blob = await redis.get<C.SaveBlob>(C.SAVE_PREFIX + member);
    if (blob && typeof blob === 'object') save = blob;
    else {
      // migração: jogadores que só têm o save antigo (sorted set só-dinheiro)
      const legacy = await redis.zscore(C.SAVE_LEGACY_KEY, member);
      if (legacy != null) save = { money: Math.max(0, Math.floor(Number(legacy) || 0)) };
      else {
        // jogador antigo SEM save: herda UMA vez o valor do ranking (pico->atual)
        // como saldo inicial. NÃO consome aqui (pra sobreviver a uma sessão que
        // não chega a salvar) — o /api/scores apaga o seed ao gravar o save.
        const seed = await redis.hget(C.SEED_KEY, name);
        if (seed != null) save = { money: Math.max(0, Math.floor(Number(seed) || 0)) };
      }
    }
  }
  const money = save && Number.isFinite(save.money) ? Math.max(0, Math.floor(save.money)) : 0;

  const token = randomUUID();
  const startedAt = Date.now();
  // segredo por sessão: o cliente assina o envio de score com ele (HMAC) e o
  // /api/scores valida — encarece editar/forjar o payload via devtools. Fica no
  // registro da sessão (servidor) e é devolvido UMA vez ao dono da sessão.
  const secret = randomBytes(16).toString('hex');
  // Grava a identidade (pid+nick) junto do token: o /api/scores e o /api/minigame
  // exigem que o envio bata com isto, então um token (próprio ou copiado de outra
  // aba/cURL) não consegue gravar/sobrescrever o nome de OUTRO jogador no ranking.
  const sess: C.SessionData = { at: startedAt, base: money, pid: pid || null, name: name || null, secret };
  await redis.set(C.SESSION_PREFIX + token, sess, { ex: C.SESSION_TTL });
  res.status(200).json({ token, startedAt, money, save, secret });
}

export default safe(handler);
