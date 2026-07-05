// Cliente do ranking global (backend Vercel + Upstash). O front só faz fetch:
//  - startSession(): abre a sessão e RESTAURA o save do jogador (dinheiro+itens)
//  - scheduleFlush(): mantém um envio agendado (chamado todo frame)
//  - flush(): envia o DINHEIRO ATUAL (ranking) + o save de progresso (itens)
//  - refreshTopPlayers(): desenha o top 5 na tela inicial
//
// O ranking reflete o DINHEIRO ATUAL do jogador (não mais o pico): é mais justo —
// quem gastou cai, quem acumula sobe. O backend grava o valor recebido (sem GT).
import { refs } from '@/core/state.ts';
import { hmacSha256Hex } from '@/core/sign.ts';
import type { SaveBlob } from '@/core/types.ts';
export const API = 'https://tiny-gta-backend.vercel.app';
const NICK_KEY = 'tinygta_nick';
const PID_KEY = 'tinygta_pid';
// Espelho LOCAL do último save (mesmo pid). Rede de segurança: se o backend
// devolver vazio por um soluço transitório (rede/Redis), o jogo restaura daqui
// em vez de começar do zero e sobrescrever o progresso bom no próximo flush.
// (Não cobre limpeza do localStorage — aí o próprio pid some; ver startSession.)
const SAVE_MIRROR_KEY = 'tinygta_save';

// A save blob carries a last-write-wins timestamp (`t`) on top of the persisted
// fields; the local mirror also adds it before writing. Loosely typed because the
// server/mirror payloads are validated by shape, not by class.
type SaveLike = Partial<SaveBlob> & { t?: number; [k: string]: unknown };

let token: string | null = null, lastSig = '', flushTimer: ReturnType<typeof setTimeout> | null = null;
// segredo por sessão (emitido pelo /api/session): assina o envio de score pra o
// servidor rejeitar um payload editado na aba Network. Vazio = backend sem o
// recurso (rollout) -> não assina; ver flush().
let flushSecret = '';
let nickname = '';
try { nickname = localStorage.getItem(NICK_KEY) || ''; } catch (e) {}

// id estável do jogador (UUID guardado no localStorage). Combinado ao nick, é a
// identidade que o backend usa pra restaurar o saldo — assim ninguém herda o
// dinheiro de outro só digitando o apelido público.
function makeId(): string {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
let pid = '';
try {
  pid = localStorage.getItem(PID_KEY) || '';
  if (!pid) { pid = makeId(); localStorage.setItem(PID_KEY, pid); }
} catch (e) { pid = makeId(); }

export function getNickname(): string { return nickname; }
export function getPlayerId(): string { return pid; }
// token da sessão atual (single-run), reaproveitado pelos rankings por mini game
export function getSessionToken(): string | null { return token; }
// Assina uma string com o segredo da sessão (HMAC). Exposto pra outros envios
// (ex.: resultado de minigame) assinarem sem ver o segredo. Vazio = sem segredo.
export function signSession(msg: string): string { return flushSecret ? hmacSha256Hex(flushSecret, msg) : ''; }
export function setNickname(n: string): void {
  nickname = n;
  try { localStorage.setItem(NICK_KEY, n); } catch (e) {}
}

// Adota um pid (ex.: o pid da conta após login/registro) e persiste, pra que as
// próximas sessões deste aparelho usem a mesma identidade. É o que faz o login
// RECUPERAR o save: trocar o pid local pelo da conta e deixar o /api/session
// restaurar o save daquele pid.
export function setPlayerId(newPid: string): void {
  if (typeof newPid !== 'string' || !newPid) return;
  pid = newPid;
  try { localStorage.setItem(PID_KEY, pid); } catch (e) {}
}

// Registra ou faz login de uma conta (usuário+senha) no backend, resolvendo o pid
// da conta e adotando-o localmente (+ o apelido). Retorna {ok:true} ou
// {ok:false, error:<código>} pra UI traduzir. NÃO inicia a partida — o chamador
// segue o fluxo normal (startSession) depois do ok.
export async function accountRequest(action: string, username: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await fetch(API + '/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, username, password, pid }),
    });
    const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; username?: string; pid?: string };
    if (!r.ok || !data.ok) return { ok: false, error: data.error || 'network' };
    setNickname(data.username || username);
    setPlayerId(data.pid as string);
    return { ok: true };
  } catch (e) { return { ok: false, error: 'network' }; }
}

// Pergunta ao backend se um apelido já é de uma CONTA cadastrada (sem senha). Usado
// pra impedir que um CONVIDADO entre com o apelido de outra pessoa. Em falha de rede
// devolve false (não trava o convidado offline) — o /api/session ainda protege o
// servidor recusando a sessão de convidado num apelido cadastrado.
export async function checkNameRegistered(name: string): Promise<boolean> {
  try {
    const r = await fetch(API + '/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', username: name }),
    });
    const d = (await r.json().catch(() => ({}))) as { registered?: boolean };
    return !!d.registered;
  } catch (e) { return false; }
}

