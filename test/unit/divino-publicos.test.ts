// The public buildings, grounds and squares rebuilt from Street View (publicos.ts,
// pracas-centro.ts): they build on the real terrain, their collision boxes keep off every
// roadway, and they don't collide with the game's lots or the surveyed businesses.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { divData as D, divinoHeight, nearGrid, DIV_OX, DIV_OZ } from '@/world/divinolandia/data.ts';
import { ALL_LOTS, type LotId } from '@/world/divinolandia/sites-table.ts';
import { LOJAS } from '@/world/divinolandia/comercio/lojas.ts';
import { planLojas } from '@/world/divinolandia/comercio/plan.ts';
import { PUBLICOS } from '../../src/assets/models/divinolandia/publicos.ts';
import { PRACAS } from '../../src/assets/models/divinolandia/pracas-centro.ts';
import type { GroundAt } from '../../src/assets/models/divinolandia/praca-chao.ts';

type P2 = [number, number];
const H = (x: number, z: number): number => divinoHeight(x + DIV_OX, z + DIV_OZ);
const ALL = [...PUBLICOS, ...PRACAS];
const rectC = (x: number, z: number, w: number, d: number, r: number): P2[] => {
  const c = Math.cos(r), s = Math.sin(r);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [x + u * w / 2 * c - v * d / 2 * s, z + u * w / 2 * s + v * d / 2 * c] as P2);
};
function overlap(a: P2[], b: P2[]): boolean {
  for (const poly of [a, b]) for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], nx = q[1] - p[1], nz = p[0] - q[0];
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const v of a) { const d = v[0] * nx + v[1] * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const v of b) { const d = v[0] * nx + v[1] * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
}

describe('public buildings and squares (publicos.ts, pracas-centro.ts)', () => {
  it('build on the real terrain, nothing flying or buried', () => {
    for (const p of ALL) {
      const y0 = H(...p.origin);
      const at: GroundAt = (x, z) => H(x, z) - y0;
      at.grid = [(x, _z) => (x + DIV_OX - nearGrid.x0) / nearGrid.cell, (_x, z) => (z + DIV_OZ - nearGrid.z0) / nearGrid.cell];
      const g = p.build(at); g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g);
      // within its own hillside: compare with the terrain range round it
      let lo = Infinity, hi = -Infinity;
      for (let dx = -130; dx <= 130; dx += 10) for (let dz = -130; dz <= 130; dz += 10) { const h = at(p.origin[0] + dx, p.origin[1] + dz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      expect(b.max.y, p.id).toBeLessThan(hi + 22);
      expect(b.min.y, p.id).toBeGreaterThan(lo - 4);
      let bad = 0; g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { const a = m.geometry.getAttribute('position'); for (let i = 0; i < a.count; i++) if (!Number.isFinite(a.getY(i))) bad++; } });
      expect(bad, p.id).toBe(0);
    }
  });
  it('their collision boxes keep off every roadway', () => {
    const bad: string[] = [];
    for (const p of ALL) for (const [x, z, w, d, r] of p.foot) for (const [cx, cz] of rectC(x, z, w * .9, d * .9, r))
      for (const rd of D.roads) for (let i = 1; i < rd.pts.length; i++) {
        const [ax, az] = rd.pts[i - 1], [bx, bz] = rd.pts[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
        let t = ((cx - ax) * dx + (cz - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        if (Math.hypot(cx - ax - t * dx, cz - az - t * dz) < rd.hw - .1) bad.push(`${p.id} on ${rd.n || rd.k}`);
      }
    expect([...new Set(bad)]).toEqual([]);
  });
  it('they collide with no game lot and no surveyed business', () => {
    const bad: string[] = [];
    const lots = (Object.keys(ALL_LOTS) as LotId[]).map(id => { const s = ALL_LOTS[id]; return { id, r: rectC(s.x, s.z, s.w, s.d, -s.face) }; });
    const shops = planLojas(LOJAS).map(q => ({ id: q.spec.id, r: [[-q.w / 2, 0], [q.w / 2, 0], [q.w / 2, q.d], [-q.w / 2, q.d]].map(([u, v]) => [q.x + q.ux * u - q.nx * v, q.z + q.uz * u - q.nz * v] as P2) }));
    for (const p of PUBLICOS) for (const [x, z, w, d, r] of p.foot) {
      const me = rectC(x, z, w, d, r);
      for (const l of [...lots, ...shops]) if (overlap(me, l.r)) bad.push(`${p.id} × ${l.id}`);
    }
    expect(bad).toEqual([]);
  });
});
