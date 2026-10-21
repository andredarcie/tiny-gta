// Divinolândia geometry: what the bake places and what build.ts draws must not cut into
// each other — houses off the streets, sidewalks, mapped grounds and other buildings; no
// wood on a pitch; water that meets its banks and never runs over a road; streets that lie
// on the terrain; poles at the kerb, not in the roadway.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import { divData as D, divinoHeight, nearGrid, DIV_OX, DIV_OZ } from '@/world/divinolandia/data.ts';
import { waterLines, waterSurface } from '@/world/divinolandia/water.ts';
import { planRoadPoles } from '@/world/divinolandia/postes-rua.ts';
import { STREETS } from '@/world/divinolandia/ruas/index.ts';
import { alongPolyline, sideNormal, SIDEWALK } from '@/world/divinolandia/ruas/build-rua.ts';
import { makeStreets } from '../../src/assets/models/divinolandia/rua.ts';
import { makeSurface } from '../../src/assets/models/divinolandia/praca.ts';

type P2 = [number, number];
const SURVEYED = new Set(STREETS.map(s => s.rua));
const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number): number => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
};
function pip(p: P2, poly: number[][]): boolean {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}
// a w×d rectangle (local +x along (cos rot, sin rot)) as sample points ≤ 1 m apart
function samples(x: number, z: number, w: number, d: number, rot: number): P2[] {
  const c = Math.cos(rot), s = Math.sin(rot), nu = Math.ceil(w), nv = Math.ceil(d), out: P2[] = [];
  for (let a = 0; a <= nu; a++) for (let b = 0; b <= nv; b++) {
    const u = (a / nu - .5) * w, v = (b / nv - .5) * d;
    out.push([x + u * c - v * s, z + u * s + v * c]);
  }
  return out;
}
const corners = (x: number, z: number, w: number, d: number, rot: number): P2[] => {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [x + u * w / 2 * c - v * d / 2 * s, z + u * w / 2 * s + v * d / 2 * c] as P2);
};
function overlap(a: P2[], b: P2[], tol = .02): boolean {
  for (const poly of [a, b]) for (let i = 0; i < 4; i++) {
    const p = poly[i], q = poly[(i + 1) % 4], nx = q[1] - p[1], nz = p[0] - q[0], l = Math.hypot(nx, nz);
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const v of a) { const d = (v[0] * nx + v[1] * nz) / l; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const v of b) { const d = (v[0] * nx + v[1] * nz) / l; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 <= b0 + tol || b1 <= a0 + tol) return false;
  }
  return true;
}

// road segments (town-local) with the band a building must keep clear: the roadway, plus
// the 2.1 m sidewalk build.ts lays along the paved town streets
const segs = D.roads.flatMap(r => {
  const band = r.hw + (r.p && r.k !== 'primary' && r.k !== 'primary_link' && !SURVEYED.has(r.n) ? 2.05 : .25);
  return r.pts.slice(1).map((p, i) => ({ ax: r.pts[i][0], az: r.pts[i][1], bx: p[0], bz: p[1], hw: r.hw, band, name: r.n }));
});
const SC = 24, segHash = new Map<string, typeof segs>();
for (const g of segs) {
  const m = g.band + 2;
  for (let a = Math.floor((Math.min(g.ax, g.bx) - m) / SC); a <= Math.floor((Math.max(g.ax, g.bx) + m) / SC); a++)
    for (let b = Math.floor((Math.min(g.az, g.bz) - m) / SC); b <= Math.floor((Math.max(g.az, g.bz) + m) / SC); b++) {
      const k = a + '_' + b; let arr = segHash.get(k); if (!arr) { arr = []; segHash.set(k, arr); } arr.push(g);
    }
}
const nearSegs = (x: number, z: number): typeof segs => segHash.get(Math.floor(x / SC) + '_' + Math.floor(z / SC)) || [];
const grounds = [...D.plazas, ...D.areas];

