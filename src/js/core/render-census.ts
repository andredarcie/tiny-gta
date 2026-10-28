import type * as THREE from 'three';

const CATEGORIES = ['houses', 'surveyedStreets', 'shops', 'landmarks', 'sheds', 'vegetation', 'terrain', 'otherStatic'] as const;
export type StaticCategory = typeof CATEGORIES[number];
export const staticRenderGroups = Object.fromEntries(CATEGORIES.map(c => [c, []])) as unknown as Record<StaticCategory, THREE.Object3D[]>;

// The category is typed: an unknown name used to compile and then crash the world build at
// load (push on undefined) — the sheds went in as 'galpoes' and the game stopped loading.
//
// A tracked root is static scenery by definition, so it is also FROZEN here (freezeStatic).
export function trackStatic<T extends THREE.Object3D>(category: StaticCategory, root: T): T {
  staticRenderGroups[category].push(root);
  freezeStatic(root);
  return root;
}

// Freeze a static subtree: its world matrices are computed once (as children of an
// identity parent — the scene) and the per-frame scene.updateMatrixWorld() — which the
// scene FORCES down every branch, every frame — no longer walks into it. That walk over
// the town's thousands of static objects was a quarter of the CPU frame. Visibility,
// geometry and uniforms may still change; MOVING a frozen object needs refreezing.
const noop = (): void => {};
export function freezeStatic(root: THREE.Object3D): void {
  root.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); });
  root.updateMatrixWorld(true);
  root.matrixWorldAutoUpdate = false;
  root.updateMatrixWorld = noop;
}

// On-demand color-pass attribution. No simulation steps occur between renders.
// Each root must belong to one category only, with no ancestor in another category.
export function renderCensus(renderer: THREE.WebGLRenderer, scene: THREE.Scene,
  camera: THREE.Camera, groups: Record<string, THREE.Object3D[]>) {
  const roots = new Set<THREE.Object3D>();
  for (const objects of Object.values(groups)) for (const root of objects) {
    if (roots.has(root)) throw new Error('Duplicate census root');
    roots.add(root);
  }
  for (const root of roots) for (let parent = root.parent; parent; parent = parent.parent) {
    if (roots.has(parent)) throw new Error('Overlapping census roots');
  }
  const shadow = renderer.shadowMap.enabled;
  const needsUpdate = renderer.shadowMap.needsUpdate;
  const autoReset = renderer.info.autoReset;
  const measure = () => {
    renderer.info.reset();
    renderer.render(scene, camera);
    return {draws: renderer.info.render.calls, tris: renderer.info.render.triangles};
  };
  renderer.shadowMap.enabled = false;
  renderer.info.autoReset = true;
  try {
    const base = measure();
    const out: Record<string, {draws: number; tris: number}> = {__total: base};
    let draws = 0, tris = 0;
    for (const [name, objects] of Object.entries(groups)) {
      const saved = objects.map(root => root.visible);
      try {
        for (const root of objects) root.visible = false;
        const after = measure();
        out[name] = {draws: base.draws - after.draws, tris: base.tris - after.tris};
        draws += out[name].draws; tris += out[name].tris;
      } finally {
        objects.forEach((root, i) => { root.visible = saved[i]; });
      }
    }
    out.__remainder = {draws: base.draws - draws, tris: base.tris - tris};
    return out;
  } finally {
    try { measure(); } finally {
      renderer.shadowMap.enabled = shadow;
      renderer.shadowMap.needsUpdate = needsUpdate;
      renderer.info.autoReset = autoReset;
    }
  }
}
