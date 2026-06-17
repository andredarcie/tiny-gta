import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../lib/redis.js';
import { cors, clientIp, jsonBody, sendError, safe } from '../lib/http.js';
import { scoreSig, safeEqualHex } from '../lib/auth.js';
import * as C from '../lib/scores.js';
import * as L from '../lib/ledger.js';

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

  // Lote de transações do ledger (cru, na ordem enviada) — usado na assinatura
  // (abaixo) e aplicado ao ledger (passo 5). Assinar as txs faz o servidor rejeitar
  // um VALOR de transação editado na aba Network (sem o segredo, não re-assina).
  const rawTxs = Array.isArray(body.txs) ? (body.txs as unknown[]) : [];
  const txDigest = C.txDigest(rawTxs);

  // 3c) ASSINATURA anti-adulteração: o envio tem que vir assinado (HMAC) com o
  //     segredo da sessão. Sem txs, a mensagem é `money.t` (compat com clientes
  //     antigos); com txs, é `money.t|<digest das txs>`. Um payload editado na aba
  //     Network sem re-assinar é rejeitado. Sessões antigas sem segredo (rollout) e
  //     REQUIRE_SIG=0 pulam a checagem — ver lib/scores.REQUIRE_SIG.
  if (sess.secret && C.REQUIRE_SIG) {
    const tSig = Number(body.t) || 0;
    const sig = typeof body.sig === 'string' ? body.sig : '';
    if (!safeEqualHex(sig, scoreSig(sess.secret, money, tSig, txDigest))) return sendError(res, 403, 'bad_signature');
  }
  const seconds = (Date.now() - sess.at) / 1000;

  // 4) teto de plausibilidade: dinheiro não passa do que cabe pelo tempo de
  //    partida, SOMADO ao saldo restaurado no início (sess.base) — quem volta
  //    rico reenvia o que já estava salvo sem cair no teto por tempo. Inteiro
  //    (dinheiro é em dólares cheios; sem isto o clamp gravava saldo fracionário).
  const maxAllowed = Math.floor(C.maxPlausibleMoney(seconds) + sess.base);

  // 5) LEDGER (tabela separada por jogador): aplica as transações do lote de forma
  //    IDEMPOTENTE (HSETNX por id — reenvio não duplica) e deriva o saldo
  //    AUTORITATIVO somando o que o servidor aceitou. O cliente não é mais a fonte
  //    do saldo do ranking. ANTES dos gates, pra progresso não se perder.
  let bal = money; // fallback p/ caminho sem pid (legado/borda)
  if (pid) {
    // higieniza + DESCARTA payouts acima do teto da fonte (anti-forja por mini-game:
    // ex.: uma tx `why:'race'` valendo 50k é jogada fora). Gastos (amt<0) passam.
    const valid = (rawTxs.map(C.sanitizeTx).filter(Boolean) as C.Tx[]).filter(C.payoutWithinCap);
    if (rawTxs.length > 0) {
      // Cliente COM ledger: aplica só as txs válidas. CRÍTICO: mesmo quando todas
      // foram descartadas (forja), NÃO cai no ramo legado de semear pelo `money` —
      // senão um payout descartado entraria pela porta da migração.
      bal = valid.length ? await L.appendTxs(pid, valid) : await L.readBalance(pid);
    } else {
      // Cliente LEGADO (nunca manda txs): migra o saldo do `money` UMA vez pra o
      // ranking não regredir. (Jogador que volta já teve o ledger semeado no
      // /api/session, então aqui bal já é > 0; o teto do ranking no passo 8 — 422 —
      // ainda barra um `money` implausível.)
      bal = await L.readBalance(pid);
      if (bal === 0 && money > 0) { await L.seedLedger(pid, money); bal = await L.readBalance(pid); }
    }
    // O '#bal' NÃO é clampado: ele é a soma verdadeira das transações (clampar
    // perderia dinheiro legítimo de um ganho grande, sem auto-cura no modelo de
    // delta). O freio do RANKING é o teto de plausibilidade no passo 8 (422).
  }

  // 6) SAVE (progresso privado: ITENS — armas/casa/coletáveis) — grava ANTES dos
  //    gates do ranking. O blob é cravado no teto por sanitizeSave; `blob.money`
  //    agora é só espelho (o saldo de verdade vem do ledger acima). Chave = só pid.
  if (pid && body.save) {
    const blob = C.sanitizeSave(body.save, maxAllowed);
    if (blob) {
      blob.name = name;          // nick autoritativo (ferramenta de manutenção acha por nome)
      await redis.set(C.saveKey(pid), blob);
      // o jogador agora tem save de verdade: consome o seed de migração do nome
      // (idempotente; só faz algo na primeira gravação de cada nome semeado).
      await redis.hdel(C.SEED_KEY, name);
    }
  }

  // 7) gate do RANKING (não afeta o ledger/save acima): partida curta demais NÃO
  //    publica score (anti-forja de sessão recém-criada). Retorna 200 ranked:false
  //    (NÃO 403): o save/ledger já foram gravados, então não é um erro — só "ainda
  //    não rankeado". Antes era 403 e o cliente flushava a cada 3s nos primeiros 20s,
  //    enchendo o console de 403 a cada sessão/reload. Quando o jogador ganha algo
  //    depois dos 20s, a mudança de saldo dispara um novo flush que enfim rankeia.
  if (seconds < C.MIN_RUN_SECONDS)
    return void res.status(200).json({ ok: true, ranked: false, reason: 'run_too_short' });

  // 8) leaderboard = SALDO ATUAL do jogador (somado do ledger, não o valor cru do
  //    cliente). CRAVADO no teto duro; o teto por tempo só morde no caminho sem pid
  //    (com pid o saldo já foi clampado a maxAllowed acima).
  const lbMoney = Math.min(bal, C.MONEY_HARD_CAP);
  if (lbMoney > maxAllowed)
    return void res.status(422).json({ error: 'implausible_score', maxAllowed: Math.floor(maxAllowed) });
  await redis.zadd(C.LEADERBOARD_KEY, { score: lbMoney, member: name });
  const rank = await redis.zrevrank(C.LEADERBOARD_KEY, name);
  res.status(200).json({ ok: true, name, money: lbMoney, rank: rank == null ? null : rank + 1 });
}

export default safe(handler);