describe('generated houses keep to their lots', () => {
  it('stay off every roadway and town sidewalk', () => {
    const bad: string[] = [];
    for (const [x, z, w, d, rot] of D.houses)
      for (const [px, pz] of samples(x, z, w, d, rot))
        if (nearSegs(px, pz).some(g => segDist(px, pz, g.ax, g.az, g.bx, g.bz) < g.band - .1)) { bad.push(`${x},${z}`); break; }
    expect(bad).toEqual([]);
  });
  it('stay off the plazas, pitches, schools and the cemetery', () => {
    const bad: string[] = [];
    for (const [x, z, w, d, rot] of D.houses) {
      const pts = samples(x, z, w, d, rot);
      for (const g of grounds) if (g.k !== 'hospital' && g.k !== 'torre' && pts.filter(p => pip(p, g.pts)).length > 1) bad.push(`${x},${z} in ${g.k} ${g.n}`);
    }
    expect(bad).toEqual([]);
  });
  it('never overlap each other, a mapped building or a cell tower', () => {
    const boxes = D.houses.map(([x, z, w, d, rot]) => corners(x, z, w, d, rot));
    let clashes = 0;
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++)
      if (Math.hypot(D.houses[a][0] - D.houses[b][0], D.houses[a][1] - D.houses[b][1]) < 22 && overlap(boxes[a], boxes[b])) clashes++;
    expect(clashes).toBe(0);
    const solid = [...D.buildings.map(b => corners(b.cx, b.cz, Math.max(8, b.w), Math.max(8, b.d), b.rot)),
      ...D.landmarks.torresCelular.map(([x, z]) => corners(x, z, 4, 4, 0))];
    for (const h of boxes) for (const s of solid) expect(overlap(h, s)).toBe(false);
  });
  it('stand only where a map shows a building (ML footprint, Google Maps, or a zone traced on the satellite)', () => {
    const dir = new URL('../../docs/divinolandia/edificacoes/', import.meta.url);
    const M = JSON.parse(readFileSync(new URL('construido-1m-meta.json', dir), 'utf8'));
    const built = gunzipSync(readFileSync(new URL('construido-1m.bin.gz', dir)));
    const ghosts: string[] = [];
    for (const [x, z, w, d, rot] of D.houses) {
      const c = Math.cos(rot), s = Math.sin(rot);
      let ms = 0, gm = 0, zone = 0;
      for (let a = 0; a < 9; a++) for (let b = 0; b < 11; b++) {
        const u = (a / 8 - .5) * .84 * w, v = (b / 10 - .5) * .84 * d;
        const k = built[Math.floor(z + u * s + v * c - M.z0) * M.nx + Math.floor(x + u * c - v * s - M.x0)];
        if (k & 1) ms++; if (k & 2) gm++; if (k & 4) zone++;
      }
      if (ms / 99 < .15 && gm / 99 < .15 && zone / 99 < .5) ghosts.push(`${x},${z}`);
    }
    expect(D.houses.length).toBeGreaterThan(2000);
    expect(ghosts).toEqual([]);
  });
  it('keep the door within a short flight of steps of the sidewalk', () => {
    let steep = 0;
    for (const [x, z, w, d, rot] of D.houses) {
      const c = Math.cos(rot), s = Math.sin(rot), W = (u: number, v: number): number => divinoHeight(x + DIV_OX + u * w / 2 * c - v * d / 2 * s, z + DIV_OZ + u * w / 2 * s + v * d / 2 * c);
      const high = Math.max(W(-1, -1), W(1, -1), W(1, 1), W(-1, 1)), front = W(0, 1);
      if (Math.max(front, high - 2.4) - front > 1.3) steep++;              // build.ts floor rule
    }
    expect(steep).toBeLessThan(8);         // (build.ts drops these few: banks left by the site pads)
  });
});