// Lê/grava o espelho local do save (só do pid atual: nunca restaura o save de
// outra identidade que tenha ficado no mesmo aparelho).
function writeMirror(save: SaveLike): void {
  try { localStorage.setItem(SAVE_MIRROR_KEY, JSON.stringify({ pid, save })); } catch (e) {}
}
function readMirror(): SaveLike | null {
  try {
    const m = JSON.parse(localStorage.getItem(SAVE_MIRROR_KEY) || 'null') as { pid?: string; save?: SaveLike } | null;
    return m && m.pid === pid && m.save ? m.save : null;
  } catch (e) { return null; }
}

// Backup LOCAL disparado pelo economy.js a cada mudança de dinheiro. É o que torna
// "ganhar agora" seguro IMEDIATAMENTE no MESMO aparelho: mesmo que o envio ao
// backend (3s) ou o unload não aconteçam (crash/kill abrupto), o espelho local já
// tem o valor e o restaura na volta. Borda de SUBIDA (escreve na hora p/ uma
// recompensa avulsa = janela ~0) + uma escrita de cauda por janela de 400ms, que
// coalesce rajadas contínuas (ex.: renda por segundo do overkill).
let backupTimer: ReturnType<typeof setTimeout> | null = null, backupPending = false;
function doBackup(): void {
  const save = refs.collectSave?.() as SaveLike | undefined;
  if (save) { save.t = Date.now(); writeMirror(save); }
}
function backupNow(): void {
  if (backupTimer) { backupPending = true; return; } // dentro da janela: marca p/ a cauda
  doBackup();                                          // borda de subida: backup na hora
  backupTimer = setTimeout(() => {
    backupTimer = null;
    if (backupPending) { backupPending = false; doBackup(); } // captura o que mudou na janela
  }, 400);
}
refs.backupSave = backupNow;

// Abre a sessão e devolve o SAVE desse (id, nick) — o chamador (js/core/save.ts via
// input.js) restaura dinheiro + itens.
export async function startSession(): Promise<SaveLike | null> {
  token = null; lastSig = '';
  let save: SaveLike | null = null;
  try {
    const r = await fetch(API + '/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid, name: nickname }),
    });
    const data = (await r.json()) as { token?: string | null; secret?: unknown; save?: unknown; ledger?: { bal?: number }; money?: unknown };
    token = data.token ?? null;
    flushSecret = typeof data.secret === 'string' ? data.secret : '';
    save = (data.save && typeof data.save === 'object') ? (data.save as SaveLike) : null;
    // Dinheiro AUTORITATIVO do servidor: o saldo (#bal) do LEDGER vem somado das
    // transações que o servidor aceitou — ele manda como `data.ledger.bal`. Esse é
    // o saldo verdadeiro, então sobrescreve o `ledger`/`money` que estavam no blob
    // (que eram só espelhos do último flush). O snapshot fica `{ckpt: bal, txs:[]}`:
    // o cliente rebaseia em cima dele de forma idempotente (ver economy.importLedger).
    if (data.ledger && Number.isFinite(data.ledger.bal)) {
      save = save || {};
      save.ledger = { ckpt: Math.max(0, Math.floor(data.ledger.bal as number)), seq: Number((save.ledger as { seq?: number } | null | undefined)?.seq) || 0, txs: [] };
      save.money = Math.max(0, Math.floor(data.ledger.bal as number));
    } else if (!save && Number(data.money) > 0) {
      save = { money: Math.floor(Number(data.money)) }; // servidor antigo (sem campo ledger)
    }
  } catch (e) {}
  // Reconciliação com o espelho local (mesmo pid), priorizando NÃO PERDER
  // progresso: usa o espelho quando o backend não trouxe nada (rede/Redis falhou)
  // OU quando o espelho é MAIS NOVO que o save do servidor — caso de progresso
  // feito offline depois do último flush que chegou ao backend. Comparação por
  // carimbo `t` (last-write-wins): o save mais recente é a verdade. O espelho
  // carrega seu próprio snapshot de ledger, então adotá-lo restaura o saldo offline.
  const m = readMirror();
  if (m && (!save || (Number(m.t) || 0) > (Number(save.t) || 0))) save = m;
  return save;
}

// Chamado todo frame: mantém um envio agendado. O setTimeout guardado por
// flushTimer faz o throttle (~3s); o flush() só posta quando algo mudou
// (assinatura — dedupe).
export function scheduleFlush(): void {
  if (token && nickname && !flushTimer)
    flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 3000);
}

