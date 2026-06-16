// Cliente do ranking global (backend Vercel + Upstash). O front só faz fetch:
//  - startSession(): abre a sessão e RESTAURA o save do jogador (dinheiro+itens)
//  - scheduleFlush(): mantém um envio agendado (chamado todo frame)
//  - flush(): envia o DINHEIRO ATUAL (ranking) + o save de progresso (itens)
//  - refreshTopPlayers(): desenha o top 5 na tela inicial
//
// O ranking reflete o DINHEIRO ATUAL do jogador (não mais o pico): é mais justo —
// quem gastou cai, quem acumula sobe. O backend grava o valor recebido (sem GT).
import { refs } from './state.js';
export const API = 'https://tiny-gta-backend.vercel.app';
const NICK_KEY = 'tinygta_nick';
const PID_KEY = 'tinygta_pid';

let token = null, lastSig = '', flushTimer = null;
let nickname = '';
try { nickname = localStorage.getItem(NICK_KEY) || ''; } catch (e) {}

// id estável do jogador (UUID guardado no localStorage). Combinado ao nick, é a
// identidade que o backend usa pra restaurar o saldo — assim ninguém herda o
// dinheiro de outro só digitando o apelido público.
function makeId() {
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

export function getNickname() { return nickname; }
export function getPlayerId() { return pid; }
// token da sessão atual (single-run), reaproveitado pelos rankings por mini game
export function getSessionToken() { return token; }
export function setNickname(n) {
  nickname = n;
  try { localStorage.setItem(NICK_KEY, n); } catch (e) {}
}

// Abre a sessão e devolve o SAVE desse (id, nick) — o chamador (js/save.js via
// input.js) restaura dinheiro + itens.
export async function startSession() {
  token = null; lastSig = '';
  let save = null;
  try {
    const r = await fetch(API + '/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid, name: nickname }),
    });
    const data = await r.json();
    token = data.token;
    save = data.save || (data.money > 0 ? { money: Math.floor(data.money) } : null);
  } catch (e) {}
  return save;
}

// Chamado todo frame: mantém um envio agendado. O setTimeout guardado por
// flushTimer faz o throttle (~3s); o flush() só posta quando algo mudou
// (assinatura — dedupe).
export function scheduleFlush() {
  if (token && nickname && !flushTimer)
    flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 3000);
}

// Envia ao backend o DINHEIRO ATUAL (ranking, sem GT no servidor) + o `save`
// (saldo atual + itens). O valor do ranking é o saldo atual do blob — ranking e
// save ficam no mesmo número. Dedupe por assinatura; keepalive sobrevive ao
// unload (pagehide/visibilitychange).
export function flush() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (!token || !nickname) return;
  const save = refs.collectSave?.() || null;
  const money = save ? Math.max(0, Math.floor(Number(save.money) || 0)) : 0;
  const sig = money + '#' + (save ? JSON.stringify(save) : '');
  if (sig === lastSig) return;       // nada mudou desde o último envio
  lastSig = sig;                     // otimista; em erro volta pra '' e tenta de novo
  try {
    fetch(API + '/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nickname, money, token, pid, save }),
      keepalive: true,
    }).then(r => { if (!r.ok) lastSig = ''; }).catch(() => { lastSig = ''; });
  } catch (e) { lastSig = ''; }
}

const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Dinheiro no ranking em forma COMPACTA (letras K/M/B/T) pra um jogador muito
// rico não estourar a largura da linha: $39.5K, $1.2M, $3B, $1T. Valores baixos
// saem normais ($250).
const moneyCompact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const fmtMoney = n => '$' + moneyCompact.format(Math.max(0, Math.floor(Number(n) || 0)));

// Atualiza o top 5 nas duas listas que usam o mesmo ranking: a tela inicial
// (#lb-list) e o overlay de pausa (#pause-lb-list). Também mostra o total de
// jogadores cadastrados no ranking (#lb-total / #pause-lb-total).
export async function refreshTopPlayers() {
  const targets = ['lb-list', 'pause-lb-list']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  const totals = ['lb-total', 'pause-lb-total']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  if (!targets.length) return;
  let entries = [], total = 0;
  try {
    const r = await fetch(API + '/api/scores?limit=5');
    const data = await r.json();
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
