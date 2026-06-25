# Tiny Crime

A browser open-world action game built with vanilla JavaScript ES modules and [Three.js](https://threejs.org/), bundled by [Vite](https://vitejs.dev/). No framework, no TypeScript. The whole world — city, terrain, characters, vehicles, effects — is generated **procedurally in code**: there are no image/model binary assets, textures are drawn to `<canvas>`, and geometry is built from Three.js primitives.

## Quick start

```bash
npm install      # deps (three, vite)
npm run dev      # dev server at http://localhost:5173 (LAN-exposed for phone testing)
npm run build    # production build -> dist/
npm run preview  # serve the production build
```

## Project layout

- `js/**` — gameplay **systems** (player, traffic, police, gangs, weapons, missions, the mini-games, HUD, …). They orchestrate models; they don't define geometry.
- `assets/models/**` — pure 3D geometry **factories**, one model per file, each default-exporting a `{category, label, build(opts)}` descriptor (see `assets/models/README.md`).
- `js/core/main.ts` — the single `requestAnimationFrame` loop; `js/core/state.ts` — the shared mutable `state`/`input`/`refs`.
- `backend/**` — serverless API for the global leaderboards.

See `CLAUDE.md` for the full architecture notes and conventions.

## Testing

Gameplay is tested by driving the **real game in a real Chromium** (real WebGL, real game loop, real input) with [Playwright](https://playwright.dev/) — there is no headless-stub layer, so tests are as faithful as possible. The harness is the single, shared way to test the game; build new tests on it rather than writing one-off browser scripts.

> **🤖 AI agents — read [`test/AGENT_LOCAL_TESTING.md`](test/AGENT_LOCAL_TESTING.md) before running the game.** When the human asks you to test/run it locally, follow that guide, and **always run HEADED (a visible window the human can watch) — never headless.** It documents the boot trap, the `window` hooks, and ready-made recipes so local testing stops being a fight every time.

```bash
npx playwright install chromium   # one-time: download the browser
npm test                          # run test/*.spec.js HEADED — a window opens and you watch the AI play
HEADLESS=1 npm test               # run without a window (CI, or a machine with no display)
npm test -- test/race.spec.js     # run a single spec
```

### Writing a test

Specs live in `test/*.spec.js` and use the driver fixture from `test/support/game.js`:

```js
import { test, expect } from './support/game.ts';

test('AI wins the off-road race', async ({ game }) => {
  await game.enterCar();                                   // get in the pink car
  await game.placeVehicle(196, 4, 230, -54);              // set up at the start gate
  await game.startRaceByKey('offroad');                   // press E + pass the briefing
  const r = await game.driveRace('offroad');              // throttle + steer to the finish
  expect(r.finished).toBeTruthy();
  expect(r.lostByRivals).toBeFalsy();
  expect(r.moneyGain).toBeGreaterThan(0);                 // a podium prize was paid
});
```

The booted `game` (a `GameDriver`) exposes: `snapshot()` (the live `render_game_to_text()` state), `enterCar()`, `placeVehicle()`, `startRaceByKey()`, `driveRace()`, `down/up/tap` (real keyboard), `waitForState()`, and `inPage()`. See `test/race.spec.js` for the worked example and `CLAUDE.md` → *Testing* for the details (including why setup goes through the `window.__test` hook).
