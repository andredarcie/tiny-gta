// Bootstrap / loader. There is NO loading screen: the title/menu is static HTML/CSS in
// index.html, so it's on screen the instant the page is parsed. The game module
// (js/core/main.ts — its import builds the world) loads right after that first paint, and
// the GPU warmup then runs in the BACKGROUND (js/core/warmup.ts), never blocking.

// UI fonts, bundled with the game (no font CDN — the game must run fully offline).
// Only the latin subsets/weights the CSS actually uses.
import '@fontsource/bowlby-one-sc/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-700.css';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/yellowtail/latin-400.css';

// PLAY pressed before the game module finished loading: remember it; input.ts starts the
// run as soon as it's wired (see setupInput).
const queuePlay = (): void => { (window as unknown as {__playQueued?: boolean}).__playQueued = true; };
document.getElementById('play')?.addEventListener('click', queuePlay, { once: true });

// Two rAFs guarantee the browser has PAINTED the title before we start evaluating the game.
const loadGame = (): void => { performance.mark('tg:import-start'); void import('./main.ts'); };
requestAnimationFrame(() => requestAnimationFrame(loadGame));
