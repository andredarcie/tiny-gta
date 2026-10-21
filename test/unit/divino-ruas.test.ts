// The surveyed streets' lots (ruas/*.ts) against everything else that stands in town: the
// game's lots, the Matriz squares, the squares and public buildings rebuilt from Street
// View, the generated houses. A lot overlaps none of them.
import { describe, it, expect } from 'vitest';
import { divData as D } from '@/world/divinolandia/data.ts';
import { STREETS } from '@/world/divinolandia/ruas/index.ts';
import { alongPolyline, sideNormal, SIDEWALK } from '@/world/divinolandia/ruas/build-rua.ts';
import { ALL_LOTS, SQUARES, type LotId } from '@/world/divinolandia/sites-table.ts';
import { PUBLICOS } from '../../src/assets/models/divinolandia/publicos.ts';
import { PRACAS } from '../../src/assets/models/divinolandia/pracas-centro.ts';

type P2 = [number, number];
function overlap(a: P2[], b: P2[]): boolean {
  for (const poly of [a, b]) for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], nx = q[1] - p[1], nz = p[0] - q[0];
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const v of a) { const d = v[0] * nx + v[1] * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const v of b) { const d = v[0] * nx + v[1] * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 <= b0 + .05 || b1 <= a0 + .05) return false;
  }
  return true;
}
const pip = (x: number, z: number, p: P2[]): boolean => { let i = false; for (let a = 0, b = p.length - 1; a < p.length; b = a++) { const [xa, za] = p[a], [xb, zb] = p[b]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) i = !i; } return i; };
const rect = (x: number, z: number, w: number, d: number, r: number): P2[] => { const c = Math.cos(r), s = Math.sin(r); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [x + u * w / 2 * c - v * d / 2 * s, z + u * w / 2 * s + v * d / 2 * c] as P2); };

const lots: { id: string; r: P2[] }[] = [];
for (const spec of STREETS) {
  const pts: P2[] = [];
  for (const r of D.roads) if (r.n === spec.rua) for (const q of r.pts) { const l = pts[pts.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > .5) pts.push([q[0], q[1]]); }
  const hw = D.roads.find(r => r.n === spec.rua)!.hw;
  for (const lot of spec.lots) {
    const w = lot.s1 - lot.s0 - .1, f = alongPolyline(pts, (lot.s0 + lot.s1) / 2), [nx, nz] = sideNormal(f, lot.side), d = (lot.f.d ?? 12) + (lot.f.setback ?? 0), o = hw + SIDEWALK;
    lots.push({ id: `${spec.rua} ${lot.side} ${lot.s0}`, r: [[-w / 2, 0], [w / 2, 0], [w / 2, d], [-w / 2, d]].map(([u, v]) => [f.x + f.ux * u + nx * (o + v), f.z + f.uz * u + nz * (o + v)] as P2) });
  }
}

describe('surveyed street lots', () => {
  it('overlap no game lot, square, public building or rebuilt plaza', () => {
    const bad: string[] = [];
    for (const l of lots) {
      for (const id of Object.keys(ALL_LOTS) as LotId[]) { const s = ALL_LOTS[id]; if (overlap(l.r, rect(s.x, s.z, s.w, s.d, -s.face))) bad.push(`${l.id} × ${id}`); }
      for (const [k, sq] of Object.entries(SQUARES)) { const c = Math.cos(sq.rot), s = Math.sin(sq.rot);
        if (overlap(l.r, [[sq.u0, sq.v0], [sq.u1, sq.v0], [sq.u1, sq.v1], [sq.u0, sq.v1]].map(([u, v]) => [sq.x + u * c - v * s, sq.z + u * s + v * c] as P2))) bad.push(`${l.id} × square ${k}`); }
      for (const p of PUBLICOS) for (const [x, z, w, d, r] of p.foot) if (overlap(l.r, rect(x, z, w, d, r))) bad.push(`${l.id} × ${p.id}`);
      for (const p of PRACAS) { const poly = D.plazas.find(q => q.n === p.osm)?.pts as P2[] | undefined; if (poly && l.r.some(([x, z]) => pip(x, z, poly))) bad.push(`${l.id} × ${p.id}`); }
    }
    expect(bad).toEqual([]);
  });
  it('no generated house stands on a surveyed lot', () => {
    const bad: string[] = [];
    for (const l of lots) for (const [x, z, w, d, r] of D.houses) if (Math.hypot(x - l.r[0][0], z - l.r[0][1]) < 40 && overlap(l.r, rect(x, z, w, d, r))) bad.push(`${l.id} × house @${x},${z}`);
    expect(bad).toEqual([]);
  });
});
