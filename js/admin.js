// Admin dashboard (key Y) — visible ONLY to the game owner (nickname 'REI').
//
// The client gate (isAdmin) just hides the UI; the REAL gate is server-side: the
// /api/admin endpoint only answers when the session's pid OWNS the 'REI' account
// (see backend/api/admin.ts). So renaming yourself "REI" gets you nothing — the
// fetch returns 403 and the panel shows an error.
//
// It lists every player (name / ranking money / ledger balance) and, on click,
// the recent transactions of that player (amount, reason, time) — for the owner to
// see and manage what is happening in the economy.
import { state } from './state.js';
import { API, getNickname, getPlayerId, getSessionToken } from './leaderboard.js';

const ADMIN_NICK = 'REI';
export function isAdmin() { return getNickname() === ADMIN_NICK; }

const dashEl = () => document.getElementById('admin-dash');
const bodyEl = () => document.getElementById('admin-body');

const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => '$' + Math.abs(Math.floor(Number(n) || 0)).toLocaleString('en-US');
const fmtSigned = n => (Number(n) < 0 ? '-' : '+') + fmt(n); // "-$1,234" / "+$1,234"
const fmtTime = t => { try { return new Date(Number(t)).toLocaleString(); } catch (e) { return String(t); } };

// POST to /api/admin with the session identity. Throws with the server error code.
async function api(action, extra = {}) {
  const r = await fetch(API + '/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: getSessionToken(), pid: getPlayerId(), action, ...extra }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'error');
  return data;
}

function setMsg(text) { const b = bodyEl(); if (b) b.innerHTML = `<div class="admin-msg">${escapeHtml(text)}</div>`; }

// ---- Players list (ranking order, paginated 10 per page) --------------------
const PER_PAGE = 10;
let allPlayers = [];  // full list (ranking order), cached so paging never re-scans
let page = 0;         // current page (0-based)

async function showPlayers() {
  setMsg('Loading players…');
  let players;
  try { ({ players } = await api('players')); }
  catch (e) { setMsg(e.message === 'not_admin' ? 'Not authorized (admin only).' : 'Failed to load: ' + e.message); return; }
  if (!state.adminOpen) return; // closed while loading
  allPlayers = players || [];
  page = 0;
  if (!allPlayers.length) { setMsg('No players found.'); return; }
  renderPlayersPage();
}

// Render the current page of the cached list (already ranking-ordered by the server).
function renderPlayersPage() {
  const b = bodyEl(); if (!b) return;
  const total = allPlayers.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  page = Math.min(Math.max(0, page), pages - 1);
  const start = page * PER_PAGE;
  const rows = allPlayers.slice(start, start + PER_PAGE).map((p, i) =>
    `<tr class="admin-row" data-pid="${escapeHtml(p.pid)}" data-name="${escapeHtml(p.name)}">` +
    `<td class="admin-pos">${start + i + 1}</td>` +       // continuous ranking position across pages
    `<td class="admin-name">${escapeHtml(p.name)}</td>` +
    `<td class="num">${fmt(p.money)}</td>` +
    `<td class="num">${fmt(p.bal)}</td></tr>`
  ).join('');
  const bar = total > PER_PAGE
    ? `<div class="admin-bar"><button class="admin-back" type="button" data-pg="prev"${page === 0 ? ' disabled' : ''}>← PREV</button>` +
      `<span class="admin-sub">Page <b>${page + 1}</b>/${pages} · ${total} players · click one for its transactions</span>` +
      `<button class="admin-back" type="button" data-pg="next"${page >= pages - 1 ? ' disabled' : ''}>NEXT →</button></div>`
    : `<div class="admin-bar"><span class="admin-sub"><b>${total}</b> players · click one to see its transactions</span></div>`;
  b.innerHTML = bar +
    `<table class="admin-table"><thead><tr><th>#</th><th>PLAYER</th><th class="num">RANKING</th><th class="num">BALANCE</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`;
  b.querySelectorAll('.admin-row').forEach(row =>
    row.addEventListener('click', () => showTxs(row.dataset.pid, row.dataset.name)));
  b.querySelector('[data-pg="prev"]')?.addEventListener('click', () => { page--; renderPlayersPage(); });
  b.querySelector('[data-pg="next"]')?.addEventListener('click', () => { page++; renderPlayersPage(); });
}

// ---- One player's transactions ---------------------------------------------
async function showTxs(pid, name) {
  setMsg('Loading transactions…');
  let data;
  try { data = await api('txs', { target: pid }); }
  catch (e) { setMsg('Failed to load: ' + e.message); return; }
  if (!state.adminOpen) return;
  const b = bodyEl(); if (!b) return;
  const txs = data.txs || [];
  const rows = txs.length
    ? txs.map(tx =>
        `<tr><td>${fmtTime(tx.t)}</td>` +
        `<td>${escapeHtml(tx.why || '—')}</td>` +
        `<td class="num ${tx.amt < 0 ? 'admin-amt-neg' : 'admin-amt-pos'}">${fmtSigned(tx.amt)}</td></tr>`
      ).join('')
    : `<tr><td colspan="3" class="admin-msg">No retained transactions.</td></tr>`;
  b.innerHTML =
    `<div class="admin-bar"><button class="admin-back" type="button">← BACK</button>` +
    `<span class="admin-sub"><b>${escapeHtml(name)}</b> · balance <b>${fmt(data.bal)}</b> · ${txs.length} tx (recent window)</span></div>` +
    `<table class="admin-table"><thead><tr><th>WHEN</th><th>REASON</th><th class="num">AMOUNT</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`;
  b.querySelector('.admin-back')?.addEventListener('click', renderPlayersPage); // back to the same page (cached)
}

// ---- open / close -----------------------------------------------------------
export function openAdmin() {
  if (state.adminOpen || !isAdmin()) return;
  state.adminOpen = true;
  document.exitPointerLock?.(); // free the cursor so the dashboard rows are clickable
  dashEl()?.classList.add('open');
  document.body.classList.add('admin-open');
  showPlayers();
}
export function closeAdmin() {
  if (!state.adminOpen) return;
  state.adminOpen = false;
  dashEl()?.classList.remove('open');
  document.body.classList.remove('admin-open');
}
export function toggleAdmin() { state.adminOpen ? closeAdmin() : openAdmin(); }

document.getElementById('admin-close')?.addEventListener('click', e => { e.stopPropagation(); closeAdmin(); });
