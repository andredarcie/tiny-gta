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

  // 4) teto de plausibilidade: dinheiro não passa do que cabe pelo tempo de
  //    partida, SOMADO ao saldo restaurado no início (sess.base) — quem volta
  //    rico reenvia o que já estava salvo sem cair no teto por tempo.
  const maxAllowed = C.maxPlausibleMoney(seconds) + sess.base;

  // 5) save por (id, nick): grava SEMPRE (mesmo que o pico abaixo seja barrado),
  //    com o dinheiro cravado no teto. Assim o progresso (saldo ATUAL + itens)
  //    não fica refém de um pico momentaneamente alto: o jogador que sai no meio
  //    não perde o que fez. Inflar o save só afeta o jogo privado do dono — o
  //    crava no teto impede usar a base pra furar o ranking na sessão seguinte.
  if (pid && body.save) {
    const blob = C.sanitizeSave(body.save, maxAllowed);
    if (blob) {
      await redis.set(C.SAVE_PREFIX + C.saveMember(pid, name), blob);
      // o jogador agora tem save de verdade: consome o seed de migração do nome
      // (idempotente; só faz algo na primeira gravação de cada nome semeado).
      await redis.hdel(C.SEED_KEY, name);
    }
  }

  // 6) leaderboard = DINHEIRO ATUAL do jogador (não mais o pico): grava o valor
  //    recebido por nome, SEM GT — quem gasta cai no ranking, quem acumula sobe.
  //    Continua barrado pela plausibilidade (não dá pra forjar um salto). O 422
  //    faz o cliente reagendar e reenviar quando o teto cresce.
  if (money > maxAllowed)
    return res.status(422).json({error: 'implausible_score', maxAllowed: Math.floor(maxAllowed)});
  await redis.zadd(C.LEADERBOARD_KEY, {score: money, member: name});
  const rank = await redis.zrevrank(C.LEADERBOARD_KEY, name);
  res.status(200).json({ok: true, name, money, rank: rank == null ? null : rank + 1});
}
