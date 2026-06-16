import {redis} from '../lib/redis.js';
import {cors, clientIp, jsonBody} from '../lib/http.js';
import * as C from '../lib/scores.js';

// /api/scores
//   GET  ?limit=100        -> ranking (nome + dinheiro), maior primeiro
//   POST {name,money,token}-> envia um score (validado), guarda o MELHOR por nome
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method === 'GET') return getBoard(req, res);
  if (req.method === 'POST') return submit(req, res);
  res.status(405).json({error: 'method_not_allowed'});
}

async function getBoard(req, res) {
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(limit)) limit = 100;
  limit = Math.min(Math.max(limit, 1), 100);

  // sorted set em ordem decrescente, com os scores
  const raw = await redis.zrange(C.LEADERBOARD_KEY, 0, limit - 1, {rev: true, withScores: true});
  const entries = [];
  for (let i = 0; i < raw.length; i += 2)
    entries.push({rank: entries.length + 1, name: String(raw[i]), money: Number(raw[i + 1])});
  // total de jogadores no ranking (cardinalidade do sorted set), pra exibir na tela inicial
  const total = await redis.zcard(C.LEADERBOARD_KEY);
  res.status(200).json({entries, total: Number(total) || 0});
}

async function submit(req, res) {
  const body = jsonBody(req);
  const name = C.sanitizeName(body.name);
  const money = Number(body.money);
  const token = typeof body.token === 'string' ? body.token : '';
  const pid = C.sanitizePid(body.pid); // id estável do cliente (save por jogador)

  // 1) validação básica do payload
  if (!name) return res.status(400).json({error: 'invalid_name'});
  if (!Number.isInteger(money) || money < 0 || money > C.MONEY_HARD_CAP)
    return res.status(400).json({error: 'invalid_money'});
  if (!token) return res.status(400).json({error: 'missing_token'});

  // 2) rate-limit por IP (incr + expire na primeira ocorrência da janela)
  const rlKey = C.RL_PREFIX + clientIp(req);
  const hits = await redis.incr(rlKey);
  if (hits === 1) await redis.expire(rlKey, C.RL_WINDOW);
  if (hits > C.RL_MAX) return res.status(429).json({error: 'rate_limited'});

  // 3) sessão: precisa existir (não expirada). O token continua válido durante
  //    toda a run (não é consumido), pra permitir enviar o melhor score várias
  //    vezes ao longo da partida. A segurança fica no teto de plausibilidade
  //    por tempo (abaixo) + rate-limit por IP + GT (só melhora).
  const sess = C.parseSession(await redis.get(C.SESSION_PREFIX + token));
  if (!sess || !sess.at) return res.status(403).json({error: 'invalid_session'});
  const seconds = (Date.now() - sess.at) / 1000;
  if (seconds < C.MIN_RUN_SECONDS) return res.status(403).json({error: 'run_too_short'});

  // 4) plausibilidade: dinheiro não pode passar do teto pelo tempo de partida,
  //    SOMADO ao saldo restaurado no início (sess.base) — quem volta rico pode
  //    reenviar o que já estava salvo sem cair no teto por tempo.
  const maxAllowed = C.maxPlausibleMoney(seconds) + sess.base;
  if (money > maxAllowed)
    return res.status(422).json({error: 'implausible_score', maxAllowed: Math.floor(maxAllowed)});

  // 5) guarda só se for melhor que o recorde atual do nome (GT)
  await redis.zadd(C.LEADERBOARD_KEY, {gt: true}, {score: money, member: name});
  // 6) salva o progresso por (id, nick) — restaurado no próximo /api/session.
  //    Também só sobe (GT), então o save acompanha o melhor saldo do jogador.
  if (pid) await redis.zadd(C.SAVE_KEY, {gt: true}, {score: money, member: C.saveMember(pid, name)});
  const rank = await redis.zrevrank(C.LEADERBOARD_KEY, name);
  res.status(200).json({ok: true, name, money, rank: rank == null ? null : rank + 1});
}
