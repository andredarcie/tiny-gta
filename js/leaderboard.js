// Cliente do ranking global (backend Vercel + Upstash). O front só faz fetch:
//  - startSession(): abre a sessão e RESTAURA o dinheiro salvo do jogador
//  - recordBest(money): acompanha o maior dinheiro da run
//  - flush(): envia o melhor score (e salva o progresso) ao sair
//  - refreshTopPlayers(): desenha o top 5 na tela inicial
export const API = 'https://tiny-gta-backend.vercel.app';
const NICK_KEY = 'tinygta_nick';
const PID_KEY = 'tinygta_pid';

let token = null, bestMoney = 0, lastSent = -1, flushTimer = null;
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

// Abre a sessão e devolve o DINHEIRO SALVO desse (id, nick) — o chamador usa
// pra restaurar o saldo da partida. O servidor já conhece esse valor (é a base
// da sessão), então não reenviamos de cara: bestMoney/lastSent começam nele.
export async function startSession() {
  token = null; bestMoney = 0; lastSent = -1;
  let savedMoney = 0;
  try {
    const r = await fetch(API + '/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid, name: nickname }),
    });
    const data = await r.json();
    token = data.token;
    savedMoney = Math.max(0, Math.floor(Number(data.money) || 0));
  } catch (e) {}
  if (savedMoney > 0) { bestMoney = savedMoney; lastSent = savedMoney; }
  return savedMoney;
}

// Acompanha o maior dinheiro da run e agenda um envio ~3s após o último ganho.
export function recordBest(money) {
  if (typeof money !== 'number' || money <= bestMoney) return;
  bestMoney = money;
  if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 3000);
}

// Envia o melhor score (se subiu desde o último envio). O token vale a sessão
// toda; o servidor guarda só o melhor (GT). keepalive sobrevive ao unload.
export function flush() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (!token || !nickname) return;
  const money = Math.round(bestMoney);
  if (money <= 0 || money <= lastSent) return;
  lastSent = money; // otimista; em erro volta pra -1 e tenta de novo depois
  try {
    fetch(API + '/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nickname, money, token, pid }),
      keepalive: true,
    }).then(r => { if (!r.ok) lastSent = -1; }).catch(() => { lastSent = -1; });
  } catch (e) { lastSent = -1; }
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
