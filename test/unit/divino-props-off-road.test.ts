// Nothing built from Street View stands in a roadway at ground level: every small mesh
// (a prop, a pump, a bench, a sign post, a bin, a motorbike…) of the fuel stations, the
// Monumento ao Ciclista and its surroundings, the Mahindra dealer and the surveyed
// businesses keeps off the streets the town draws (overhangs above 2.5 m are allowed:
// balconies, awnings). The public buildings and squares have the same check in
// divino-publicos.test.ts.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { divData as D, divinoHeight, DIV_OX, DIV_OZ } from '@/world/divinolandia/data.ts';
import { LOJAS } from '@/world/divinolandia/comercio/lojas.ts';
import { planLojas } from '@/world/divinolandia/comercio/plan.ts';
import { buildLoja } from '../../src/assets/models/divinolandia/loja-comercio.ts';
import Triangulo, { ORIGIN as O1 } from '../../src/assets/models/divinolandia/posto-triangulo.ts';
import Passoni, { ORIGIN as O2 } from '../../src/assets/models/divinolandia/posto-passoni.ts';
import Lurain, { ORIGIN as O3 } from '../../src/assets/models/divinolandia/posto-lurain.ts';
import Taurus, { ORIGIN as O4 } from '../../src/assets/models/divinolandia/posto-taurus.ts';
import Monumento, { ORIGIN as O5 } from '../../src/assets/models/divinolandia/monumento-ciclista.ts';
import Entorno, { ORIGIN as O6 } from '../../src/assets/models/divinolandia/entorno-ciclista.ts';
import Mahindra, { ORIGIN as O7 } from '../../src/assets/models/divinolandia/concessionaria-mahindra.ts';

const H = (x: number, z: number): number => divinoHeight(x + DIV_OX, z + DIV_OZ);
const segs = D.roads.flatMap(r => r.pts.slice(1).map((q, i) => ({ a: r.pts[i], b: q, hw: r.hw, n: r.n || r.k })));
const onRoad = (x: number, z: number): string | null => {
  for (const s of segs) { const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], l = dx * dx + dz * dz || 1; let t = ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / l; t = t < 0 ? 0 : t > 1 ? 1 : t;
    if (Math.hypot(x - s.a[0] - t * dx, z - s.a[1] - t * dz) < s.hw - .2) return s.n; }
  return null;
};
function offRoad(id: string, g: THREE.Object3D, bad: string[]): void {
  g.updateMatrixWorld(true);
  const box = new THREE.Box3(), c = new THREE.Vector3(), sz = new THREE.Vector3();
  g.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; box.setFromObject(m); box.getSize(sz);
    if (sz.x > 6 || sz.z > 6) return; box.getCenter(c); if (box.min.y > H(c.x, c.z) + 2.5) return;
    const r = onRoad(c.x, c.z); if (r) bad.push(`${id} on ${r}`); });
}

describe('props keep off the roadways', () => {
  it('stations, the monument, its surroundings and the dealer', () => {
    const bad: string[] = [];
    for (const [id, m, o] of [['triangulo', Triangulo, O1], ['passoni', Passoni, O2], ['lurain', Lurain, O3], ['taurus', Taurus, O4],
      ['monumento', Monumento, O5], ['entorno', Entorno, O6], ['mahindra', Mahindra, O7]] as const) {
      const y0 = H(o[0], o[1]), g = m.build({ groundAt: (x: number, z: number) => H(x, z) - y0 });
      g.position.set(o[0], y0, o[1]); offRoad(id, g, bad);
    }
    expect([...new Set(bad)]).toEqual([]);
  });
  it('the surveyed businesses', () => {
    const bad: string[] = [];
    for (const p of planLojas(LOJAS)) {
      const g = buildLoja({ w: p.spec.w, f: { ...p.spec.f, d: p.d - (p.spec.f.setback ?? 0) }, shop: p.spec.shop, kind: p.spec.kind, seed: 3 });
      g.position.set(p.x, H(p.x, p.z) + .15, p.z); g.rotation.y = Math.atan2(p.nx, p.nz); g.scale.x = p.w / p.spec.w;
      offRoad(p.spec.id, g, bad);
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});