// Envia ao backend o DINHEIRO ATUAL (ranking, sem GT no servidor) + o `save`
// (saldo atual + itens). O valor do ranking é o saldo atual do blob — ranking e
// save ficam no mesmo número. Dedupe por assinatura; keepalive sobrevive ao
// unload (pagehide/visibilitychange).
export function flush(): void {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (!token || !nickname) return;
  const save = (refs.collectSave?.() as SaveLike | undefined) || null;
  const money = save ? Math.max(0, Math.floor(Number(save.money) || 0)) : 0;
  // Transações do LEDGER ainda não confirmadas pelo backend. O envio é IDEMPOTENTE
  // (o servidor aplica cada uma por id via HSETNX), então reenviar em falha/unload
  // não duplica nada. Limpas da fila só quando o POST retorna 200 (ackSyncedTxs).
  const txs = refs.takeUnsyncedTxs?.() || [];
  // dedupe pelo CONTEÚDO (sem o carimbo `t`) + os ids das txs pendentes — assim um
  // earn+spend que zera o saldo (mesmo money, txs novas) ainda dispara o envio.
  const sig = money + '#' + (save ? JSON.stringify(save) : '') + '#' + txs.map(x => x.id).join(',');
  if (sig === lastSig) return;       // nada mudou desde o último envio
  lastSig = sig;                     // otimista; em erro volta pra '' e tenta de novo
  // conteúdo mudou: carimba o instante (last-write-wins na reconciliação com o
  // espelho — ver startSession) e atualiza o backup local ANTES de postar, pra
  // que progresso feito offline sobreviva mesmo se o POST não chegar ao backend.
  const t = save ? (save.t = Date.now()) : Date.now();
  if (save) writeMirror(save);
  // assina com o segredo da sessão (síncrono, sobrevive ao unload): freio contra
  // edição casual do payload na aba Network. Sem txs a mensagem é `money.t` (compat);
  // com txs vira `money.t|<id:amt,...>`, cobrindo os VALORES das transações pra o
  // servidor rejeitar uma tx editada. DEVE casar com backend lib/scores.txDigest.
  const txDigest = txs.map(x => x.id + ':' + x.amt).join(',');
  const authMsg = txDigest ? (money + '.' + t + '|' + txDigest) : (money + '.' + t);
  const authSig = flushSecret ? hmacSha256Hex(flushSecret, authMsg) : '';
  const sentIds = txs.map(x => x.id);
  try {
    fetch(API + '/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nickname, money, token, pid, save, txs, t, sig: authSig }),
      keepalive: true,
    }).then(r => {
      if (!r.ok) { lastSig = ''; return; }
      refs.ackSyncedTxs?.(sentIds); // backend gravou: tira da fila de pendentes
    }).catch(() => { lastSig = ''; });
  } catch (e) { lastSig = ''; }
}

// Sai da conta/identidade atual: SALVA o progresso primeiro (o POST keepalive
// sobrevive ao reload), esquece pid/nick/espelho LOCAIS e recarrega pra tela
// inicial — onde dá pra entrar/registrar outra conta ou jogar como convidado.
// NÃO apaga o save do backend: ele continua lá, recuperável pelo login.
export function logout(): void {
  try { flush(); } catch (e) {}
  try {
    localStorage.removeItem(NICK_KEY);
    localStorage.removeItem(PID_KEY);
    localStorage.removeItem(SAVE_MIRROR_KEY);
  } catch (e) {}
  location.reload();
}

const escapeHtml = (s: unknown): string => String(s).replace(/[&<>"']/g,
  c => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]));

// Dinheiro no ranking em forma COMPACTA (letras K/M/B/T) pra um jogador muito
// rico não estourar a largura da linha: $39.5K, $1.2M, $3B, $1T. Valores baixos
// saem normais ($250).
const moneyCompact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const fmtMoney = (n: unknown): string => '$' + moneyCompact.format(Math.max(0, Math.floor(Number(n) || 0)));

// Atualiza o top 5 na tela inicial (#lb-list) + o total de jogadores no ranking
// (#lb-total). O menu de pausa tem seu próprio ranking paginado (js/ui/pause-menu.ts),
// que busca a lista completa sob demanda, então não passa mais por aqui.
export async function refreshTopPlayers(): Promise<void> {
  const targets = ['lb-list']
    .map(id => document.getElementById(id))
    .filter(Boolean) as HTMLElement[];
  const totals = ['lb-total']
    .map(id => document.getElementById(id))
    .filter(Boolean) as HTMLElement[];
  if (!targets.length) return;
  let entries: { rank: number; name: string; money: number }[] = [], total = 0;
  try {
    const r = await fetch(API + '/api/scores?limit=5');
    const data = (await r.json()) as { entries?: { rank: number; name: string; money: number }[]; total?: number };
    entries = data.entries || [];
    total = Number(data.total) || 0;
  } catch (e) {}
  const html = entries.length
    ? entries.map(e =>
        `<li><span class="lb-rank">${e.rank}</span>` +
        `<span class="lb-name">${escapeHtml(e.name)}</span>` +
        `<span class="lb-money">${fmtMoney(e.money)}</span></li>`
      ).join('')
    : '<li class="lb-empty">Be the first on the board!</li>';
  targets.forEach(el => { el.innerHTML = html; });
  const totalText = total > 0
    ? `${total.toLocaleString('en-US')} player${total === 1 ? '' : 's'} competing`
    : '';
  totals.forEach(el => { el.textContent = totalText; });
}

// reforço: manda o melhor score ao esconder/fechar a aba
addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
addEventListener('pagehide', flush);
