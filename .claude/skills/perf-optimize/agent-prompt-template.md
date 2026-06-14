# Sub-agent prompt template (allocation removal / static-mesh freeze)

Use `general-purpose` agents, **one per disjoint set of files** (no two agents touch the same file; the orchestrator keeps the delicate/cross-cutting files). Run in background; collect and **review each diff for aliasing** before building. Fill in the `<<…>>` slots.

---

You are optimizing CPU performance in **<<PROJECT>>**, a browser game in vanilla JavaScript ES modules + Three.js (<<VERSION>>), bundled by Vite. No TypeScript, no test framework. Repo root: `<<ABS_PATH>>`. Comments are in Portuguese; match the surrounding style.

STRICT RULES:
- ONLY edit: `<<FILE(S)>>`. You MAY read other files to verify caller behavior, but never edit them.
- Pure micro-optimization: replace per-frame heap allocations with reused module-scoped scratch objects, producing IDENTICAL math/behavior. No gameplay/visual change.
- Do NOT run the dev server, Playwright, or any browser automation (standing project instruction).
- After editing, run `node --check <file>` (Bash tool, repo root) on each file. It MUST pass.
- Report exactly which functions/lines you changed and confirm node --check passed.

TECHNIQUE: at module top (near other consts), declare reusable `const _v=new THREE.Vector3()` scratch instances. In hot loops, replace `new THREE.Vector3(...)` with `.set()/.copy()/.subVectors()/.addVectors()/.addScaledVector()`.

ALIASING SAFETY (critical):
- Two temporaries alive at the same time MUST use DIFFERENT scratch instances. Count how many are simultaneously live and provide that many.
- NEVER convert a vector that is STORED and read on a later frame (assigned to an object field, pushed into an array) into shared scratch — those keep their own owned vector.
- A function returning scratch must have all callers consume it before the next overwrite — verify the callers.
- For functions that `return {x,z,...}` object literals every frame, give them an `out=` parameter and write into a reused object; if one function is called twice and both results are read together, pass two DISTINCT buffers.

TARGETS (each runs every frame and is a hot allocator):
<<LIST THE EXACT FUNCTIONS + LINE RANGES + WHICH VARIABLES, AND WHICH MUST STAY OWNED>>

Final step: re-read your diff and confirm no two simultaneously-live temporaries share a scratch instance and no stored vector was scratched.

---

## Variant: static-mesh freeze agent

Same rules, but the task is: in the `finalize*()` functions that merge geometry into static meshes, set `m.matrixAutoUpdate=false; m.updateMatrix();` on every merged mesh and `group.matrixAutoUpdate=false; group.updateMatrix();` on every chunk Group. Safe because the geometry is baked in world space (groups stay at identity) and per-frame `g.visible` culling is independent of `matrixAutoUpdate`. Change nothing else.

## Variant: read-only audit agent

Use the `Explore` agent (read-only). Ask it to sweep `js/**` and `assets/models/**` for remaining per-frame costs NOT already covered: `new THREE.*` in `update*`/per-frame loops, `texture.needsUpdate=true` / canvas redraws every frame, `.clone()` in hot loops, `computeVertexNormals()`/`traverse()` over big subtrees per frame. Output a prioritized `file:line — what — always/feature/event — one-line fix` list. No edits.
