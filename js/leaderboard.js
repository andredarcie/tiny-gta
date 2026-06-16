// Cliente do ranking global (backend Vercel + Upstash). O front só faz fetch:
//  - startSession(): abre a sessão e RESTAURA o save do jogador (dinheiro+itens)
//  - recordBest(money): acompanha o maior dinheiro da run (pico = ranking)
//  - flush(): envia o pico (ranking) E o save de progresso (saldo atual+itens)
//  - refreshTopPlayers(): desenha o top 5 na tela inicial
import { refs } from './state.js';
export const API = 'https://tiny-gta-backend.vercel.app';
const NICK_KEY = 'tinygta_nick';
const PID_KEY = 'tinygta_pid';

let token = null, bestMoney = 0, lastSig = '', flushTimer = null;
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
// input.js) restaura dinheiro + itens. O pico do ranking começa no saldo salvo
// (GT protege o recorde por nome de qualquer jeito).
export async function startSession() {
  token = null; bestMoney = 0; lastSig = '';
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
  const m = save && Number.isFinite(save.money) ? Math.max(0, Math.floor(save.money)) : 0;
  if (m > 0) bestMoney = m;
  return save;
}

// Acompanha o maior dinheiro da run (pico = ranking) e mantém um envio agendado.
// Chamado todo frame; o setTimeout guardado por flushTimer faz o throttle (~3s),
// e o flush() só posta de fato quando algo mudou (assinatura — dedupe).
export function recordBest(money) {
  if (typeof money === 'number' && money > bestMoney) bestMoney = money;
  if (token && nickname && !flushTimer)
    flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 3000);
}

// Envia ao backend: `money` = PICO da partida (ranking, GT no servidor) e `save`
// = blob de progresso (saldo ATUAL + itens). Dedupe por assinatura pra não
// repostar igual. keepalive sobrevive ao unload (pagehide/visibilitychange).
export function flush() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (!token || !nickname) return;
  const money = Math.max(0, Math.round(bestMoney));
  const save = refs.collectSave?.() || null;
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
        `<span class="lb-money">$${Number(e.money).toLocaleString('en-US')}</span></li>`
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
