# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tiny Crime — a browser open-world-style game built with **TypeScript (strict)** ES modules and Three.js, bundled by Vite. No UI framework. The whole world (city, terrain, characters, vehicles, effects) is generated procedurally in code; there are **no image/model binary assets** loaded at runtime — textures are drawn to `<canvas>` and geometry is built from Three.js primitives.

## Commands

```bash
npm install        # install deps (three, vite)
npm run dev        # dev server at http://localhost:5173 (exposed on LAN via host:true for phone testing)
npm run build      # production build → dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit (strict) — the de-facto static check on the files you touched
npm run lint       # ESLint (flat config in eslint.config.ts)
npm run test:unit  # UNIT tests (Vitest, Node) — pure logic: math, RNG, world-gen, money ledger
npm test           # browser end-to-end tests (Playwright) — see "Testing" below
```

The codebase is **TypeScript in strict mode**. Static validation is `npm run typecheck` (`tsc --noEmit`) + `npm run lint` (ESLint), plus a `npm run build`. There are **two** test layers: a **Vitest unit suite** (`npm run test:unit`, `test/unit/**/*.test.ts`, runs in Node on pure/deterministic logic — safe to run yourself), and the **Playwright browser harness** (`npm test`) that drives the real game for *gameplay* changes (see the Testing section — that one is user-run). Do not stand up new ad-hoc test scripts; add unit tests under `test/unit/` and gameplay specs via the shared harness in `test/`.

