---
name: perf-optimize
description: Profile and optimize this Three.js/WebGL browser game (or any vanilla-JS canvas game) to hit a target FPS with no drops, without hurting visuals. Use when the user asks to improve performance, fix frame drops/stutter, profile FPS, "make it run smooth at N fps", reduce jank, or measure render cost. Builds/uses an in-game profiler, removes per-frame allocations, throttles non-critical work, freezes static meshes, measures real FPS in a browser, and can parallelize with sub-agents.
---

# Performance optimization playbook

A profiler-driven loop: **measure → find the real cost → apply visual-neutral fixes → re-measure**. The top constraint is almost always "don't hurt the visuals" — respect it. Don't chase micro-wins blind; let the profiler decide what matters.

## 0. Ground rules
- **Visual-neutral first.** Every change must produce identical pixels (or be a safety net that only engages under genuine overload). If a change can alter visuals, flag it and get buy-in.
- **Validate with `node --check <file>`** on every file you touch, then `npm run build`. This repo has no test framework/linter — that *is* the validation.
- **Do NOT run Playwright / a browser automatically** unless the user explicitly asks in the current request (standing repo instruction). Building the profiler so *they* can verify is the default. Only run the browser harness (step 5) when explicitly told to.
- Code comments in Portuguese, player-facing text English (repo convention).

