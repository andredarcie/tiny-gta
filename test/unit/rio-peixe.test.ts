// The Rio do Peixe as a navigable river (src/js/world/divinolandia/data.ts RIO / RIO_BRIDGES,
// water.ts) and the boat race laid out on it (src/js/activities/boat-course.ts): a boat can
// run its whole length inside the play area, the bridges carry their streets with room for
// a boat underneath, and every race course — the buoys, the mines, the rivals' path, the
// start — lies in deep water, clear of the bridges.
import { describe, it, expect } from 'vitest';
import { RIO, RIO_BRIDGES, RIO_CLEAR, PLAY, divinoHeight, bedHeight, rioHalfWidth } from '../../src/js/world/divinolandia/data.ts';
import { riverAt, RIVER_LEN, deepWater, waterSurface, BOAT_MOOR_S } from '../../src/js/world/divinolandia/water.ts';
import { buildCourse, CP_COUNT, SPAN } from '../../src/js/activities/boat-course.ts';
import { obbsNear } from '../../src/js/world/divinolandia/collide.ts';

const inPlay = (x: number, z: number) => x > PLAY.x0 && x < PLAY.x1 && z > PLAY.z0 && z < PLAY.z1;
function rng(seed: number) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

describe('the Rio do Peixe', () => {
  it('runs downhill and is deep water all along its course in the play area (a boat crosses the town)', () => {
    for (let i = 1; i < RIO.y.length; i++) expect(RIO.y[i]).toBeLessThanOrEqual(RIO.y[i - 1] + 1e-9);
    const dry: number[] = [];
    let sampled = 0;
    for (let s = 0; s <= RIVER_LEN; s += 2) {
      const r = riverAt(s);
      if (!inPlay(r.x, r.z)) continue;
      sampled++;
      const w = rioHalfWidth(s) * .6;
      for (const o of [-w, 0, w]) if (!deepWater(r.x - r.dz * o, r.z + r.dx * o)) { dry.push(s); break; }
    }
    expect(sampled).toBeGreaterThan(2500);
    expect(dry).toEqual([]);
  });
  it('is crossed by its streets on bridges with room for a boat beneath', () => {
    expect(RIO_BRIDGES.length).toBeGreaterThanOrEqual(5);
    for (const b of RIO_BRIDGES) {
      const r = riverAt(b.s), water = waterSurface(r.x, r.z)!;
      expect(water).not.toBeNull();
      // the deck carries the street (cars rest on it) ...
      expect(divinoHeight(b.cx, b.cz)).toBeGreaterThanOrEqual(water + RIO_CLEAR - .01);
      // ... and the river runs open beneath it, deep enough to float a boat
      expect(bedHeight(r.x, r.z)).toBeLessThan(water - .5);
      expect(deepWater(r.x, r.z)).toBe(true);
    }
  });
  it('keeps the bridges\' rails over the deck only (a boat under them collides with nothing)', () => {
    for (const b of RIO_BRIDGES) {
      const r = riverAt(b.s);
      const rails = obbsNear(r.x, r.z, 12).filter(o => o.tag === 'ponte');
      // (collide.ts is filled by the town build, which these tests do not run: nothing here)
      expect(rails.length).toBe(0);
    }
  });
});

describe('the boat race course', () => {
  const courses = [buildCourse(BOAT_MOOR_S, rng(1))];
  for (let k = 0; k < 40; k++) courses.push(buildCourse(rng(100 + k)() * RIVER_LEN, rng(200 + k)));
  it('runs downstream over a whole stretch of river', () => {
    for (const c of courses) {
      expect(c.route.length).toBe(CP_COUNT);
      expect(c.s0).toBeGreaterThanOrEqual(0);
      expect(c.s0 + SPAN).toBeLessThanOrEqual(RIVER_LEN);
      for (let k = 1; k < c.arcs.length; k++) expect(c.arcs[k]).toBeGreaterThan(c.arcs[k - 1]);
    }
  });
  it('puts the start, every buoy and every mine in deep water inside the play area, clear of the bridges', () => {
    const bad: string[] = [];
    for (const c of courses) {
      for (const [name, p] of [['start', c.start], ...c.route.map((p, k) => [`buoy ${k}`, p] as const), ...c.mines.map((m, k) => [`mine ${k}`, m] as const)] as const) {
        if (!deepWater(p.x, p.z) || !inPlay(p.x, p.z)) bad.push(`${c.s0.toFixed(0)} ${name}`);
        if (RIO_BRIDGES.some(b => Math.hypot(b.cx - p.x, b.cz - p.z) < b.L + 6)) bad.push(`${c.s0.toFixed(0)} ${name} under a bridge`);
      }
      for (const m of c.mines) if (!deepWater(m.dx, m.dz)) bad.push(`${c.s0.toFixed(0)} mine sidestep`);
    }
    expect(bad).toEqual([]);
  });
  it('gives the rivals a path that never leaves the water (they follow the river\'s bends)', () => {
    const bad: string[] = [];
    for (const c of courses) {
      const path = [c.start, ...c.npcPath];
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i], L = Math.hypot(b.x - a.x, b.z - a.z);
        for (let t = 0; t <= L; t += 1) {
          const x = a.x + (b.x - a.x) * t / L, z = a.z + (b.z - a.z) * t / L;
          if (!deepWater(x, z)) { bad.push(`${c.s0.toFixed(0)} wp ${i}`); break; }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
