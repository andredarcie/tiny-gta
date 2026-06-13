// Cliente do ranking global (backend Vercel + Upstash). O front só faz fetch:
//  - startSession(): pega um token no início da partida (vida da run)
//  - recordBest(money): acompanha o maior dinheiro da run
//  - submitFinal(): envia o melhor score ao sair (uma vez; token é single-use)
//  - refreshTopPlayers(): desenha o top 5 na tela inicial
const API = 'https://tiny-gta-backend.vercel.app';
const NICK_KEY = 'tinygta_nick';

let token = null, bestMoney = 0, submitted = false;
let nickname = '';
try { nickname = localStorage.getItem(NICK_KEY) || ''; } catch (e) {}

export function getNickname() { return nickname; }
export function setNickname(n) {
  nickname = n;
  try { localStorage.setItem(NICK_KEY, n); } catch (e) {}
}

export async function startSession() {
  token = null; bestMoney = 0; submitted = false;
  try {
    const r = await fetch(API + '/api/session', { method: 'POST' });
    token = (await r.json()).token;
  } catch (e) {}
}

export function recordBest(money) {
  if (typeof money === 'number' && money > bestMoney) bestMoney = money;
}

// Enviado ao sair da aba/fechar (fim natural da sessão). keepalive garante que
// o request sobreviva ao unload. Single-use: só o 1º envio conta.
export function submitFinal() {
  if (submitted || !token || !nickname || bestMoney <= 0) return;
  submitted = true;
  try {
    fetch(API + '/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nickname, money: Math.round(bestMoney), token }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}
}

const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function refreshTopPlayers() {
  const el = document.getElementById('lb-list');
  if (!el) return;
  let entries = [];
  try {
    const r = await fetch(API + '/api/scores?limit=5');
    entries = (await r.json()).entries || [];
  } catch (e) {}
  if (!entries.length) {
    el.innerHTML = '<li class="lb-empty">Be the first on the board!</li>';
    return;
  }
  el.innerHTML = entries.map(e =>
    `<li><span class="lb-rank">${e.rank}</span>` +
    `<span class="lb-name">${escapeHtml(e.name)}</span>` +
    `<span class="lb-money">$${Number(e.money).toLocaleString('en-US')}</span></li>`
  ).join('');
}

// fim da sessão: manda o melhor score ao esconder/fechar a aba
addEventListener('visibilitychange', () => { if (document.hidden) submitFinal(); });
addEventListener('pagehide', submitFinal);
