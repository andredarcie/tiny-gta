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
```

There is **no test framework and no linter**. Validation in this repo means `node --check` on the files you touched, plus a build. Do **not** run Playwright / browser automation unless the user explicitly asks for it in the current request — the project history records a standing instruction against it.

## Architecture

**Entry & loop.** `index.html` loads `js/main.js` as a module. `main.js` runs the single `requestAnimationFrame` loop (`frame` → `step(dt)`), dispatching each frame by `state.mode` (`'foot'` | `'car'` | `'cut'`) and calling every system's `update*(dt)`. `dt` is clamped to 0.05s.

**State.** `js/state.js` is the shared mutable core:
- `state` — all gameplay flags/values (mode, money, wanted, health, weapon, mobile, etc.).
- `input` — normalized input (`moveX/moveY/lookX/lookY`, `run/brake/shootHeld`, …) written by both `input.js` (keyboard/mouse) and `touch-controls.js` (touch). Gameplay reads only this, never raw keys.
- `refs` — **late-binding cross-module references**, populated by `main.js` after all modules load. This is the deliberate mechanism to call across modules without creating circular imports. When two systems need each other, expose a function/value through `refs` rather than adding a direct import.

**Engine.** `js/engine.js` owns the renderer, scene, camera, lights, fog, and mobile pixel-ratio/shadow limits. `js/constants.js` holds the world-grid math (`N`,`CELL`,`ROAD`,`HALF`…) and `groundHeight(x,z)` — terrain collision interpolates the *same* triangles the visual mesh uses, so physics matches what's drawn.

**Models vs. systems — strict separation (see `assets/models/README.md`).**
- `assets/models/**` — pure 3D geometry factories, **one model per file** (e.g. `makeCar`, `makePed`, `makeBuilding`). These are the only place that defines meshes, groups, sprites, materials. Do not create grouped packs (`effects.js`, `mission-models.js`); add a dedicated file per object.
- `js/**` — gameplay systems (`player`, `traffic`, `police`, `gangs`, `weapons`, `missions`, `taxi`, `story`, `pedestrians`, `daynight`, `hud`, …) that *orchestrate* models. They must not define geometry/materials.
- Many model modules expose `add*()` that push into per-material buckets, with a `finalize*()` called once in `world.js` to merge geometry (`mergeGeometries`) — the whole city renders in ~18 draw calls instead of ~900. Keep this batching intact when editing world/building code.

**Debug hooks** on `window`: `render_game_to_text()` (JSON snapshot of game state) and `advanceTime(ms)` (steps the loop deterministically).

## Conventions & gotchas

- **No manual cache-busting.** Vite handles asset hashing. The old `?v=BUILD` import-map convention is gone — do not reintroduce import maps or version query strings. Adding a new module just means a normal `import`; nothing in `index.html` needs editing. (`three/addons/` resolves via three's package `exports`.) The `BUILD NN` badge on the title screen is now cosmetic.
- **Camera yaw sign is settled** (`js/player.js` `updateCamera`): `cameraRig.yaw -= input.lookX*dt` with `input.lookX = v.x*YAW_SPEED`. Yaw increases to the left in this engine. Do not flip these signs based on a single phone test — history shows repeated wrong "still inverted" reports caused by stale mobile cache; hard-refresh/cache-bust before judging.
- Code comments are in Portuguese; player-facing game text is English.
- `progress.md` is an append-only running log of past changes and standing user instructions — read it for context on prior decisions, but it is not architecture documentation.
