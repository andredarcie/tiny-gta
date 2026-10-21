// The real businesses of Divinolândia (comercio/lojas.ts, placed by comercio/plan.ts): every
// one lands on its street, faces it, keeps off every roadway, never overlaps another one,
// a game place's lot, the Matriz squares or the surveyed street, and builds.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LOJAS } from '@/world/divinolandia/comercio/lojas.ts';
import { planLojas, lotPoints, clearance, toLocal, type Placed } from '@/world/divinolandia/comercio/plan.ts';
import { ALL_LOTS, SQUARES, type LotId } from '@/world/divinolandia/sites-table.ts';
import { STREETS } from '@/world/divinolandia/ruas/index.ts';
import { divData as D } from '@/world/divinolandia/data.ts';
import { buildLoja } from '../../src/assets/models/divinolandia/loja-comercio.ts';
import { DETALHES } from '@/world/divinolandia/comercio/detalhes.ts';

type P2 = [number, number];
const placed = planLojas(LOJAS);
const corners = (p: Placed): P2[] => [[-p.w / 2, 0], [p.w / 2, 0], [p.w / 2, p.d], [-p.w / 2, p.d]].map(([u, v]) => [p.x + p.ux * u - p.nx * v, p.z + p.uz * u - p.nz * v] as P2);
function overlap(a: P2[], b: P2[], tol = .05): boolean {
  for (const poly of [a, b]) for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], nx = q[1] - p[1], nz = p[0] - q[0], l = Math.hypot(nx, nz);
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const v of a) { const d = (v[0] * nx + v[1] * nz) / l; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const v of b) { const d = (v[0] * nx + v[1] * nz) / l; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 <= b0 + tol || b1 <= a0 + tol) return false;
  }
  return true;
}
const lotRect = (id: LotId): P2[] => {
  const s = ALL_LOTS[id], fx = Math.sin(s.face), fz = Math.cos(s.face), ux = fz, uz = -fx;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [s.x + ux * u * s.w / 2 + fx * v * s.d / 2, s.z + uz * u * s.w / 2 + fz * v * s.d / 2] as P2);
};

describe('the real businesses (comercio)', () => {
  it('every record is placed, with a unique id', () => {
    expect(placed.length).toBe(LOJAS.length);
    expect(new Set(LOJAS.map(l => l.id)).size).toBe(LOJAS.length);
    expect(LOJAS.length).toBeGreaterThan(60);
  });
  it('each faces the street it is listed on, close to its real place', () => {
    const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (const p of placed) {
      expect(norm(p.road)).toContain(norm(p.spec.rua));
      const [x, z] = toLocal(p.spec.at[0], p.spec.at[1]);
      // a pin can sit at the back of a deep lot (Agrolima's shed is ~50 m in); beside-another
      // ones move by a couple of frontages
      expect(Math.hypot(p.x - x, p.z - z)).toBeLessThan(55);
    }
  });
  it('no lot reaches into a roadway', () => {
    const bad: string[] = [];
    for (const p of placed) for (const [x, z] of lotPoints(p)) if (clearance(x, z) < -.05) bad.push(`${p.spec.id} @${x.toFixed(1)},${z.toFixed(1)}`);
    expect([...new Set(bad.map(b => b.split(' ')[0]))]).toEqual([]);
  });
  it('lots never overlap each other, a game place, the Matriz squares or the surveyed street', () => {
    const bad: string[] = [];
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++)
      if (overlap(corners(placed[i]), corners(placed[j]))) bad.push(`${placed[i].spec.id} × ${placed[j].spec.id}`);
    for (const p of placed) for (const id of Object.keys(ALL_LOTS) as LotId[])
      if (overlap(corners(p), lotRect(id))) bad.push(`${p.spec.id} × lot ${id}`);
    for (const p of placed) for (const sq of Object.values(SQUARES)) {
      const c = Math.cos(sq.rot), s = Math.sin(sq.rot);
      const rect = [[sq.u0, sq.v0], [sq.u1, sq.v0], [sq.u1, sq.v1], [sq.u0, sq.v1]].map(([u, v]) => [sq.x + u * c - v * s, sq.z + u * s + v * c] as P2);
      if (overlap(corners(p), rect)) bad.push(`${p.spec.id} × square`);
    }
    const jam = new Set(STREETS.map(s => s.rua));
    for (const p of placed) if (jam.has(p.road)) bad.push(`${p.spec.id} on a surveyed street`);
    expect(bad).toEqual([]);
  });
  it('every business builds (Node: blank sign canvases) within its lot', () => {
    for (const p of placed) {
      const g = buildLoja({ w: p.w, f: { ...p.spec.f, d: p.d - (p.spec.f.setback ?? 0) }, shop: p.spec.shop, kind: p.spec.kind, seed: 3 });
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g);
      expect(b.max.x - b.min.x).toBeLessThan(p.w + 4);
      expect(b.max.y).toBeLessThan(16);
      expect(b.max.z).toBeLessThan(6);                 // awnings, totems and bollards stay on the sidewalk
    }
  });
  it('every second-pass detail belongs to a surveyed business', () => {
    const ids = new Set(LOJAS.map(l => l.id));
    expect(Object.keys(DETALHES).filter(k => !ids.has(k))).toEqual([]);
  });
  it('the town has its supermarkets, banks and shops', () => {
    const k = (t: string): number => LOJAS.filter(l => l.kind === t).length;
    expect(k('supermercado')).toBeGreaterThanOrEqual(12);
    expect(k('banco')).toBeGreaterThanOrEqual(6);
    expect(k('loja') + k('farmacia') + k('construcao')).toBeGreaterThanOrEqual(45);
    expect(D.roads.length).toBeGreaterThan(100);
  });
});
