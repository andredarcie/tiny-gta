# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tiny GTA — a browser GTA-style game built with vanilla JavaScript ES modules and Three.js, bundled by Vite. No framework, no TypeScript. The whole world (city, terrain, characters, vehicles, effects) is generated procedurally in code; there are **no image/model binary assets** loaded at runtime — textures are drawn to `<canvas>` and geometry is built from Three.js primitives.

## Commands

```bash
npm install        # install deps (three, vite)
npm run dev        # dev server at http://localhost:5173 (exposed on LAN via host:true for phone testing)
npm run build      # production build → dist/
npm run preview    # serve the production build
node --check js/<file>.js   # syntax-check a single module (the de-facto per-file validation)
npm test           # browser end-to-end tests (Playwright) — see "Testing" below
```

There is **no unit-test framework and no linter**. Quick validation is still `node --check` on the files you touched, plus a build. For *gameplay* changes there is now a browser test harness (`npm test`) that drives the real game — see the Testing section. Do not stand up new ad-hoc Playwright scripts; use the shared harness in `test/`.

## Architecture

**Entry & loop.** `index.html` loads `js/main.js` as a module. `main.js` runs the single `requestAnimationFrame` loop (`frame` → `step(dt)`), dispatching each frame by `state.mode` (`'foot'` | `'car'` | `'cut'`) and calling every system's `update*(dt)`. `dt` is clamped to 0.05s.

**State.** `js/state.js` is the shared mutable core:
- `state` — all gameplay flags/values (mode, money, wanted, health, weapon, mobile, etc.).
- `input` — normalized input (`moveX/moveY/lookX/lookY`, `run/brake/shootHeld`, …) written by both `input.js` (keyboard/mouse) and `touch-controls.js` (touch). Gameplay reads only this, never raw keys.
- `refs` — **late-binding cross-module references**, populated by `main.js` after all modules load. This is the deliberate mechanism to call across modules without creating circular imports. When two systems need each other, expose a function/value through `refs` rather than adding a direct import.

**Engine.** `js/engine.js` owns the renderer, scene, camera, lights, fog, and mobile pixel-ratio/shadow limits. `js/constants.js` holds the world-grid math (`N`,`CELL`,`ROAD`,`HALF`…) and `groundHeight(x,z)` — terrain collision interpolates the *same* triangles the visual mesh uses, so physics matches what's drawn.

**Models vs. systems — strict separation (see `assets/models/README.md`).**
- `assets/models/**` — pure 3D geometry factories, **one model per file**. Each file **default-exports a descriptor** `{category, label, build(opts), variants?}` where `build()` is pure (returns a fresh `Object3D`, no `scene.add`). The model viewer auto-discovers these via `import.meta.glob`, so a new model following the pattern shows up in the gallery with no viewer edits. Back-compat factory names (`makeCar`, `makePed`, `addPalm`…) remain as thin wrappers. These files are the only place that defines meshes/materials; do not create grouped packs. See `assets/models/README.md`.
- `js/**` — gameplay systems (`player`, `traffic`, `police`, `gangs`, `weapons`, `missions`, `taxi`, `story`, `pedestrians`, `daynight`, `hud`, …) that *orchestrate* models. They must not define geometry/materials.
- Many model modules expose `add*()` that push into per-material buckets, with a `finalize*()` called once in `world.js` to merge geometry (`mergeGeometries`) — the whole city renders in ~18 draw calls instead of ~900. Keep this batching intact when editing world/building code.

**Debug hooks** on `window`: `render_game_to_text()` (JSON snapshot of game state), `advanceTime(ms)` (steps the loop deterministically), and `__test` (test scaffolding used by the browser harness — `enterCar`/`exitCar`/`interact`/`placeVehicle`/`setKey`/`clearKeys`/`raceTarget`). The game never uses `__test`; it only exists so tests can set up scenarios on the live instance.

## Testing (browser end-to-end)

Gameplay is tested by driving the **real game in a real Chromium** (real Three.js/WebGL, real game loop, real input pipeline) via Playwright — there is no headless-stub/mock layer. This is the one sanctioned way to test the game; do not invent per-test browser scripts.

```bash
npx playwright install chromium   # one-time: download the browser
npm test                          # runs test/*.spec.js HEADED (a window opens; you watch it play)
HEADLESS=1 npm test               # no window (CI / agents on a machine with no display)
npm test -- test/race.spec.js     # run one spec
```

- **Config:** `playwright.config.js` auto-starts `npm run dev` and points tests at it. Headed by default (set `HEADLESS=1` to hide the window). Real-time *driving* tests (races, chases) should run **headed** — headless Chromium throttles `requestAnimationFrame`, starving the control loop (a race autopilot wanders and loses); `HEADLESS=1` is best for boot/state assertions, not live driving.
- **Driver:** `test/support/game.js` exports a Playwright `test`/`expect` where every spec gets a booted `game` (a `GameDriver`). Write specs as `test/*.spec.js` and `import { test, expect } from './support/game.js'`. Key driver methods:
  - `boot(nick)` — title → nickname → play (auto-run by the fixture).
  - `snapshot()` — parsed `render_game_to_text()` (mode, money, vehicle, per-minigame state, …).
  - `enterCar()` / `placeVehicle(x,z,faceX,faceZ)` — get in a car / set up at an activity's start.
  - `startRaceByKey(stateKey)` — press **E** to start a race and pass the leaderboard briefing.
  - `driveRace(stateKey)` — hold throttle + steer toward the live checkpoint to the finish; returns `{finished, place, cpReached, moneyGain, lostByRivals}`.
  - `down/up/tap` (real keyboard), `waitForState(pred)`, `inPage(fn)`.
- **Why a `window.__test` hook (and not `import()` in the page):** Playwright's `page.evaluate` runs `import('/js/*.js')` as a *separate* module instance from the running game, so it can't touch the live singletons. Only `window`-attached hooks (`render_game_to_text`, `advanceTime`, `__test`) reach the real instance — that is why setup goes through `__test`.
- **Ready example:** `test/race.spec.js` — the AI enters the car, presses E, and drives the off-road circuit to the finish (open terrain → reliable autopilot). Use it as the template for new gameplay tests.

## Conventions & gotchas

- **No manual cache-busting.** Vite handles asset hashing. The old `?v=BUILD` import-map convention is gone — do not reintroduce import maps or version query strings. Adding a new module just means a normal `import`; nothing in `index.html` needs editing. (`three/addons/` resolves via three's package `exports`.) The `BUILD NN` badge on the title screen is now cosmetic.
- **Camera yaw sign is settled** (`js/player.js` `updateCamera`): `cameraRig.yaw -= input.lookX*dt` with `input.lookX = v.x*YAW_SPEED`. Yaw increases to the left in this engine. Do not flip these signs based on a single phone test — history shows repeated wrong "still inverted" reports caused by stale mobile cache; hard-refresh/cache-bust before judging.
- **Code comments must always be in English**, as is player-facing game text. (Many existing modules still carry Portuguese comments from earlier work — write new/edited comments in English, and translate Portuguese ones you touch.)
- `progress.md` is an append-only running log of past changes and standing user instructions — read it for context on prior decisions, but it is not architecture documentation.
