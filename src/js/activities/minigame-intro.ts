// Mini-game BRIEFING + completion bookkeeping (client-only, fully offline).
//   1) INTRO: when a mini game starts (MiniGame.begin), freeze the world and show a
//      briefing card with the game's name and goal. The player reads it and
//      "passes" (key/click/tap) into the actual game — open-world briefing style.
//      The freeze is the state.mgIntro flag, read by the main loop (main.ts),
//      which only renders while it is set.
//   2) COMPLETION: each finished session marks the game as played today (the
//      "once per in-game day" rule), see markMiniGamePlayed().
import {state, refs} from '@/core/state.ts';

// The goal shown on the briefing for each mini game. Keyed by the string ids
// (= MiniGameId values) on purpose: avoids importing MiniGameId here and creating a
// cycle with minigame.ts (which imports this module). Unknown ids show no goal line.
const MG_GOAL: Record<string, string> = {
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

function goalHtml(id: string) {
  const m = MG_GOAL[id];
  return m ? `Goal: rack up as many <b>${m}</b> as you can.` : '';
}

// ---- INTRO (briefing overlay before each mini game) -------------------------
const ov = document.getElementById('mg-intro');
const elTitle = document.getElementById('mgi-title');
const elDesc = document.getElementById('mgi-desc');
const elGo = document.getElementById('mgi-go');
let openedAt = 0;        // to ignore the input that OPENED the intro (held key/tap)
let pendingStart: (() => void) | null = null; // callback to run when the player "passes" (overlay/pickup games)

// Opens the briefing for mini game `id` (label `name`). Called by MiniGame.begin
// at the exact moment an exclusive session starts.
//
// onStart (optional): called when the player PASSES the briefing. MiniGame
// sessions pass no callback (the session already runs under the frozen world); the
// overlay/pickup mini-games (bench press/dance/rocket rampage) use it to only
// actually OPEN once the briefing is dismissed.
export function openMiniGameIntro(id: string, name?: string, onStart: (() => void) | null = null) {
  if (!ov) { if (onStart) onStart(); return; } // no overlay: start right away
  if (state.mgIntro) return;       // one intro at a time
  state.mgIntro = id;
  pendingStart = onStart || null;
  openedAt = performance.now();
  if (elTitle) elTitle.textContent = name || id;
  if (elDesc) elDesc.innerHTML = goalHtml(id);
  ov.classList.add('show');
  ov.setAttribute('aria-hidden', 'false');
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
  if (start) start(); // only now open the overlay/pickup mini-game (briefing read)
}

// Any NEW key / click / tap passes the briefing. Guards:
//  - ignore the first ~300ms (don't consume the input that started the mini game);
//  - ignore held-key auto-repeat (else driving into the taxi would skip the intro);
//  - let F5/F11/F12 through (refresh/fullscreen/devtools).
function onDismiss(e: Event) {
  if (performance.now() - openedAt < 300) return;
  if (e.type === 'keydown') {
    const ke = e as KeyboardEvent;
    if (ke.repeat) return;
    if (ke.key === 'F5' || ke.key === 'F11' || ke.key === 'F12') return;
  }
  e.preventDefault();
  e.stopPropagation(); // consume the "pass": it must not become a shot/brake on the same frame
  closeMiniGameIntro();
}
elGo?.addEventListener('click', e => { e.preventDefault(); closeMiniGameIntro(); });

// used by main.ts: true while the briefing freezes the world
export function miniGameIntroActive() { return !!state.mgIntro; }

// ---- session completion -----------------------------------------------------
// Called by the mini games at the point the result is known (win or loss): marks
// the game as "played today" for the once-per-in-game-day rule.
export function markMiniGamePlayed(game: string) {
  refs.mgMarkPlayed?.(game);
}
