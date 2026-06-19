import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../lib/redis.js';
import { cors, jsonBody, sendError, safe } from '../lib/http.js';
import * as C from '../lib/scores.js';
import * as L from '../lib/ledger.js';

// /api/admin — painel do dono do jogo (read-only). SÓ a conta ADMIN_NAME (default
// 'REI') acessa: a checagem NÃO é pelo apelido (forjável no cliente), e sim pelo PID
// — o token de sessão é amarrado a um pid, e exigimos que esse pid SEJA o dono da
// conta admin (tinygta:acct:<ADMIN_NAME>.pid). Logo, só quem logou de fato na conta
// admin (senha) passa; alguém que só se renomeie "REI" cai no 403 not_admin.
//
// POST {token, pid, action, target?}
//   action 'players' -> lista {pid,name,money(ranking),bal(ledger)} de todo mundo
//   action 'txs'  {target:<pid>} -> {pid,bal,txs[]} (transações retidas do jogador)
//   action 'gift' {target:<pid>, amount, seed?} -> credita o jogador com uma tx
//                 'god_gift' (presente do dono). `seed` = dinheiro atual do jogador,
//                 usado pra semear o ledger se ele ainda não tem um (senão a sessão
//                 rebaseia no saldo só-do-presente e ele perderia o que tinha).
const ADMIN_NAME = C.sanitizeName(process.env.ADMIN_NAME || 'REI') || 'REI';

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');

  const body = jsonBody(req);
  const token = typeof body.token === 'string' ? body.token : '';
  const pid = C.sanitizePid(body.pid);
  if (!token || !pid) return sendError(res, 400, 'bad_request');

  // sessão válida + amarrada a este pid (mesmo gate dos outros endpoints)
  const sess = C.parseSession(await redis.get(C.SESSION_PREFIX + token));
  if (!sess || !sess.at) return sendError(res, 403, 'invalid_session');
  if (sess.pid && sess.pid !== pid) return sendError(res, 403, 'session_mismatch');

  // gate de ADMIN: o pid tem que ser o DONO da conta admin (autenticação por conta,
  // não por apelido). Sem conta admin cadastrada -> ninguém é admin.
  const acct = await redis.get<{ pid?: string }>(C.acctKey(ADMIN_NAME));
  if (!acct || acct.pid !== pid) return sendError(res, 403, 'not_admin');

  const action = typeof body.action === 'string' ? body.action : '';
  if (action === 'players') {
    return void res.status(200).json({ players: await listPlayers() });
  }
  if (action === 'txs') {
    const target = C.sanitizePid(body.target);
    if (!target) return sendError(res, 400, 'bad_target');
    const [bal, txs] = await Promise.all([L.readBalance(target), L.readLedgerTxs(target)]);
    return void res.status(200).json({ pid: target, bal, txs });
  }
  if (action === 'gift') {
    const target = C.sanitizePid(body.target);
    const amount = Math.floor(Number(body.amount));
    if (!target) return sendError(res, 400, 'bad_target');
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return sendError(res, 400, 'bad_amount');
    // Sem ledger ainda? Semeia ANTES de creditar, pra o presente SOMAR ao saldo em
    // vez de zerar o jogador (a sessão rebaseia o dinheiro no ledger). Usa o MAIOR
    // entre o `seed` do painel e o dinheiro do ranking lido no servidor — assim
    // NUNCA perde dinheiro, mesmo numa chamada direta à API sem `seed`. Idempotente.
    if (!(await L.readLedgerSnapshot(target))) {
      const seed = Math.max(0, Math.floor(Number(body.seed) || 0), await moneyForPid(target));
      if (seed > 0) await L.seedLedger(target, seed);
    }
    const id = 'gift-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const bal = await L.appendTxs(target, [{ id, amt: amount, t: Date.now(), why: 'god_gift' }]);
    return void res.status(200).json({ pid: target, bal });
  }
  sendError(res, 400, 'bad_action');
}

// Dinheiro atual (ranking) de um jogador pelo pid: lê o nome no save e o score do
// leaderboard. Usado pra semear o ledger num presente sem perder o que ele já tinha.
async function moneyForPid(pid: string): Promise<number> {
  const blob = await redis.get<{ name?: string }>(C.saveKey(pid));
  const name = blob && typeof blob.name === 'string' ? blob.name : null;
  if (!name) return 0;
  return Math.max(0, Math.floor(Number(await redis.zscore(C.LEADERBOARD_KEY, name)) || 0));
}

// Varre os save blobs pra mapear pid -> nome, e junta com o dinheiro do ranking e o
// saldo do ledger. (SCAN, nunca KEYS — chamada rara, só do admin.)
async function listPlayers(): Promise<Array<{ pid: string; name: string; money: number; bal: number }>> {
  const byPid = new Map<string, string>(); // pid -> name
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, { match: C.SAVE_PREFIX + '*', count: 200 });
    cursor = String(next);
    for (const key of keys) {
      const rest = key.slice(C.SAVE_PREFIX.length); // "<pid>" ou "<pid>|<name>"
      const pipe = rest.lastIndexOf('|');
      if (pipe >= 0) {
        const pid = rest.slice(0, pipe);
        if (!byPid.has(pid)) byPid.set(pid, rest.slice(pipe + 1)); // legado: nome no sufixo
      } else {
        const blob = await redis.get<{ name?: string }>(key);
        const name = blob && typeof blob === 'object' && typeof blob.name === 'string' ? blob.name : '?';
        byPid.set(rest, name); // chave por pid (atual): `rest` é o pid; é autoritativa pro nome
      }
    }
  } while (cursor !== '0');

  const players: Array<{ pid: string; name: string; money: number; bal: number }> = [];
  for (const [pid, name] of byPid) {
    const [score, bal] = await Promise.all([
      redis.zscore(C.LEADERBOARD_KEY, name),
      L.readBalance(pid),
    ]);
    players.push({ pid, name, money: Number(score) || 0, bal });
  }
  // ordem do RANKING: dinheiro do leaderboard desc (empate -> saldo do ledger).
  players.sort((a, b) => b.money - a.money || b.bal - a.bal);
  return players;
}

export default safe(handler);
