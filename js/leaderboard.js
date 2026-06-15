// Cliente do ranking global (backend Vercel + Upstash). O front só faz fetch:
//  - startSession(): pega um token no início da partida (vida da run)
//  - recordBest(money): acompanha o maior dinheiro da run
//  - submitFinal(): envia o melhor score ao sair (uma vez; token é single-use)
//  - refreshTopPlayers(): desenha o top 5 na tela inicial
export const API = 'https://tiny-gta-backend.vercel.app';
const NICK_KEY = 'tinygta_nick';

let token = null, bestMoney = 0, lastSent = -1, flushTimer = null;
let nickname = '';
try { nickname = localStorage.getItem(NICK_KEY) || ''; } catch (e) {}

export function getNickname() { return nickname; }
// token da sessão atual (single-run), reaproveitado pelos rankings por mini game
export function getSessionToken() { return token; }
export function setNickname(n) {
  nickname = n;
  try { localStorage.setItem(NICK_KEY, n); } catch (e) {}
}

export async function startSession() {
  token = null; bestMoney = 0; lastSent = -1;
  try {
    const r = await fetch(API + '/api/session', { method: 'POST' });
    token = (await r.json()).token;
  } catch (e) {}
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
      body: JSON.stringify({ name: nickname, money, token }),
      keepalive: true,
    }).then(r => { if (!r.ok) lastSent = -1; }).catch(() => { lastSent = -1; });
  } catch (e) { lastSent = -1; }
}

const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Atualiza o top 5 nas duas listas que usam o mesmo ranking: a tela inicial
// (#lb-list) e o overlay de pausa (#pause-lb-list).
export async function refreshTopPlayers() {
  const targets = ['lb-list', 'pause-lb-list']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  if (!targets.length) return;
  let entries = [];
  try {
    const r = await fetch(API + '/api/scores?limit=5');
    entries = (await r.json()).entries || [];
  } catch (e) {}
  const html = entries.length
    ? entries.map(e =>
        `<li><span class="lb-rank">${e.rank}</span>` +
        `<span class="lb-name">${escapeHtml(e.name)}</span>` +
        `<span class="lb-money">$${Number(e.money).toLocaleString('en-US')}</span></li>`
      ).join('')
    : '<li class="lb-empty">Be the first on the board!</li>';
  targets.forEach(el => { el.innerHTML = html; });
}

// reforço: manda o melhor score ao esconder/fechar a aba
addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
addEventListener('pagehide', flush);
