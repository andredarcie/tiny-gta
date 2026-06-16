import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../lib/redis.js';
import { cors, clientIp, jsonBody, sendError, safe } from '../lib/http.js';
import { mgSig, safeEqualHex } from '../lib/auth.js';
import * as C from '../lib/scores.js';

// /api/minigame  — ranking POR MINI GAME (top 5 de cada um).
//   GET  ?game=taxi&limit=5
//        -> top do mini game pedido, com o rating e os acumulados (plays/wins/earned)
//   POST {game,name,won,score,token}
//        -> registra UMA sessão concluída do mini game; acumula os crus do jogador,
//           recomputa o rating justo (ver lib/scores.miniGameRating) e devolve o rank.
//
// O `game` identifica qual mini game (enum MiniGameId no front). Cada mini game tem
// o seu sorted set + hashes próprios, então as escalas (dinheiro x kills x resgates)
// nunca se misturam entre rankings.
async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (cors(req, res)) return;
  if (req.method === 'GET') return getBoard(req, res);
  if (req.method === 'POST') return submit(req, res);
  sendError(res, 405, 'method_not_allowed');
}

async function getBoard(req: VercelRequest, res: VercelResponse): Promise<void> {
  const game = C.sanitizeGame(req.query.game);
  if (!game) return sendError(res, 400, 'invalid_game');

  let limit = parseInt(String(req.query.limit), 10);
  if (!Number.isFinite(limit)) limit = 5;
  limit = Math.min(Math.max(limit, 1), 100);

  // sorted set decrescente: os maiores ratings primeiro
  const raw = await redis.zrange<(string | number)[]>(C.mgBoardKey(game), 0, limit - 1, { rev: true, withScores: true });
  const names: Array<{ name: string; rating: number }> = [];
  for (let i = 0; i < raw.length; i += 2) names.push({ name: String(raw[i]), rating: Number(raw[i + 1]) });

  // anexa os acumulados de cada um (top 5 = poucas leituras) pro HUD dar contexto
  const stats = await Promise.all(names.map(n => redis.hgetall<Record<string, unknown>>(C.mgPlayerKey(game, n.name))));
  const entries = names.map((n, i) => {
    const h = stats[i] || {};
    return {
      rank: i + 1,
      name: n.name,
      rating: n.rating,
      plays: Number(h.plays) || 0,
      wins: Number(h.wins) || 0,
      earned: Number(h.earned) || 0,
      best: Number(h.best) || 0,
    };
  });
  res.status(200).json({ game, entries });
}

async function submit(req: VercelRequest, res: VercelResponse): Promise<void> {
  const body = jsonBody(req);
  const game = C.sanitizeGame(body.game);
  const name = C.sanitizeName(body.name);
  const score = Number(body.score);
  const won = body.won ? 1 : 0;
  const token = typeof body.token === 'string' ? body.token : '';

  // 1) validação do payload
  if (!game) return sendError(res, 400, 'invalid_game');
  if (!name) return sendError(res, 400, 'invalid_name');
  if (!Number.isInteger(score) || score < 0 || score > C.MG_SCORE_CAP)
    return sendError(res, 400, 'invalid_score');
  if (!token) return sendError(res, 400, 'missing_token');

  // 2) rate-limit por IP (chave própria dos mini games)
  const rlKey = C.MG_RL_PREFIX + clientIp(req);
  const hits = await redis.incr(rlKey);
  if (hits === 1) await redis.expire(rlKey, C.RL_WINDOW);
  if (hits > C.RL_MAX) return sendError(res, 429, 'rate_limited');

  // 3) sessão precisa existir (mesmo token da run global). Não exige duração mínima:
  //    um resultado de mini game é enviado durante a partida, não no fim dela.
  //    O token é amarrado à identidade: o nome enviado tem que bater com o da
  //    sessão (token copiado não infla o ranking de minigame de outro nome).
  const sess = C.parseSession(await redis.get(C.SESSION_PREFIX + token));
  if (!sess || !sess.at) return sendError(res, 403, 'invalid_session');
  if (sess.name && sess.name !== name) return sendError(res, 403, 'session_mismatch');

  // 3b) ASSINATURA anti-adulteração (igual ao /api/scores): o resultado vem assinado
  //     (HMAC game.score.won.t) com o segredo da sessão. Editar na aba Network sem
  //     re-assinar (precisa do segredo) é rejeitado. Sessões sem segredo / REQUIRE_SIG=0 pulam.
  if (sess.secret && C.REQUIRE_SIG) {
    const tSig = Number(body.t) || 0;
    const sig = typeof body.sig === 'string' ? body.sig : '';
    if (!safeEqualHex(sig, mgSig(sess.secret, game, score, won, tSig))) return sendError(res, 403, 'bad_signature');
  }

  // 4) acumula os crus do jogador neste jogo (HINCRBY soma sessão a sessão)
  const pKey = C.mgPlayerKey(game, name);
  await redis.hincrby(pKey, 'plays', 1);
  await redis.hincrby(pKey, 'wins', won);
  await redis.hincrby(pKey, 'losses', 1 - won);
  if (score > 0) await redis.hincrby(pKey, 'earned', score);
  const h = (await redis.hgetall<Record<string, unknown>>(pKey)) || {};
  const prevBest = Number(h.best) || 0;
  if (score > prevBest) await redis.hset(pKey, { best: score });

  // 5) recomputa o rating justo e regrava no sorted set do jogo
  const stats: C.MiniGameStats = {
    plays: Number(h.plays) || 0,
    wins: Number(h.wins) || 0,
    losses: Number(h.losses) || 0,
    earned: Number(h.earned) || 0,
    best: Math.max(prevBest, score),
  };
  const rating = C.miniGameRating(stats);
  await redis.zadd(C.mgBoardKey(game), { score: rating, member: name });
  const rank = await redis.zrevrank(C.mgBoardKey(game), name);
  res.status(200).json({ ok: true, game, name, rating, rank: rank == null ? null : rank + 1, stats });
}

export default safe(handler);
