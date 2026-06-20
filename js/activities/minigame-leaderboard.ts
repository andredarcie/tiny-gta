// Ranking POR MINI GAME (cliente). Duas responsabilidades:
//   1) INTRO: ao começar um mini game (MiniGame.begin), congela o mundo e mostra o
//      top 5 daquele jogo. O jogador lê e "passa" (tecla/clique/toque) pro jogo de
//      fato — estilo briefing do open-world. O congelamento é o flag state.mgIntro, lido
//      no loop principal (main.js) que só renderiza enquanto setado.
//   2) ENVIO: cada sessão concluída reporta {won,score} ao backend, que acumula e
//      recalcula um rating justo (ver backend/api/minigame.js + lib/scores.js).
import {state, refs} from '@/core/state.js';
import {API, getNickname, getSessionToken, signSession} from '@/ui/leaderboard.js';

// Uma linha do top 5 retornado pelo backend.
interface MgEntry{
  rank: number;
  name: string;
  rating: number;
  plays: number;
}

const escapeHtml = (s: unknown): string => String(s).replace(/[&<>"']/g,
  c => (({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'} as Record<string, string>)[c]));

const num = (n: unknown): string => Number(n || 0).toLocaleString('en-US');

// Métrica natural de CADA mini game (o `score`/`earned` reportado por sessão). É
// a peça que muda por jogo no cálculo do rating (o número de desempenho do top
// 5). Chaveado pelos ids string (= valores de MiniGameId) de propósito: evita
// importar MiniGameId daqui e criar ciclo com minigame.js (que importa este
// módulo). Jogos sem métrica conhecida não mostram descrição.
const MG_METRIC: Record<string, string> = {
  taxi: 'fare money',
  race: 'prize money',
  'boat-race': 'prize money',
  offroad: 'prize money',
  vigilante: 'arrests',
  paramedic: 'rescues',
  firefighter: 'fires put out',
  rampage: 'kills',
  'rocket-rampage': 'cars wrecked',
  'rc-toyz': 'cars wrecked',
  gym: 'lift points',
  dance: 'dance points',
  'weed-farm': 'buds sold',
};

// Texto que explica COMO o número de desempenho é calculado para este mini game.
// O rating (ver backend/lib/scores.js miniGameRating) é a MÉDIA da métrica por
// partida, ponderada pela taxa de vitória e pela dedicação (nº de partidas).
function scoreDescHtml(id: string) {
  const m = MG_METRIC[id];
  if (!m) return '';
  return `Score = your average <b>${m}</b> per game, boosted by win rate and games played.`;
}

// ---- INTRO (overlay com o top 5 antes de cada mini game) -------------------
const ov = document.getElementById('mg-intro');
const elTitle = document.getElementById('mgi-title');
const elList = document.getElementById('mgi-list');
const elDesc = document.getElementById('mgi-desc');
const elGo = document.getElementById('mgi-go');
let openedAt = 0;        // pra ignorar o input que ABRIU o intro (held key/tap)
let reqSeq = 0;          // descarta respostas de fetch fora de ordem
let pendingStart: (() => void) | null = null; // callback a rodar quando o jogador "passa" (overlay/pickup)

function render(entries: MgEntry[]) {
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

async function loadBoard(game: string) {
  const seq = ++reqSeq;
  if (elList) elList.innerHTML = '<li class="lb-empty">Loading…</li>';
  let entries: MgEntry[] = [];
  try {
    const r = await fetch(`${API}/api/minigame?game=${encodeURIComponent(game)}&limit=5`);
    entries = ((await r.json()) as {entries?: MgEntry[]}).entries || [];
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
export function openMiniGameIntro(id: string, name?: string, onStart: (() => void) | null = null) {
  if (!ov) { if (onStart) onStart(); return; } // sem overlay: começa direto
  if (state.mgIntro) return;       // um intro por vez
  state.mgIntro = id;
  pendingStart = onStart || null;
  openedAt = performance.now();
  if (elTitle) elTitle.textContent = name || id;
  if (elDesc) elDesc.innerHTML = scoreDescHtml(id); // explica o número de desempenho
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
function onDismiss(e: Event) {
  if (performance.now() - openedAt < 300) return;
  if (e.type === 'keydown') {
    const ke = e as KeyboardEvent;
    if (ke.repeat) return;
    if (ke.key === 'F5' || ke.key === 'F11' || ke.key === 'F12') return;
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
export function reportMiniGameResult(game: string, {won = false, score = 0}: {won?: boolean; score?: number} = {}) {
  // marca "concluído hoje" (regra 1x/dia) ANTES de qualquer early-return: a trava
  // vale mesmo offline / sem ranking, é gameplay e não depende do backend.
  refs.mgMarkPlayed?.(game);
  const name = getNickname();
  const token = getSessionToken();
  if (!name || !token) return;     // sem apelido/sessão: ranking global desligado
  const s = Math.max(0, Math.round(Number(score) || 0));
  // assina (game.score.won.t) com o segredo da sessão — igual ao /api/scores, o
  // servidor rejeita um resultado editado na aba Network sem re-assinar.
  const won01 = won ? 1 : 0;
  const t = Date.now();
  const sig = signSession(game + '.' + s + '.' + won01 + '.' + t);
  try {
    fetch(`${API}/api/minigame`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({game, name, won: !!won, score: s, token, t, sig}),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}
}
