// Bootstrap / loader. The intro splash ("André N. Darcie presents") is pure HTML/CSS in
// index.html, so the browser paints it the instant the page is parsed. We then wait for
// that first paint and ONLY THEN load the game (js/core/main.ts) — whose evaluation does
// the heavy synchronous boot (the city/world is built as a side effect of importing
// world.ts, plus warmupShaders() pre-compiles every shader). Loading the game after the
// intro is on screen means that boot freeze happens BEHIND the splash instead of on a
// black page, so the intro actually masks the load (world + shader warmup), while the
// leaderboard fetch (refreshTopPlayers) streams in the background. The title/menu is ready
// the moment the splash fades, so Play starts immediately.

const intro = document.getElementById('intro');
if (intro) {
  // Let a click/tap/key skip the splash, and drop it from the DOM once it has faded so it
  // never intercepts input on the title screen. Wired here (before the heavy import) so the
  // skip is armed as early as possible.
  const drop = (): void => { intro.classList.add('intro-gone'); setTimeout(() => intro.remove(), 400); };
  intro.addEventListener('pointerdown', drop, { once: true });
  addEventListener('keydown', drop, { once: true });
  setTimeout(() => { intro.remove(); }, 15000); // fallback ONLY (e.g. game chunk fails to load); the normal fade is gated on game-ready in main.ts
}

// Two rAFs guarantee the browser has PAINTED the intro before we block the main thread
// loading + evaluating the game (world build + shader warmup).
const loadGame = (): void => { void import('./main.ts'); };
requestAnimationFrame(() => requestAnimationFrame(loadGame));
