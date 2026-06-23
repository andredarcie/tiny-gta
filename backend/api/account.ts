import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../lib/redis.js';
import { cors, clientIp, jsonBody, sendError, safe } from '../lib/http.js';
import { hashPassword, verifyPassword } from '../lib/auth.js';
import * as C from '../lib/scores.js';

// POST /api/account  { action:'register'|'login', username, password, pid? }
//
// Resolve (username, senha) -> pid, para o jogador RECUPERAR o save (que continua
// chaveado por pid) em qualquer aparelho ou depois de limpar o localStorage. É
// ADITIVO: quem joga como convidado nunca passa por aqui. Depois de resolver o
// pid, o cliente segue o fluxo normal (/api/session restaura o save desse pid).
async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');

  // rate-limit (coarse) por IP, comum a register+login: trava abuso/criação em massa.
  const ip = clientIp(req);
  const rlKey = C.ACCT_RL_PREFIX + ip;
  const hits = await redis.incr(rlKey);
  if (hits === 1) await redis.expire(rlKey, C.RL_WINDOW);
  if (hits > C.RL_MAX) return sendError(res, 429, 'rate_limited');

  const body = jsonBody(req);
  const action = body.action === 'register' || body.action === 'login' || body.action === 'check' ? body.action : null;
  const username = C.sanitizeName(body.username);     // mesmo saneamento do apelido
  if (!action) return sendError(res, 400, 'invalid_action');
  if (!username) return sendError(res, 400, 'invalid_name');

  // 'check': o cliente pergunta se um apelido já pertence a uma CONTA cadastrada,
  // pra impedir que um CONVIDADO entre com o apelido de outra pessoa. Não exige
  // senha e não revela mais do que o 'register' já revela (com 'taken'); protegido
  // pelo rate-limit por IP acima. O bloqueio real é server-side no /api/session.
  if (action === 'check') {
    const acct = await redis.get(C.acctKey(username));
    res.status(200).json({ ok: true, registered: !!acct });
    return;
  }

  const password = C.sanitizePassword(body.password);
  if (!password) return sendError(res, 400, 'invalid_password');

  if (action === 'register') {
    const existing = await redis.get(C.acctKey(username));
    if (existing) return sendError(res, 409, 'taken');

    // Adota o pid ANÔNIMO atual do cliente (carrega o progresso já feito) se ele
    // for válido e ainda não pertencer a outra conta; senão cria um pid novo.
    const clientPid = C.sanitizePid(body.pid);
    let pid: string | null = null;
    if (clientPid) {
      const owner = await redis.get(C.pidAcctKey(clientPid));
      if (!owner) pid = clientPid;
    }
    if (!pid) pid = randomUUID();

    const { salt, hash } = hashPassword(password);
    const acct: C.Account = { hash, salt, pid, at: Date.now() };
    await redis.set(C.acctKey(username), acct);
    await redis.set(C.pidAcctKey(pid), username);
    res.status(200).json({ ok: true, pid, username });
    return;
  }

  // login — controles DEDICADOS de brute-force (separados do register):
  //  a) throttle por IP só do login (mais apertado que o limite coarse acima);
  //  b) lockout após muitas falhas, chaveado por (IP, conta) — por IP de propósito,
  //     pra um terceiro NÃO conseguir trancar a conta de outra pessoa (anti-grief).
  const lrlKey = C.LOGIN_RL_PREFIX + ip;
  const lrlHits = await redis.incr(lrlKey);
  if (lrlHits === 1) await redis.expire(lrlKey, C.RL_WINDOW);
  if (lrlHits > C.LOGIN_RL_MAX) return sendError(res, 429, 'rate_limited');

  const failKey = C.LOGIN_FAIL_PREFIX + ip + '|' + username;
  if ((Number(await redis.get(failKey)) || 0) >= C.LOGIN_MAX_FAILS) return sendError(res, 429, 'rate_limited');

  // MESMA resposta pra "conta não existe" e "senha errada": não revela se o apelido
  // está cadastrado (anti-enumeração).
  const acct = await redis.get<C.Account>(C.acctKey(username));
  if (!acct || typeof acct !== 'object' || !verifyPassword(password, acct.salt, acct.hash)) {
    const n = await redis.incr(failKey);
    if (n === 1) await redis.expire(failKey, C.LOGIN_FAIL_WINDOW);
    return sendError(res, 401, 'invalid_credentials');
  }
  await redis.del(failKey); // sucesso zera o contador de falhas
  res.status(200).json({ ok: true, pid: acct.pid, username });
}

export default safe(handler);
