// LEDGER DE DINHEIRO — "tabela separada" por jogador, no Redis.
//
// O saldo do jogador é a SOMA das suas transações. Cada transação é um campo de um
// hash `tinygta:ledger:<pid>` cujo NOME é o id da tx (`HSETNX` só grava a primeira
// vez que um id aparece), o que torna o append IDEMPOTENTE por id: reenviar o mesmo
// lote (retry de rede, keepalive no unload, duplo-toque) NUNCA credita duas vezes.
// O saldo dobrado/acumulado fica no campo reservado '#bal' (fora do charset de id),
// mantido em dia com `HINCRBY` pelo NET das txs que de fato eram novas.
//
// As txs individuais ficam só como janela recente (auditoria + dedupe); a
// compactação descarta as mais antigas — a contribuição delas já está em '#bal'.
import { redis } from './redis.js';
import * as C from './scores.js';

// Uma entrada de transação lida do ledger (para auditoria/admin).
export type LedgerEntry = { id: string; amt: number; t: number; why: string };

// Aplica um lote de transações de forma idempotente. Retorna o saldo resultante.
export async function appendTxs(pid: string, txs: C.Tx[]): Promise<number> {
  const key = C.ledgerKey(pid);
  if (txs.length) {
    // pipeline: 1 round-trip para todos os HSETNX (id -> "amt:t:why"). O `why` é
    // guardado p/ a auditoria (dashboard de admin) ver o motivo de cada movimento.
    const p = redis.pipeline();
    for (const tx of txs) p.hsetnx(key, tx.id, `${tx.amt}:${tx.t}:${tx.why}`);
    const res = (await p.exec()) as unknown[];
    // soma só as que voltaram 1 (eram NOVAS) — as repetidas (0) já estão em '#bal'.
    let delta = 0;
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      if (tx && Number(res[i]) === 1) delta += tx.amt;
    }
    if (delta !== 0) await redis.hincrby(key, C.LEDGER_BAL, delta);
  }
  await compactLedger(pid);
  return readBalance(pid);
}

// Saldo atual (campo '#bal'); clampado a >= 0.
export async function readBalance(pid: string): Promise<number> {
  const v = await redis.hget<string | number>(C.ledgerKey(pid), C.LEDGER_BAL);
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

// Semeia o saldo inicial/migrado UMA vez, como a tx estável 'genesis'. Idempotente
// (HSETNX só grava 'genesis' se ausente): um jogador anterior ao ledger mantém o
// dinheiro e o 'genesis' do próprio cliente (mesmo id) é deduplicado. Não semeia 0
// (jogador novo: deixa o 'genesis' do cliente, valendo o saldo inicial, entrar).
export async function seedLedger(pid: string, amount: number): Promise<void> {
  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  if (amt <= 0) return;
  const key = C.ledgerKey(pid);
  const created = await redis.hsetnx(key, 'genesis', `${amt}:${Date.now()}:start`);
  if (Number(created) === 1) await redis.hincrby(key, C.LEDGER_BAL, amt);
}

// Snapshot para o /api/session: saldo + nº de txs. O cliente rebaseia no `bal` (não
// nas txs cruas). null quando o ledger está vazio (jogador sem nada gravado ainda).
export async function readLedgerSnapshot(pid: string): Promise<{ bal: number; n: number } | null> {
  const len = await redis.hlen(C.ledgerKey(pid));
  if (!len) return null;
  return { bal: await readBalance(pid), n: Math.max(0, Number(len) - 1) };
}

// Lê TODAS as transações retidas do jogador (janela recente; as antigas já foram
// dobradas em '#bal' pela compactação), do mais novo p/ o mais velho. Usada pelo
// dashboard de admin. Cada valor do hash é "amt:t:why".
export async function readLedgerTxs(pid: string): Promise<LedgerEntry[]> {
  const all = await redis.hgetall<Record<string, string>>(C.ledgerKey(pid));
  if (!all) return [];
  const out: LedgerEntry[] = [];
  for (const id of Object.keys(all)) {
    if (id[0] === '#') continue; // pula campos reservados (#bal)
    const parts = String(all[id]).split(':');
    out.push({ id, amt: Math.trunc(Number(parts[0])) || 0, t: Number(parts[1]) || 0, why: parts.slice(2).join(':') });
  }
  out.sort((a, b) => b.t - a.t); // mais recentes primeiro
  return out;
}

// Mantém o hash limitado: quando passa de LEDGER_MAX, descarta os REGISTROS de tx
// mais antigos até LEDGER_KEEP. '#bal' e 'genesis' ficam intactos (a contribuição
// já está dobrada em '#bal'); os registros são só a janela recente de auditoria.
export async function compactLedger(pid: string): Promise<void> {
  const key = C.ledgerKey(pid);
  const len = await redis.hlen(key);
  if (len <= C.LEDGER_MAX) return;
  const all = await redis.hgetall<Record<string, string>>(key);
  if (!all) return;
  const recs: Array<{ id: string; t: number }> = [];
  for (const id of Object.keys(all)) {
    if (id[0] === '#' || id === 'genesis') continue; // preserva reservados + genesis
    const t = Number(String(all[id]).split(':')[1]) || 0;
    recs.push({ id, t });
  }
  const drop = recs.length - C.LEDGER_KEEP;
  if (drop <= 0) return;
  recs.sort((a, b) => a.t - b.t); // mais antigas primeiro
  const ids = recs.slice(0, drop).map((r) => r.id);
  if (ids.length) await redis.hdel(key, ...ids);
}
