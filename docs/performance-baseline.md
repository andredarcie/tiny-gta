# Static rendering baseline

Run the real-game browser capture from the repository root:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.playwright'
npx playwright test test/static-perf.spec.ts
```

This checkout has Chromium installed in `.playwright`. No extension or plugin is
required. On a machine using Playwright's default browser cache, omit the environment
variable. If Chromium is missing, install it with `npx playwright install chromium`.

The test saves screenshots and JSON reports to `output/visual/static-perf/` (ignored
by Git). Archive that directory before the next run to retain a comparison. The
JSON includes camera position/orientation, FOV, viewport, DPR, drawing-buffer size,
render scale, time of day, frame timing, normal profiler output and category census.

Both views use a 1280 x 720 drawing buffer, render scale 1, FOV 62 and noon lighting.
The camera is fixed while normal gameplay, distance culling and the rendering
pipeline continue. Its height and target height are offsets from the terrain.
The player remains at the view's ground position, so the elevated view measures an
overview under the game's existing player-distance culling rules. View definitions
are in `test/static-perf.spec.ts`.

Each view settles for five seconds, then records 120 animation-frame intervals.
Median and p95 describe this browser run, including gameplay and postprocessing;
they are not GPU timings. Traffic, pedestrians and effects remain live, so dynamic
draws and frame timings vary between runs. Use the same machine and browser without
competing workloads for before/after timing comparisons.

The census runs after timing collection. It renders the scene directly with shadows
disabled, hides one category at a time and measures the drop in actual renderer
calls/triangles. Thus its total is a **color-pass scene total**, excluding shadow
and postprocessing passes. Compare it with the same census in future runs, rather
than an older total collected with different views or passes.

## First measured run (2026-10-21, local time)

| Category | Street draws | Elevated draws |
|---|---:|---:|
| Houses | 42 | 50 |
| Surveyed streets, including wires | 112 | 439 |
| Shops | 210 | 192 |
| Landmarks | 88 | 191 |
| Vegetation | 29 | 27 |
| Terrain | 2 | 2 |
| Other static: base roads, water, ground, poles | 19 | 18 |
| Props | 0 | 0 |
| Dynamic entity roots | 77 | 13 |
| Unassigned remainder | 84 | 90 |
| **Total** | **663** | **1,022** |

Terrain submitted 446,700 triangles in each view. Total submitted triangles were
1,413,850 (street) and 1,656,193 (elevated). These count submitted geometry, including
offscreen portions of intersecting meshes, rather than only visible pixels.

The first run's median/p95 frame intervals were 25.9/100.2 ms at street level and
15.2/49.3 ms elevated. Treat these as initial observations; further timing comparisons
should use repeated runs after warmup and keep other workloads idle.

Shops and surveyed streets are the strongest draw-call candidates in these views.
Terrain remains a geometry candidate. These measurements do not establish the FPS
gain of changing either system.

## In-game inspection

```js
console.table(JSON.parse(window.profilerCensusStatic()));
```

Category roots are recorded by `trackStatic()` in the town builder **after merging**,
without changing batching or parenting. `props` uses the existing prop chunks and
`dynamic` combines the existing entity roots. Duplicate or nested roots are rejected
to prevent double attribution. Originally hidden roots stay hidden, and renderer
state and visibility are restored even if rendering throws.

`__remainder` includes everything outside those registered roots: for example sky,
player/viewmodel, labels, markers and effects. It is explicitly unassigned, rather
than silently attributed to static scenery. Categories plus the remainder reconcile
to `__total` for both calls and triangles.

`window.__test.profileView(view)` fixes the debug camera and render scale;
`window.__test.profileView(null)` restores the previous FOV, render scale and time
of day and returns camera control to gameplay. This hook is available only in dev
or with the existing `?debug` flag. Census functions are on-demand diagnostics;
do not call them in the game loop or include them in frame-time samples.

## Implemented optimizations (2026-10-22)

Three subagents implemented and reviewed the material, terrain and vegetation work.
Integration and browser measurements were performed in stages.

1. Added `profilerMaterialCensus()`: actual submitted mesh draws classified as plain
   opaque, textured, emissive or transparent. Before colour batching, the street
   view's shops submitted 154 plain opaque draws out of 210 total. Surveyed street
   meshes submitted 78 plain opaque draws. Line draws, including wires, are not
   counted by this mesh-only material diagnostic.
2. Town `placeStatic()` now opts into compatible opaque colour batching. Linear RGB
   colours move into vertex attributes with a white shared material. Existing
   vertex colours multiply correctly; indices, normals, UV layouts and render state
   remain intact. Textured, emissive, transparent and custom-render materials retain
   separate buckets. Original spatial roots remain unchanged.
3. Identical painted shop-sign textures share a cache keyed by their complete painted
   content and pixel dimensions. Distinct text, logos and styles stay distinct.
   Other repeated surface textures already used caches.
4. Near terrain is partitioned into 384 m tiles without changing its triangles or
   any attribute values. Normals are copied from the original global mesh, avoiding
   shading seams. Far terrain uses 768 m tiles to balance calls against culling.
5. Far terrain alone has camera-distance LOD: 1.8 km threshold, 10% hysteresis,
   four-cell blocks and a maximum 3 m surface-height error. Full-resolution block
   and tile edge segments prevent cracks; incomplete blocks around holes remain
   detailed. Near playable terrain, collision and road draping remain unchanged.
6. Broadleaf crown colour variants share one instanced draw per vegetation chunk,
   using linear per-instance colours and the original foliage texture compensation.
   Tree transforms and palette distribution are preserved.

### Measured results

| Metric | Original street | Optimized street | Original elevated | Optimized elevated |
|---|---:|---:|---:|---:|
| Total draws | 663 | 433–440 | 1,022 | 617–619 |
| Shops draws | 210 | 62 | 192 | 73 |
| Surveyed streets draws | 112 | 48 | 439 | 232 |
| Landmarks draws | 88 | 48 | 191 | 115 |
| Vegetation draws | 29 | 17 | 27 | 16 |
| Terrain draws | 2 | 42 | 2 | 13 |
| Terrain triangles | 446,700 | 86,608 | 446,700 | 55,808 |
| Total submitted triangles | 1,413,850 | ~1,104,300 | 1,656,193 | ~1,318,000 |

Across two final runs, total draws fell approximately 34–35% at street level and
39–40% elevated. Terrain submissions fell 80.6% and 87.5%, respectively. Dynamic
entities and the unassigned remainder account for the variation between final runs.

Tiling alone at 384 m submitted 82,304 terrain triangles across 83 draws in the
street view, and 55,296 across 12 draws elevated. Enlarging only far tiles to 768 m
saved 41 street draws for about 4,500 extra submitted triangles; this is the final
configuration. Distant LOD has a small additional effect in these town-facing views;
most of the terrain reduction comes from tile culling.

Colour batching increases some building categories' submitted triangles because
larger combined bounds keep additional geometry in view. The complete scene still
submits substantially fewer triangles overall.

Final median animation-frame intervals were 13.7–14.5 ms (street) and 11.1–11.6 ms
(elevated), compared with the original 25.9/15.2 ms. However, final p95 intervals
were 131.7–147.1/80–97 ms, so these runs **do not demonstrate improved worst-case
frame times**. Compilation, streaming/warmup, simulation and other hitches warrant
separate profiling; the reductions in calls/triangles are the firm result here.

The harness now also captures `serra-distance`, a view towards the distant hills.
It submitted 183,184 terrain triangles in 57 draws; the screenshot was inspected
for visible gaps. There is no original matching baseline for that additional view.

Artifacts are stored locally under `output/visual/`:

- `static-perf-before/`: archived original screenshots and JSON.
- `static-perf-tiles/`: tiling stage, before enabling colour batching or far LOD;
  this stage already includes vegetation consolidation and sign texture sharing.
- `static-perf-after/`: the final two-view capture.
- `static-perf-final-check/`: repeat final capture plus distant hills.

Use `PERF_OUTPUT_DIR` to choose a fresh capture directory rather than overwrite a
previous comparison. Avoid editing source while a dev-server capture runs: Vite
hot reload can invalidate a saved view or restart the game midway through a test.

Validation: 167 unit tests, typecheck, lint (existing warnings), production bundle,
and the three-view Playwright capture passed. The sandbox prevented Vite's normal
config bundler from reading an ancestor directory, so the production bundle was
also checked with Vite's programmatic API using the same base, alias and chunk
settings (`configFile:false`); its temporary script is in ignored `output/`.

## Second round (2026-10-28)

The lot-by-lot street survey (~40 surveyed streets, the hospital front) had pushed the
street view to 1,740 draws: the surveyed streets alone made 1,293, of which 1,165 were
textured materials that colour batching left alone. Median frame 29 ms, CPU render
20 ms, a shadow-update frame 34 ms.

1. **Textured colour batching** (`static-color-batch.ts`): a material whose only texture
   is the diffuse `map` now batches too — the shader multiplies colour × vertex colour ×
   texel, so every tint of one plaster/tile/louvre texture shares a draw. The batched
   material is shared town-wide per signature, and signatures are cached per material
   (stringifying them cost ~0.75 s of the boot).
2. **Street blocks** (`build.ts`): surveyed-street pieces are merged per 200 m block of
   the town instead of street by street.
3. **Sign atlas** (`sign-atlas.ts`): façade signs and road boards are painted on shared
   2048² pages instead of one canvas texture (and draw) each.
4. **Detail LOD** (`world/detail-lod.ts`): after merging, triangles under 0.02 m² (two
   thirds of a street's: frames, bars, slats, sills, ridge tiles) move to detail meshes
   per 100 m cell, drawn only within 160 m of the camera (3D). The pieces share the
   original vertex attributes — no extra memory.
5. **Base streets in tiles** (`rua.ts makeStreets`): each paving was one mesh for the
   whole town (~417k triangles sent whatever the view); now 384 m tiles.
6. **Lighter vertices**: batched colours as normalised 16-bit (floats kept when a colour
   is lifted past 1, as foliage is), normals as normalised bytes, and no UVs on
   untextured batches. Geometry kept in JS memory 361 → 246 MB.

| Metric (centro-street) | Before | After |
|---|---:|---:|
| Total draws | 1,740 | 721 |
| Surveyed street draws | 1,293 | 244 |
| Submitted triangles | 2.34 M | 1.44 M |
| Base streets (otherStatic) triangles | 417k | ~218k |
| CPU render ms (profiler) | 20.3 | 9.1 |
| Shadow-update frame ms | 34.5 | 11.2 |
| Median rAF interval | 29.0 ms | 10.5 ms |
| JS geometry arrays | 361 MB | 246 MB |

The elevated view went 1,649 → 690 draws and 2.57 → 1.54 M triangles. Screenshots
before/after are pixel-for-pixel alike at these views. Remaining: ~126 shader
programs compile on the first frame (`onFirstUse` ~3.3 s in a dev boot), 22 of them
the vehicles' physical materials; the boot's town build still takes ~7 s in dev.
Captures: `output/visual/perf-1028-antes/` and `perf-1028-final/` (soft shadows, as shipped).
