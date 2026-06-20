# 3D models

Rule: one model per file.

Model code is organized by domain:

```text
assets/models/
  aircraft/
  characters/
  city/
  daynight/
  effects/
  environment/
  missions/
  police/
  props/
  rural/
  terrain/
  vehicles/
  weapons/
```

Do not add grouped model packs such as `effects.js`, `world-props.js`, or
`mission-models.js`. If a new visual 3D object is added, create a dedicated file
for that object and import it directly from gameplay code.

Gameplay systems in `js/` should orchestrate models, not define model geometry,
meshes, groups, sprites, lines, points, or visual materials.

## Standard model interface

Every model file **default-exports a descriptor**:

```js
import * as THREE from 'three';

function build(opts = {}) {       // PURE: returns a fresh Object3D, no scene.add
  const g = new THREE.Group();
  // ...geometry...
  return g;
}

export default {
  category: 'Vehicles',           // group shown in the model viewer (defaults to folder name)
  label: 'Car',                   // display name
  build,                          // (opts) => Object3D  — the canonical single-instance factory
  // variants: [{label, opts}]    // optional: multiple looks from one file (e.g. player/police car)
};
```

- `build(opts)` must be **pure** — it returns a new object and must not call
  `scene.add` or mutate shared state. Callers that want it in the world do
  `scene.add(Model.build(...))` explicitly.
- The model viewer (`js/ui/model-viewer.ts`) discovers every file via
  `import.meta.glob` and reads this descriptor, so **a new model following this
  pattern appears in the gallery automatically** — no viewer edits needed.
- `build` may return a plain dict of parts (e.g. `{ring, beacon}`); the viewer
  wraps the `Object3D`-valued entries into a group.
- Back-compat factory names (`makeCar`, `makePed`, `addPalm`, …) may still be
  exported as thin wrappers for gameplay code, but `build()` is the standard.
- Placement/batched helpers (`add*` + `finalize*`, used by `world.js` for the
  draw-call merge) live alongside `build()`; keep that optimized path intact.
