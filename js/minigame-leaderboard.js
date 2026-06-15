// Ranking POR MINI GAME (cliente). Duas responsabilidades:
//   1) INTRO: ao começar um mini game (MiniGame.begin), congela o mundo e mostra o
//      top 5 daquele jogo. O jogador lê e "passa" (tecla/clique/toque) pro jogo de
//      fato — estilo briefing do GTA. O congelamento é o flag state.mgIntro, lido
//      no loop principal (main.js) que só renderiza enquanto setado.
//   2) ENVIO: cada sessão concluída reporta {won,score} ao backend, que acumula e
//      recalcula um rating justo (ver backend/api/minigame.js + lib/scores.js).
import {state} from './state.js';
import {API, getNickname, getSessionToken} from './leaderboard.js';

const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const num = n => Number(n || 0).toLocaleString('en-US');

// ---- INTRO (overlay com o top 5 antes de cada mini game) -------------------
const ov = document.getElementById('mg-intro');
const elTitle = document.getElementById('mgi-title');
const elList = document.getElementById('mgi-list');
const elGo = document.getElementById('mgi-go');
let openedAt = 0;        // pra ignorar o input que ABRIU o intro (held key/tap)
let reqSeq = 0;          // descarta respostas de fetch fora de ordem
let pendingStart = null; // callback a rodar quando o jogador "passa" (overlay/pickup)

function render(entries) {
  if (!elList) return;
  elList.innerHTML = entries && entries.length
    ? entries.map(e =>
        `<li><span class="lb-rank">${e.rank}</span>` +
        `<span class="lb-name">${escapeHtml(e.name)}</span>` +
        `<span class="mgi-rating">${num(e.rating)}` +
        `<small>${num(e.plays)} plays</small></span></li>`
      ).join('')
    : '<li class="lb-empty">Be the first on the board!</li>';
}

async function loadBoard(game) {
  const seq = ++reqSeq;
  if (elList) elList.innerHTML = '<li class="lb-empty">Loading…</li>';
  let entries = [];
  try {
    const r = await fetch(`${API}/api/minigame?game=${encodeURIComponent(game)}&limit=5`);
    entries = (await r.json()).entries || [];
  } catch (e) {}
  if (seq === reqSeq && state.mgIntro === game) render(entries); // ainda é este intro?
}

// Abre o briefing do mini game `id` (rótulo `name`). Chamado pela base MiniGame.begin
// no exato momento em que uma sessão exclusiva começa.
//
// onStart (opcional): chamado quando o jogador PASSA o briefing. Sessões de
// MiniGame não passam callback (a sessão já roda sob o mundo congelado); os
// mini-games de overlay/pickup (supino/dança/rocket rampage) usam isto pra só
// ABRIR de fato depois que o top 5 é lido.
export function openMiniGameIntro(id, name, onStart = null) {
  if (!ov) { if (onStart) onStart(); return; } // sem overlay: começa direto
  if (state.mgIntro) return;       // um intro por vez
  state.mgIntro = id;
  pendingStart = onStart || null;
  openedAt = performance.now();
  if (elTitle) elTitle.textContent = name || id;
  ov.classList.add('show');
  ov.setAttribute('aria-hidden', 'false');
  loadBoard(id);
  addEventListener('keydown', onDismiss, true);
  addEventListener('pointerdown', onDismiss, true);
}

export function closeMiniGameIntro() {
  if (!state.mgIntro) return;
  state.mgIntro = null;
  removeEventListener('keydown', onDismiss, true);
  removeEventListener('pointerdown', onDismiss, true);
  if (ov) { ov.classList.remove('show'); ov.setAttribute('aria-hidden', 'true'); }
  const start = pendingStart; pendingStart = null;
  if (start) start(); // abre o mini-game de overlay/pickup só agora (top 5 lido)
}

// Qualquer tecla NOVA / clique / toque passa o briefing. Guardas:
//  - ignora os primeiros ~300ms (não consome o input que iniciou o mini game);
//  - ignora auto-repeat de tecla segurada (senão dirigir pro táxi já pularia o intro);
//  - deixa F5/F11/F12 passarem (refresh/fullscreen/devtools).
function onDismiss(e) {
  if (performance.now() - openedAt < 300) return;
  if (e.type === 'keydown') {
    if (e.repeat) return;
    if (e.key === 'F5' || e.key === 'F11' || e.key === 'F12') return;
  }
  e.preventDefault();
  e.stopPropagation(); // consome o "passar": não vira tiro/freio no mesmo frame
  closeMiniGameIntro();
}
elGo?.addEventListener('click', e => { e.preventDefault(); closeMiniGameIntro(); });

// usado por main.js: true enquanto o briefing congela o mundo
export function miniGameIntroActive() { return !!state.mgIntro; }

// ---- ENVIO de resultado de sessão ------------------------------------------
// Chamado pelos mini games no ponto em que o resultado é conhecido (vitória/derrota).
//   result = {won:bool, score:number>=0}
// score = a métrica natural da sessão (dinheiro ganho, kills, resgates, ...). O
// backend acumula plays/wins/losses/earned por jogador e recalcula o rating.
export function reportMiniGameResult(game, {won = false, score = 0} = {}) {
  const name = getNickname();
  const token = getSessionToken();
  if (!name || !token) return;     // sem apelido/sessão: ranking global desligado
  const s = Math.max(0, Math.round(Number(score) || 0));
  try {
    fetch(`${API}/api/minigame`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({game, name, won: !!won, score: s, token}),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}
}
