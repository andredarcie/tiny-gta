import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../lib/redis.js';
import { cors, clientIp, jsonBody, sendError, safe } from '../lib/http.js';
import { scoreSig, safeEqualHex } from '../lib/auth.js';
import * as C from '../lib/scores.js';

// /api/scores
//   GET  ?limit=100        -> ranking (nome + dinheiro), maior primeiro
//   POST {name,money,token}-> envia um score (validado), guarda o MELHOR por nome
async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (cors(req, res)) return;
  if (req.method === 'GET') return getBoard(req, res);
  if (req.method === 'POST') return submit(req, res);
  sendError(res, 405, 'method_not_allowed');
}

async function getBoard(req: VercelRequest, res: VercelResponse): Promise<void> {
  let limit = parseInt(String(req.query.limit), 10);
  if (!Number.isFinite(limit)) limit = 100;
  limit = Math.min(Math.max(limit, 1), 100);

  // sorted set em ordem decrescente, com os scores
  const raw = await redis.zrange<(string | number)[]>(C.LEADERBOARD_KEY, 0, limit - 1, { rev: true, withScores: true });
  const entries: Array<{ rank: number; name: string; money: number }> = [];
  for (let i = 0; i < raw.length; i += 2)
    entries.push({ rank: entries.length + 1, name: String(raw[i]), money: Number(raw[i + 1]) });
  // total de jogadores no ranking (cardinalidade do sorted set), pra exibir na tela inicial
  const total = await redis.zcard(C.LEADERBOARD_KEY);
  res.status(200).json({ entries, total: Number(total) || 0 });
}

async function submit(req: VercelRequest, res: VercelResponse): Promise<void> {
  const body = jsonBody(req);
  const name = C.sanitizeName(body.name);
  const money = Math.floor(Number(body.money));
  const token = typeof body.token === 'string' ? body.token : '';
  const pid = C.sanitizePid(body.pid); // id estável do cliente (save por jogador)

  // 1) validação básica do payload. O dinheiro só precisa ser um número inteiro
  //    não-negativo: passar do TETO DURO não rejeita mais a requisição (senão um
  //    save legítimo acima do teto deixava de persistir pra sempre) — o teto é
  //    aplicado só ao número do RANKING, lá embaixo.
  if (!name) return sendError(res, 400, 'invalid_name');
  if (!Number.isFinite(money) || money < 0) return sendError(res, 400, 'invalid_money');
  if (!token) return sendError(res, 400, 'missing_token');

  // 2) rate-limit por IP (incr + expire na primeira ocorrência da janela)
  const rlKey = C.RL_PREFIX + clientIp(req);
  const hits = await redis.incr(rlKey);
  if (hits === 1) await redis.expire(rlKey, C.RL_WINDOW);
  if (hits > C.RL_MAX) return sendError(res, 429, 'rate_limited');

  // 3) sessão: precisa existir (não expirada). O token continua válido durante
  //    toda a run (não é consumido), pra permitir enviar o melhor score várias
  //    vezes ao longo da partida. A segurança fica no teto de plausibilidade
  //    por tempo (abaixo) + rate-limit por IP + GT (só melhora).
  const sess = C.parseSession(await redis.get(C.SESSION_PREFIX + token));
  if (!sess || !sess.at) return sendError(res, 403, 'invalid_session');
  // 3b) o token vale só para a identidade que o emitiu: impede usar um token
  //     (próprio ou copiado via devtools/cURL) para gravar/sobrescrever o nome de
  //     outro jogador. Sessões antigas sem identidade (pid/name null) não exigem.
  if (sess.name && sess.name !== name) return sendError(res, 403, 'session_mismatch');
  if (sess.pid && pid && sess.pid !== pid) return sendError(res, 403, 'session_mismatch');

  // 3c) ASSINATURA anti-adulteração: o envio tem que vir assinado (HMAC money.t)
  //     com o segredo da sessão. Um payload editado na aba Network sem re-assinar
  //     (precisa do segredo) é rejeitado. Sessões antigas sem segredo (rollout) e
  //     REQUIRE_SIG=0 pulam a checagem — ver lib/scores.REQUIRE_SIG.
  if (sess.secret && C.REQUIRE_SIG) {
    const tSig = Number(body.t) || 0;
    const sig = typeof body.sig === 'string' ? body.sig : '';
    if (!safeEqualHex(sig, scoreSig(sess.secret, money, tSig))) return sendError(res, 403, 'bad_signature');
  }
  const seconds = (Date.now() - sess.at) / 1000;

  // 4) teto de plausibilidade: dinheiro não passa do que cabe pelo tempo de
  //    partida, SOMADO ao saldo restaurado no início (sess.base) — quem volta
  //    rico reenvia o que já estava salvo sem cair no teto por tempo.
  const maxAllowed = C.maxPlausibleMoney(seconds) + sess.base;

  // 5) SAVE (progresso privado: saldo ATUAL + itens) — grava ANTES dos gates do
  //    ranking. O blob é cravado no teto por sanitizeSave (não dá pra inflar),
  //    então NEM partida curta (run_too_short) NEM o teto do ranking podem
  //    DESTRUIR o progresso do dono. Chave nova = só pid (trocar de apelido não
  //    perde mais o save). Inflar o save só afeta o jogo privado do dono — o
  //    crava no teto impede usar a base pra furar o ranking na sessão seguinte.
  if (pid && body.save) {
    const blob = C.sanitizeSave(body.save, maxAllowed);
    if (blob) {
      // carimba o nick AUTORITATIVO (depois do sanitize, pra não ser truncado):
      // a chave é só o pid, então é isto que deixa a ferramenta de manutenção
      // (scripts/cleanup.ts) achar/remover o save de um nome. `blob.t` (carimbo
      // de tempo do cliente) sobrevive ao sanitize e serve à reconciliação local.
      blob.name = name;
      await redis.set(C.saveKey(pid), blob);
      // o jogador agora tem save de verdade: consome o seed de migração do nome
      // (idempotente; só faz algo na primeira gravação de cada nome semeado).
      await redis.hdel(C.SEED_KEY, name);
    }
  }

  // 6) gates do RANKING (não afetam mais o save acima):
  //    partida curta demais não publica score (anti-forja), mas o save já foi
  //    gravado — o cliente reenvia depois (o 403 faz reagendar) e aí entra no board.
  if (seconds < C.MIN_RUN_SECONDS) return sendError(res, 403, 'run_too_short');

  // 7) leaderboard = DINHEIRO ATUAL do jogador (não mais o pico): grava o valor
  //    recebido por nome, SEM GT — quem gasta cai no ranking, quem acumula sobe.
  //    O valor é CRAVADO no teto duro (em vez de rejeitar a requisição): quem
  //    passa do teto continua salvando e só não infla o board. Continua barrado
  //    pela plausibilidade por tempo (422 faz o cliente reagendar quando cresce).
  const lbMoney = Math.min(money, C.MONEY_HARD_CAP);
  if (lbMoney > maxAllowed)
    return void res.status(422).json({ error: 'implausible_score', maxAllowed: Math.floor(maxAllowed) });
  await redis.zadd(C.LEADERBOARD_KEY, { score: lbMoney, member: name });
  const rank = await redis.zrevrank(C.LEADERBOARD_KEY, name);
  res.status(200).json({ ok: true, name, money: lbMoney, rank: rank == null ? null : rank + 1 });
}

export default safe(handler);