**TypeScript conventions (post-migration):**
- **Folder layout.** The browser game lives under `src/` — `src/js/` (systems), `src/assets/` (models), `src/css/`, `src/data/` (baked JSON). `src/js/` is grouped by domain: `core/` (loop, state, engine, input, physics, save, economy, types, refs, rng, util), `world/` (map, daynight, traffic, peds, rural ambient), `actors/` (player + NPCs/authorities), `combat/` (weapons + heat modes), `activities/` (missions/minigames/jobs), `places/` (interiors/shops/property), `story/`, `ui/` (HUD/menus/overlays/input surfaces), `audio/`, `loot/`. (`src/assets/models/` stays grouped by its own domains.)
- **Imports use the `@/` alias → `src/js/`** (e.g. `import {state} from '@/core/state.ts'`), configured in `tsconfig.json` (`paths`), `vite.config.ts` and `vitest.config.ts`. Prefer `@/...` for cross-module imports; relative imports are fine within the same folder and for `src/assets/models/**`. Specifiers use the **`.ts`** extension (tsconfig `allowImportingTsExtensions`; the build is Vite/esbuild and `tsc` runs `--noEmit`), e.g. `import {state} from '@/core/state.ts'`. External bare modules (`three`, `three/addons/…js`) and `.json` imports keep their own suffix.
- **`import.meta.glob` patterns** (model-viewer/warmup) must stay **relative** (aliases don't work in glob) and match **`*.ts`** (the models are `.ts`).
- Shared cross-module types live in `src/js/core/types.ts` (`GameState`/`InputState`/`Refs`/`Vehicle`/`ModelDescriptor`/ledger/save); `state` is a closed `GameState`, `refs` has an index signature. `tsconfig.json` is strict with `allowJs:false`. Node tools (`npm run bake`, `npm run island-check`) run via `tsx`, not `node`.
- **Historical note:** older path mentions in code comments and docs may still say `js/...` or `assets/...`; the frontend now lives under `src/`, so `js/core/main.ts` is `src/js/core/main.ts` and `assets/models/…` is `src/assets/models/…`. Mentally prefix `src/` when a comment names an old path.

## Deployment

**🌿 BRANCHING MODEL — `dev` is the default integration branch; `main` is production only.**
- **Work directly on `dev` in the main checkout.** No worktrees and no per-task feature branches are needed — commit straight to `dev` and push it.
- **Everything new goes to `dev`.** Never commit to or merge into `main` during normal work.
- **`dev` does not deploy.** Pushing `dev` (or any branch) ships nothing. It is just where work accumulates and integrates.
- **Production ships ONLY on an explicit instruction from the user** ("ship to production" / "subir pra produção" / similar). Only then do you promote: merge **`dev` → `main`** and push `main`, which fires the itch.io pipeline. Do **not** touch `main` or merge `dev → main` on your own initiative — wait for that explicit word.
- So the normal flow for a change is: on `dev` → commit → push `dev`. The production flow (only when asked) is: merge `dev → main` → push `main` (→ pipeline → itch.io).

**⚠️ TO SHIP ANYTHING TO PLAYERS, IT MUST REACH `main`.** The itch.io deploy is **pipeline-driven** — it fires *only* on a push to `main` (GitHub Actions). A branch that is committed and pushed but never promoted into `main` ships nothing.

**📋 BEFORE EVERY PUSH TO `main`: add an entry to `src/data/updates.json`.** The in-game pause menu has an **UPDATES** panel — a player-facing changelog driven by the `src/data/updates.json` file (see `src/js/ui/pause-menu.ts`). It is a list of `{id, date, title, description}` objects ordered **newest-first**. Whenever you ship player-visible changes to `main`, **prepend one new entry** at the top of the array describing what changed in **plain, non-technical language** (the reader is a player, not a developer), dated with the day you ship (`YYYY-MM-DD`), and give it a unique `id`. A new top entry automatically lights up the "NEW" badge on the menu button until the player opens the panel. Skip this only for pure infra/docs changes a player would never notice.

**The game is 100% OFFLINE — keep it that way.** It runs in the browser but never needs the internet: there is no backend, no server, no multiplayer, no ranking/leaderboard, no accounts/nicknames and no cloud save. Progress is saved only in the browser's `localStorage` (`src/js/core/save.ts`, key `tinygta_save`). Fonts are bundled via `@fontsource` (no font CDN). Do not add `fetch`/WebSocket calls to remote services or load runtime assets from other origins. (Sole deliberate exception, kept by the user: the ranch-house TV iframe in `src/js/places/house-tv.ts` loads the andre-os site.)

**Deploy:** a push to `main` triggers the GitHub Actions **pipeline** (`.github/workflows/deploy-tiny-gta-itch.yml`) which publishes the static build to **itch.io**. This is the *only* way the game deploys — there is no manual itch upload and no branch ever deploys directly.

## Architecture

**Instant boot — no loading screen.** The title/menu is static HTML (on screen at ~0.05 s); `boot.ts` loads the game after that paint (an early PLAY click is queued). GPU warmup (`src/js/core/warmup.ts`) never blocks: `compileAsync` compiles all shaders in parallel (3D drawing held until ready, ~1 s), then meshes and interiors are warmed in ~4 ms-per-frame slices. Don't reintroduce a splash or a synchronous warmup. `npx playwright test test/boot-time.spec.ts` prints the boot timeline (`BASE_URL=http://localhost:4173` + `npx vite preview --port 4173` to measure the production build).

**Entry & loop.** `index.html` loads `src/js/core/main.ts` as a module. `main.ts` runs the single `requestAnimationFrame` loop (`frame` → `step(dt)`), dispatching each frame by `state.mode` (`'foot'` | `'car'` | `'cut'`) and calling every system's `update*(dt)`. `dt` is clamped to 0.05s.

**State.** `src/js/core/state.ts` is the shared mutable core:
- `state` — all gameplay flags/values (mode, money, wanted, health, weapon, mobile, etc.).
- `input` — normalized input (`moveX/moveY/lookX/lookY`, `run/brake/shootHeld`, …) written by both `input.ts` (keyboard/mouse) and `touch-controls.ts` (touch). Gameplay reads only this, never raw keys.
- `refs` — **late-binding cross-module references**, populated by `main.ts` after all modules load. This is the deliberate mechanism to call across modules without creating circular imports. When two systems need each other, expose a function/value through `refs` rather than adding a direct import.

**Engine.** `src/js/core/engine.ts` owns the renderer, scene, camera, lights, fog, and mobile pixel-ratio/shadow limits. Every frame is drawn with `renderFrame()` through a post-processing chain (pmndrs `postprocessing`): HDR scene → bloom (strength set per time of day in `daynight.ts`) → SMAA → ACES. No ambient occlusion and no film grain/scanlines/vignette overlays — they read as dirt on the flat-colour look. `npx playwright test test/visual-perf.spec.ts` prints the FPS per graphics setting; `test/visual-shots.spec.ts` saves noon/sunset/night screenshots to `output/visual/`. `src/js/core/constants.ts` holds the world-grid math (`N`,`CELL`,`ROAD`,`HALF`…) and `groundHeight(x,z)` — terrain collision interpolates the *same* triangles the visual mesh uses, so physics matches what's drawn.

**Models vs. systems — strict separation (see `src/assets/models/README.md`).**
- `src/assets/models/**` — pure 3D geometry factories, **one model per file**. Each file **default-exports a descriptor** `{category, label, build(opts), variants?}` where `build()` is pure (returns a fresh `Object3D`, no `scene.add`). The model viewer auto-discovers these via `import.meta.glob`, so a new model following the pattern shows up in the gallery with no viewer edits. Back-compat factory names (`makeCar`, `makePed`, `addPalm`…) remain as thin wrappers. These files are the only place that defines meshes/materials; do not create grouped packs. See `src/assets/models/README.md`.
- `src/js/**` — gameplay systems (`player`, `traffic`, `police`, `gangs`, `weapons`, `missions`, `taxi`, `story`, `pedestrians`, `daynight`, `hud`, …) that *orchestrate* models. They must not define geometry/materials.
- Many model modules expose `add*()` that push into per-material buckets, with a `finalize*()` called once in `world.ts` to merge geometry (`mergeGeometries`) — the whole city renders in ~18 draw calls instead of ~900. Keep this batching intact when editing world/building code.

**Debug hooks** on `window`: `render_game_to_text()` (JSON snapshot of game state), `advanceTime(ms)` (steps the loop deterministically), and `__test` (test scaffolding used by the browser harness — `enterCar`/`exitCar`/`interact`/`placeVehicle`/`setKey`/`clearKeys`/`raceTarget`). The game never uses `__test`; it only exists so tests can set up scenarios on the live instance.

## Testing (browser end-to-end)

> **▶ RUNNING THE GAME LOCALLY — HEADED (VISIBLE) ONLY. THIS IS MANDATORY.**
> When the user asks you to test/run the game locally (or to verify a change in the real game), you **MUST** drive it through the Playwright harness in a **VISIBLE (headed) window the user can watch in real time — NEVER headless, never `HEADLESS=1`.** The user has to be able to see the game being played; this is non-negotiable. Follow **[`test/AGENT_LOCAL_TESTING.md`](test/AGENT_LOCAL_TESTING.md)** step by step — it documents the boot trap, the `window` hooks, and ready-made recipes, so testing stops being a fight every time.
> - **Headed is obligatory.** Run `npx playwright test <spec>` with **no** `HEADLESS` env var. Headless is forbidden here (the user can't watch it) *and* unreliable (it throttles `requestAnimationFrame`, so boot stalls and driving wanders).
> - **Don't run the game unprompted.** Static checks stay your default on every change: `npm run typecheck`, `npm run build`, and `npm run test:unit` (safe pure-logic suite). Only launch the real game when the user asks you to test locally — then do it headed, per the guide.
> - **Visual-only judgments still belong to the user.** Run it headed, watch it, and report what you saw — but the final call on how models/animations/camera *look* and *feel* is the user's. Add new gameplay coverage as `test/*.spec.ts` on the shared harness (never one-off browser scripts).

> **🖥️ HEADLESS IS FORBIDDEN — ALWAYS RUN HEADED (VISIBLE).** If the game/harness is run at all (e.g. when the user explicitly authorizes it), it **MUST** open a real visible window. **Never pass `HEADLESS=1`, and never launch a headless browser for this game.** Reasons: (1) the user must be able to *watch* the run; (2) headless Chromium throttles `requestAnimationFrame`, so chases / driving / police AI behave differently from the real game and produce false results. If there is no display available, do **not** fall back to headless — stop and tell the user. When you do run it (authorized + headed), prefer **real-time** observation (let the real loop drive) over `advanceTime` fast-stepping whenever the point is to *see* the behaviour.

Gameplay is tested by driving the **real game in a real Chromium** (real Three.js/WebGL, real game loop, real input pipeline) via Playwright — there is no headless-stub/mock layer. This is the one sanctioned way to test the game; do not invent per-test browser scripts.

```bash
npx playwright install chromium   # one-time: download the browser
npm test                          # runs test/*.spec.ts HEADED (a window opens; you watch it play)
# HEADLESS=1 is FORBIDDEN for this game — always run headed/visible (see the rule above).
npm test -- test/race.spec.ts     # run one spec
```

- **Config:** `playwright.config.ts` auto-starts `npm run dev` and points tests at it. **Always headed (visible) — `HEADLESS=1` is forbidden (see the rule above).** Headless Chromium throttles `requestAnimationFrame`, starving the control loop (a race autopilot wanders and loses) and making chases / police AI misbehave, so it gives false results even for "just" boot/state assertions.
- **Driver:** `test/support/game.ts` exports a Playwright `test`/`expect` where every spec gets a booted `game` (a `GameDriver`). Write specs as `test/*.spec.ts` and `import { test, expect } from './support/game.ts'`. Key driver methods:
  - `boot()` — auto-starts the game (localhost dev shortcut: no title UI to drive) and waits for `started`; auto-run by the fixture. See `test/AGENT_LOCAL_TESTING.md`.
  - `snapshot()` — parsed `render_game_to_text()` (mode, money, vehicle, per-minigame state, …).
  - `enterCar()` / `placeVehicle(x,z,faceX,faceZ)` — get in a car / set up at an activity's start.
  - `startRaceByKey(stateKey)` — press **E** to start a race and pass the mini-game briefing.
  - `driveRace(stateKey)` — hold throttle + steer toward the live checkpoint to the finish; returns `{finished, place, cpReached, moneyGain, lostByRivals}`.
  - `down/up/tap` (real keyboard), `waitForState(pred)`, `inPage(fn)`.
- **Why a `window.__test` hook (and not `import()` in the page):** Playwright's `page.evaluate` runs `import('/src/js/*.js')` as a *separate* module instance from the running game, so it can't touch the live singletons. Only `window`-attached hooks (`render_game_to_text`, `advanceTime`, `__test`) reach the real instance — that is why setup goes through `__test`.
- **Ready example:** `test/race.spec.ts` — the AI enters the car, presses E, and drives the off-road circuit to the finish (open terrain → reliable autopilot). Use it as the template for new gameplay tests.

## Conventions & gotchas

- **Art direction is codified — read `docs/ART_DIRECTION.md` before any visual change.** The game's look is "Vice em Miniatura": a miniature/diorama world (muted sun-faded base, saturation only where there is gameplay meaning, Vice-style neon at night, **no photo textures ever**). The world's color vocabulary lives in `src/js/core/palette.ts` — new/edited models take colors from there instead of inventing hex literals.
- **No manual cache-busting.** Vite handles asset hashing. The old `?v=BUILD` import-map convention is gone — do not reintroduce import maps or version query strings. Adding a new module just means a normal `import`; nothing in `index.html` needs editing. (`three/addons/` resolves via three's package `exports`.) The `BUILD NN` badge on the title screen is now cosmetic.
- **Violence is the focus.** `src/js/combat/gore.ts` dismembers ANY Npc (head, arms, legs, or the whole body blown apart) with arterial spurts, ground splatter and spreading pools — all via `refs` (`severHead/severArm/severLeg/gibNpc/maimRandom/spawnBlood/addBloodPool`). Difficulty levers: `PLAYER_DAMAGE_TAKEN` & co. in `src/js/core/difficulty.ts`, `WANTED_HEAT_SCALE` + cooldown in `src/js/core/wanted.ts`.
- **First person on foot, classic chase cam in vehicles, DOOM movement.** On foot the camera is first person; in ANY vehicle (car, bike, boat, plane, tractor, RC) it is the classic third-person chase camera (`src/js/actors/player.ts` `updateCamera` → `updateCameraFP`/`updateCameraChase`; story cut-scenes direct their own). There is no toggle. The FP arms share the gun's walk sway + recoil (`applyViewModel` in `src/js/combat/weapons.ts`). On-foot movement reproduces DOOM (1993) exactly (speed, acceleration, friction, arrow-key turning, view bob) from id's released source; the math and its source citations live in `src/js/actors/doom-physics.ts`, pinned by `test/unit/doom-physics.test.ts`. Don't retune those constants.
- **Keep NPCs and vehicles cheap to draw.** Every character (player + NPCs) is ONE skinned mesh (mouth and female hair are baked into it; the separate `userData.mouth` only shows while a cut-scene actor talks). NPC hand guns are baked to one mesh (`src/assets/models/bake.ts`). Road vehicles built by `makeCar/makeKombi/makeFiatUno/makeMotorcycle` get a distance LOD (`src/assets/models/vehicles/vehicle-lod.ts`): past ~38 m the whole vehicle is one baked mesh; parts that must stay live are flagged `userData.lodKeep`, and customised cars call `disableVehicleLod`. `npx playwright test test/npc-perf.spec.ts` prints FPS + the draw-call census at busy city spots.
- **Weed farm is played by hand in first person.** `src/js/activities/weed-farm.ts` decides what happens; `src/js/activities/weed-farm-fp.ts` is the camera-parented hand rig that shows it (carry poses, keyframed clips with camera focus + step-in, input lock via `refs.fpActionLock`, weapon hidden via `refs.farmHandsActive`). `npx playwright test test/weed-farm.spec.ts` plays the whole loop and saves frames of every clip to `output/visual/farm/`.
- **The story is a pay-phone mission chain** (`src/js/story/`): `story.ts` runs the stages (`chain.ts`: call1 → camp → call2 → burial → call3 → done, saved in the `story` slot), `cutscene.ts` is the shared cinematic engine (also used by Rick and the crooked-cop shakedown via `playCutscene`), `story-fp.ts` the first-person hands (phone receiver, shovel), `redneck-camp.ts` / `burial.ts` the two jobs. **Story text (dialogue, prompts, messages) is written in Brazilian Portuguese on purpose — user request; the rest of the game stays English.** The current objective is drawn BIG on the radar/map (`big:true` blips). `npx playwright test test/story.spec.ts` plays the whole chain (hooks: `__test.story('state'|'stage:<name>'|'killCamp'|'skipCine'|'toBooth'|'toCamp')`).
- **Localisation is on-demand.** Player text is written in English; `src/js/core/i18n.ts` `tr()` translates it at the HUD output points using `src/data/i18n/<lang>.json` (`?lang=pt-BR` or localStorage `tinygta_lang`). Translate strings only when a video/request needs them — no full-game rewrite. Dev builds log untranslated HUD strings as `[i18n-miss]`.
- **Promo videos: use the `record-video` skill** (`.claude/skills/record-video/SKILL.md`). Scenes live in `test/video/scenes/<name>.video.ts` (filmed via `test/video/director.ts`), `npm run video -- <name>` films + edits a 9:16 30 fps MP4 with cover/captions into `output/video/<name>/`. The video config (`playwright.video.config.ts`) is separate from `npm test`.
- **Camera yaw sign is settled** (`src/js/actors/player.ts` `updateCamera`): `cameraRig.yaw -= input.lookX*dt` with `input.lookX = v.x*YAW_SPEED`. Yaw increases to the left in this engine. Do not flip these signs based on a single phone test — history shows repeated wrong "still inverted" reports caused by stale mobile cache; hard-refresh/cache-bust before judging.
- **Code comments must always be in English**, as is player-facing game text. (Many existing modules still carry Portuguese comments from earlier work — write new/edited comments in English, and translate Portuguese ones you touch.)
- `docs/progress.md` is an append-only running log of past changes and standing user instructions — read it for context on prior decisions, but it is not architecture documentation.