describe('vegetation', () => {
  it('no wood on a pitch, a schoolyard, a plaza pavement or among the graves', () => {
    const banned = grounds.filter(g => g.k === 'campo' || g.k === 'estadio' || g.k === 'escola' || g.k === 'cemiterio' || g.k === 'praca');
    const bad: string[] = [];
    for (let i = 0; i < D.trees.length; i += 3) {
      const p: P2 = [D.trees[i], D.trees[i + 1]];
      for (const g of banned) if (pip(p, g.pts) && !g.pts.some((q, k) => k && segDist(p[0], p[1], g.pts[k - 1][0], g.pts[k - 1][1], q[0], q[1]) < .15)) bad.push(`${p} in ${g.k}`);
    }
    expect(bad).toEqual([]);
  });
  it('coffee rows stand clear of streets, houses, water and the mapped grounds', () => {
    const bad: string[] = [];
    for (let i = 0; i < D.coffee.length; i += 3) {
      const [x, z, yaw] = [D.coffee[i], D.coffee[i + 1], D.coffee[i + 2]], c = Math.cos(yaw), s = Math.sin(yaw);
      for (const o of [-3.4, 0, 3.4]) for (let t = -4.6; t <= 4.6; t += 2.3) {
        const px = x - s * o + c * t, pz = z + c * o + s * t;
        if (nearSegs(px, pz).some(g => segDist(px, pz, g.ax, g.az, g.bx, g.bz) < g.hw + .5)) bad.push(`road ${px},${pz}`);
        if (grounds.some(g => pip([px, pz], g.pts))) bad.push(`ground ${px},${pz}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('water meets its banks', () => {
  it('the drawn edge lies on the bank (or under higher water) almost everywhere', () => {
    let edges = 0, floating = 0;
    for (const w of waterLines) {
      const P = w.pts;
      for (let i = 0; i < P.length; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
        for (const off of [w.wl[i], -w.wr[i]]) {
          if (!w.wl[i] && !w.wr[i]) continue;
          edges++;
          const x = P[i][0] - dz / l * off, z = P[i][1] + dx / l * off, gap = P[i][2] - divinoHeight(x, z);
          const out = waterSurface(x - dz / l * Math.sign(off) * .3, z + dx / l * Math.sign(off) * .3);
          if (gap > .15 && !(out !== null && out >= P[i][2] - .05)) floating++;
        }
      }
    }
    expect(edges).toBeGreaterThan(10000);
    expect(floating / edges).toBeLessThan(.005);
  });
  it('is never drawn over a roadway', () => {
    const bad: string[] = [];
    for (const g of segs) {
      const L = Math.hypot(g.bx - g.ax, g.bz - g.az) || 1;
      for (let t = 0; t <= 1; t += 2 / L) for (const o of [-.8, 0, .8]) {
        const x = g.ax + (g.bx - g.ax) * t - (g.bz - g.az) / L * o * g.hw + DIV_OX, z = g.az + (g.bz - g.az) * t + (g.bx - g.ax) / L * o * g.hw + DIV_OZ;
        if (x < nearGrid.x0 || x > nearGrid.x0 + (nearGrid.nx - 1) * nearGrid.cell || z < nearGrid.z0 || z > nearGrid.z0 + (nearGrid.nz - 1) * nearGrid.cell) continue;
        const y = waterSurface(x, z);
        if (y !== null && y > divinoHeight(x, z) + .12) bad.push(`${g.name} ${(x - DIV_OX).toFixed(0)},${(z - DIV_OZ).toFixed(0)}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('the river is only interrupted by the roads that cross it', () => {
    const rio = waterLines.filter(w => w.river).sort((a, b) => b.pts.length - a.pts.length)[0];
    let run = 0, longest = 0;
    for (let i = 0; i < rio.pts.length; i++) { run = rio.wl[i] + rio.wr[i] > 0 ? 0 : run + 1; longest = Math.max(longest, run); }
    expect(longest * 2).toBeLessThan(30);                                  // points are ~2 m apart
  });
});

describe('streets and grounds lie on the terrain', () => {
  const lift = (o: THREE.Object3D): number => {
    let min = Infinity;
    o.traverse(m => {
      const g = (m as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (!g) return;
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i += 3) for (const [u, v] of [[1 / 3, 1 / 3], [.05, .05], [.9, .05], [.05, .9]]) {
        const w = 1 - u - v;
        const x = p.getX(i) * w + p.getX(i + 1) * u + p.getX(i + 2) * v, y = p.getY(i) * w + p.getY(i + 1) * u + p.getY(i + 2) * v, z = p.getZ(i) * w + p.getZ(i + 1) * u + p.getZ(i + 2) * v;
        min = Math.min(min, y - divinoHeight(x, z));
      }
    });
    return min;
  };
  it('no hill pokes through a street, a sidewalk or a plaza', () => {
    const lines = D.roads.map(r => ({ pts: r.pts.map(p => [p[0] + DIV_OX, p[1] + DIV_OZ] as P2), hw: r.hw, paved: !!r.p, sett: r.sf === 'sett', sidewalk: !!r.p }));
    expect(lift(makeStreets(lines, divinoHeight, nearGrid))).toBeGreaterThan(.09);
    for (const g of grounds) expect(lift(makeSurface('praca', g.pts.map(q => [q[0] + DIV_OX, q[1] + DIV_OZ] as P2), divinoHeight, nearGrid))).toBeGreaterThan(.09);
  });
});

describe('street furniture', () => {
  it('utility poles stand at the kerb, never in a roadway', () => {
    const routes = planRoadPoles({
      roads: D.roads.map(r => ({ name: r.n, pts: r.pts as P2[], halfWidth: r.hw, paved: !!r.p, sidewalk: !!r.p && r.k !== 'primary', enabled: true })),
      houses: D.houses.map(([x, z, width, depth, rotation]) => ({ x, z, width, depth, rotation })), protectedAreas: [], surveyedStreets: [...SURVEYED],
    });
    const bad: string[] = [];
    for (const p of routes.flat()) if (nearSegs(p.x, p.z).some(g => segDist(p.x, p.z, g.ax, g.az, g.bx, g.bz) < g.hw + .2)) bad.push(`${p.x.toFixed(1)},${p.z.toFixed(1)}`);
    expect(routes.flat().length).toBeGreaterThan(500);
    expect(bad).toEqual([]);
  });
  it('the surveyed lots stay off their cross streets', () => {
    for (const spec of STREETS) {
      const pts: P2[] = [];
      for (const r of D.roads) if (r.n === spec.rua) for (const p of r.pts) { const l = pts[pts.length - 1]; if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > .5) pts.push([p[0], p[1]]); }
      const hw = D.roads.find(r => r.n === spec.rua)!.hw;
      for (const lot of spec.lots) {
        const w = lot.s1 - lot.s0 - .1, f = alongPolyline(pts, (lot.s0 + lot.s1) / 2), [nx, nz] = sideNormal(f, lot.side), d = (lot.f.d ?? 12) + (lot.f.setback ?? 0);
        for (let a = -.5; a <= .5; a += .1) for (let b = 0; b <= 1; b += .1) {
          const x = f.x + nx * (hw + SIDEWALK) + f.ux * a * w + nx * b * d, z = f.z + nz * (hw + SIDEWALK) + f.uz * a * w + nz * b * d;
          for (const g of nearSegs(x, z)) if (g.name !== spec.rua) expect(segDist(x, z, g.ax, g.az, g.bx, g.bz)).toBeGreaterThan(g.hw);
        }
      }
    }
  });
});
