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
let query = '';       // name filter (search box)
const visiblePlayers = () => {
  const q = query.trim().toUpperCase();
  return q ? allPlayers.filter(p => String(p.name).toUpperCase().includes(q)) : allPlayers;
};
// current RANKING money of a player (used to seed a fresh ledger on a gift)
const seedFor = pid => { const p = allPlayers.find(x => x.pid === pid); return p ? p.money : 0; };

async function showPlayers() {
  setMsg('Loading players…');
  let players;
  try { ({ players } = await api('players')); }
  catch (e) { setMsg(e.message === 'not_admin' ? 'Not authorized (admin only).' : 'Failed to load: ' + e.message); return; }
  if (!state.adminOpen) return; // closed while loading
  allPlayers = players || [];
  page = 0; query = '';
  if (!allPlayers.length) { setMsg('No players found.'); return; }
  renderPlayersPage();
}

// Render the current page of the cached list (already ranking-ordered by the server),
// filtered by the search box. `focusSearch` restores caret to the search field after
// a keystroke-triggered re-render.
function renderPlayersPage(focusSearch = false) {
  const b = bodyEl(); if (!b) return;
  const list = visiblePlayers();
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  page = Math.min(Math.max(0, page), pages - 1);
  const start = page * PER_PAGE;
  const rows = list.slice(start, start + PER_PAGE).map((p, i) =>
    `<tr class="admin-row" data-pid="${escapeHtml(p.pid)}" data-name="${escapeHtml(p.name)}">` +
    `<td class="admin-pos">${start + i + 1}</td>` +       // continuous ranking position across pages
    `<td class="admin-name">${escapeHtml(p.name)}</td>` +
    `<td class="num">${fmt(p.money)}</td>` +
    `<td class="num">${fmt(p.bal)}</td></tr>`
  ).join('') || `<tr><td colspan="4" class="admin-msg">No player matches “${escapeHtml(query)}”.</td></tr>`;
  const nav = pages > 1
    ? `<button class="admin-back" type="button" data-pg="prev"${page === 0 ? ' disabled' : ''}>← PREV</button>` +
      `<span class="admin-sub">Page <b>${page + 1}</b>/${pages} · ${total} players · click one to gift / see transactions</span>` +
      `<button class="admin-back" type="button" data-pg="next"${page >= pages - 1 ? ' disabled' : ''}>NEXT →</button>`
    : `<span class="admin-sub"><b>${total}</b> player${total === 1 ? '' : 's'} · click one to gift / see transactions</span>`;
  b.innerHTML =
    `<div class="admin-bar"><input class="admin-search" type="text" placeholder="Search player…" value="${escapeHtml(query)}" ` +
    `style="flex:1;min-width:140px;background:#0b0d12;color:#e8eef5;border:1px solid #2a3340;border-radius:6px;padding:6px 10px;font:inherit"></div>` +
    `<div class="admin-bar">${nav}</div>` +
    `<table class="admin-table"><thead><tr><th>#</th><th>PLAYER</th><th class="num">RANKING</th><th class="num">BALANCE</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`;
  const search = b.querySelector('.admin-search');
  search?.addEventListener('input', e => { query = e.target.value; page = 0; renderPlayersPage(true); });
  b.querySelectorAll('.admin-row').forEach(row =>
    row.addEventListener('click', () => showTxs(row.dataset.pid, row.dataset.name)));
  b.querySelector('[data-pg="prev"]')?.addEventListener('click', () => { page--; renderPlayersPage(); });
  b.querySelector('[data-pg="next"]')?.addEventListener('click', () => { page++; renderPlayersPage(); });
  if (focusSearch && search) { search.focus(); const v = search.value; search.setSelectionRange(v.length, v.length); }
}

// God Gift: the owner grants money to a player (themed "god_gift" in the ledger).
async function giftTo(pid, name) {
  const raw = prompt(`GOD GIFT — amount to grant ${name}:`, '30000');
  if (raw == null) return;
  const amount = Math.floor(Number(raw));
  if (!Number.isFinite(amount) || amount <= 0) { alert('Enter a positive amount.'); return; }
  if (!confirm(`Grant ${fmt(amount)} to ${name} as a god gift?`)) return;
  let data;
  try { data = await api('gift', { target: pid, amount, seed: seedFor(pid) }); }
  catch (e) { alert('Gift failed: ' + (e.message || 'error')); return; }
  const p = allPlayers.find(x => x.pid === pid); if (p) p.bal = data.bal; // keep the cached list in sync
  showTxs(pid, name); // refresh: the new god_gift tx + updated balance
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
    `<div class="admin-bar"><button class="admin-back" type="button" data-act="back">← BACK</button>` +
    `<button class="admin-back" type="button" data-act="gift">🎁 GOD GIFT</button>` +
    `<span class="admin-sub"><b>${escapeHtml(name)}</b> · balance <b>${fmt(data.bal)}</b> · ${txs.length} tx (recent window)</span></div>` +
    `<table class="admin-table"><thead><tr><th>WHEN</th><th>REASON</th><th class="num">AMOUNT</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`;
  b.querySelector('[data-act="back"]')?.addEventListener('click', () => renderPlayersPage()); // back to the same page (cached)
  b.querySelector('[data-act="gift"]')?.addEventListener('click', () => giftTo(pid, name));
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
