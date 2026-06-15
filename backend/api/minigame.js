import {redis} from '../lib/redis.js';
import {cors, clientIp, jsonBody} from '../lib/http.js';
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
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method === 'GET') return getBoard(req, res);
  if (req.method === 'POST') return submit(req, res);
  res.status(405).json({error: 'method_not_allowed'});
}

async function getBoard(req, res) {
  const game = C.sanitizeGame(req.query.game);
  if (!game) return res.status(400).json({error: 'invalid_game'});

  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(limit)) limit = 5;
  limit = Math.min(Math.max(limit, 1), 100);

  // sorted set decrescente: os maiores ratings primeiro
  const raw = await redis.zrange(C.mgBoardKey(game), 0, limit - 1, {rev: true, withScores: true});
  const names = [];
  for (let i = 0; i < raw.length; i += 2) names.push({name: String(raw[i]), rating: Number(raw[i + 1])});

  // anexa os acumulados de cada um (top 5 = poucas leituras) pro HUD dar contexto
  const stats = await Promise.all(names.map(n => redis.hgetall(C.mgPlayerKey(game, n.name))));
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
  res.status(200).json({game, entries});
}

async function submit(req, res) {
  const body = jsonBody(req);
  const game = C.sanitizeGame(body.game);
  const name = C.sanitizeName(body.name);
  const score = Number(body.score);
  const won = body.won ? 1 : 0;
  const token = typeof body.token === 'string' ? body.token : '';

  // 1) validação do payload
  if (!game) return res.status(400).json({error: 'invalid_game'});
  if (!name) return res.status(400).json({error: 'invalid_name'});
  if (!Number.isInteger(score) || score < 0 || score > C.MG_SCORE_CAP)
    return res.status(400).json({error: 'invalid_score'});
  if (!token) return res.status(400).json({error: 'missing_token'});

  // 2) rate-limit por IP (chave própria dos mini games)
  const rlKey = C.MG_RL_PREFIX + clientIp(req);
  const hits = await redis.incr(rlKey);
  if (hits === 1) await redis.expire(rlKey, C.RL_WINDOW);
  if (hits > C.RL_MAX) return res.status(429).json({error: 'rate_limited'});

  // 3) sessão precisa existir (mesmo token da run global). Não exige duração mínima:
  //    um resultado de mini game é enviado durante a partida, não no fim dela.
  const startedAtRaw = await redis.get(C.SESSION_PREFIX + token);
  if (startedAtRaw == null) return res.status(403).json({error: 'invalid_session'});

  // 4) acumula os crus do jogador neste jogo (HINCRBY soma sessão a sessão)
  const pKey = C.mgPlayerKey(game, name);
  await redis.hincrby(pKey, 'plays', 1);
  await redis.hincrby(pKey, 'wins', won);
  await redis.hincrby(pKey, 'losses', 1 - won);
  if (score > 0) await redis.hincrby(pKey, 'earned', score);
  const h = (await redis.hgetall(pKey)) || {};
  const prevBest = Number(h.best) || 0;
  if (score > prevBest) await redis.hset(pKey, {best: score});

  // 5) recomputa o rating justo e regrava no sorted set do jogo
  const stats = {
    plays: Number(h.plays) || 0,
    wins: Number(h.wins) || 0,
    losses: Number(h.losses) || 0,
    earned: Number(h.earned) || 0,
    best: Math.max(prevBest, score),
  };
  const rating = C.miniGameRating(stats);
  await redis.zadd(C.mgBoardKey(game), {score: rating, member: name});
  const rank = await redis.zrevrank(C.mgBoardKey(game), name);
  res.status(200).json({ok: true, game, name, rating, rank: rank == null ? null : rank + 1, stats});
}