## 1. Build (or reuse) an in-game profiler
If `js/profiler.js` doesn't exist, create it from `profiler.js` in this skill folder. It must provide:
- `begin(name)/end()` near-zero-cost section timers (no closures; a boolean guard returns immediately when off).
- `frameStart()/frameEnd()` measuring real frame ms (avg + slow-decaying peak) and FPS (+ rolling min).
- An overlay (toggle with `` ` `` / backquote, or `?prof` in the URL) showing FPS, frame ms, **draw calls + triangles** (`renderer.info.render`), geometries/textures/programs, renderScale, and **per-system CPU ms sorted**.
- `window.profilerReport()` → JSON snapshot (so it works headless and can be pasted into a report).

Wire it into the main loop (`main.js`): `P.frameStart()` at the top of the rAF callback, `P.frameEnd()` after `step()`, and wrap each `update*` system + `renderer.render` in `P.begin('x'); …; P.end();`.

## 2. Find the real cost (read + grep, don't guess)
Read the per-frame hot path (the loop's `step`/`update*` functions) and hunt for:
- **Per-frame heap allocations** → GC stutter (the usual cause of "quedas"/drops). Grep: `new THREE\.(Vector3|Vector2|Quaternion|Color|Matrix4|Euler)` inside `update*`/per-frame loops. Also `.clone()` in hot loops, and functions that `return {…}` object literals every frame.
- **Per-frame canvas/texture work**: `texture.needsUpdate=true`, `getContext('2d')` redraws, `drawImage` resamples, gradient rebuilds — anything redrawn every frame that changes slowly (minimap, sky, HUD).
- **Static objects recomputing matrices**: large numbers of merged/static meshes with default `matrixAutoUpdate=true`.
- **DOM writes every frame** (textContent/innerHTML) even when unchanged → layout thrash.
- **O(n) scans every frame** that are only cosmetic (e.g. a crosshair "target acquired" check).

## 3. Apply the fixes (patterns)
- **Scratch objects** instead of per-frame `new`: declare module-scoped `const _v=new THREE.Vector3()` and reuse via `.set/.copy/.subVectors/.addVectors/.addScaledVector`. **ALIASING RULES**: (a) two temporaries alive at the same time need *different* scratch instances; (b) **never** scratch a vector stored across frames (`obj.vel`, `obj.tgt`, anything pushed into an array) — those stay owned; (c) a function returning scratch must have callers consume it before the next call overwrites it (clone what they retain). For object-literal returns, add an `out=` parameter so callers that need two results at once pass distinct buffers (see `traffic.js` lanePoint/cornerPos).
- **Throttle slow-changing work**: gate it with a time accumulator. Minimap → ~22fps; sky texture upload → ~12fps; cosmetic O(n) checks → ~20fps; HUD prompt logic → ~12fps. Keep lights/physics/camera per-frame.
- **Freeze static merged meshes**: after building each merged mesh + chunk Group, `m.matrixAutoUpdate=false; m.updateMatrix();`. Visibility culling still works.
- **Guard DOM writes**: cache last value, only set textContent/innerHTML when it changed. Memoize cascade-y query functions called every frame (e.g. interact-prompt) at ~12fps.
- **Precompile shaders at boot**: `renderer.compile(scene,camera)` once after the world is built — kills the ~100ms first-reveal compile stall.
- **Adaptive resolution = SAFETY NET only**: see step 6. Never change resolution mid-game.

## 4. (Optional) Parallelize with sub-agents
If the user wants it (or the work spans many independent files), spawn `general-purpose` sub-agents on **disjoint files** (no two agents touch the same file; you keep the delicate/cross-cutting files). Use the template in `agent-prompt-template.md`. Always require them to: edit only their files, preserve behavior exactly, follow the aliasing rules, and run `node --check`. Review each agent's diff for aliasing before building. Spawn read-only `Explore` for a codebase-wide allocation/`needsUpdate` audit.

## 5. Measure for real (ONLY if the user explicitly asks to run the game)
Browsers vsync-cap `requestAnimationFrame` at the monitor refresh, so to see throughput **above 60 you must disable vsync**. Use `measure.mjs` in this skill folder (real Chrome via global Playwright `channel:'chrome'`, flags `--disable-gpu-vsync --disable-frame-rate-limit`, opens `?prof`, drives with the keyboard, reads `window.profilerReport()`):
```
npm run dev   # note the port it lands on
node <skill-dir>/measure.mjs <port> [dpr] [vsync]
```
Gotchas: start the game by clicking `#play` via `page.evaluate(()=>el.click())` (the button pulses → Playwright sees it "unstable"); test at **deviceScaleFactor 2** too (HiDPI quadruples fragment cost).

## 6. Interpret the numbers
- **Frame budget**: 100fps = 10ms, 60fps = 16.7ms. Chase frame *ms*, not the FPS reading (vsync caps it).
- If `render` ≈ 90% of the frame, you're **GPU-bound** → the lever is pixels (resolution/`pixelRatio`) and **draw calls**. Dynamic multi-mesh entities (cars/peds) dominate draw calls and can't be merged because they animate — reducing them is a model change; only do it with explicit visual buy-in.
- If gameplay-system ms is high → CPU-bound → allocations/throttling/algorithm.
- **Periodic peaks** ≈ the throttled shadow pass (full scene re-rendered into the shadow map). Acceptable if brief; reduce shadow map size only with visual buy-in.

## 7. Adaptive resolution — the safe way (important)
Changing `renderer.setPixelRatio` **reallocates the framebuffer** → a ~100ms hitch, brutal at HiDPI. So **never adapt mid-game**. Implement a **one-shot safety net**: after ~60 boot frames, lock a `renderScale` once; only drop below 1.0 if the worst-case (title screen renders the whole world with no culling) is below ~45fps (22ms). Machines with headroom stay at 1.0 → zero visual change. `engine.js` exposes `setRenderScale`/`getRenderScale` (clamp `[0.72,1]`), `main.js` drives it. vsync makes frame-time useless for "is there headroom" detection, which is exactly why the trigger is a conservative absolute floor, not a refresh-relative one.

## Bundled templates (this skill folder)
- `profiler.js` — drop-in in-game profiler (rename module imports for the target repo).
- `measure.mjs` — Playwright real-Chrome FPS harness (vsync-off, `?prof`, drives + samples).
- `agent-prompt-template.md` — sub-agent prompt for allocation removal / static-freeze on disjoint files.
