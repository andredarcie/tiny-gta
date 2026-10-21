// The game's places on Divinolândia: regions, the levelled lots (sites-table.ts), the
// river as gameplay water (water.ts).
import { describe, it, expect } from 'vitest';
import { regionAt, mapRegionLabels, isRuralAt } from '@/world/regions.ts';
import { divData, divinoHeight, SITE_FLOOR, DIV_OX, DIV_OZ, PLAY } from '@/world/divinolandia/data.ts';
import { SITE_TABLE, onSiteLot, type SiteId } from '@/world/divinolandia/sites-table.ts';
import { waterSurface, deepWater, riverAt, riverArcAt, RIVER_LEN, BOAT_MOOR_S } from '@/world/divinolandia/water.ts';
import { nearestRoad } from '@/world/divinolandia/nav.ts';

const W = (p: number[]): [number, number] => [p[0] + DIV_OX, p[1] + DIV_OZ];
const L = divData.landmarks;

describe('regions of the town', () => {
  it('names the centre, the landmarks and the countryside', () => {
    expect(regionAt(...W([0, 0]))).toBe('Centro');
    expect(regionAt(...W(L.torre))).toBe('Morro da Torre');
    expect(regionAt(...W(L.hospital))).toBe('Hospital Regional');
    expect(regionAt(...W([-1300, 1500]))).toBe('Zona Rural');
  });
  it('the centre is built-up, the serra is countryside', () => {
    expect(isRuralAt(...W([0, 0]))).toBe(false);
    expect(isRuralAt(...W([200, 1700]))).toBe(true);
  });
  it('has map labels for every neighbourhood', () => {
    expect(mapRegionLabels.filter(l => l.kind === 'city').length).toBe(4);
  });
});

describe('place lots (sites-table.ts)', () => {
  const ids = Object.keys(SITE_TABLE) as SiteId[];
  it('every lot is levelled flat at its floor height', () => {
    for (const id of ids) {
      const s = SITE_TABLE[id], fx = Math.sin(s.face), fz = Math.cos(s.face), ux = fz, uz = -fx;
      for (const [a, b] of [[0, 0], [.9, .9], [-.9, .9], [.9, -.9], [-.9, -.9]]) {
        const x = s.x + DIV_OX + ux * a * s.w / 2 + fx * b * s.d / 2, z = s.z + DIV_OZ + uz * a * s.w / 2 + fz * b * s.d / 2;
        expect(Math.abs(divinoHeight(x, z) - SITE_FLOOR[id])).toBeLessThan(.05);
      }
    }
  });
  it('lots sit inside the playable area and do not overlap each other', () => {
    for (const id of ids) {
      const s = SITE_TABLE[id];
      expect(s.x + DIV_OX).toBeGreaterThan(PLAY.x0); expect(s.x + DIV_OX).toBeLessThan(PLAY.x1);
      expect(s.z + DIV_OZ).toBeGreaterThan(PLAY.z0); expect(s.z + DIV_OZ).toBeLessThan(PLAY.z1);
      for (const o of ids) if (o !== id)
        expect(Math.hypot(s.x - SITE_TABLE[o].x, s.z - SITE_TABLE[o].z)).toBeGreaterThan((Math.max(s.w, s.d) + Math.max(SITE_TABLE[o].w, SITE_TABLE[o].d)) / 2);
    }
  });
  it('the town shops face a street close by, and no street runs through a lot', () => {
    for (const id of ['club', 'gym', 'gunShop', 'clothes', 'workshop', 'prison', 'genStore'] as SiteId[]) {
      const s = SITE_TABLE[id];
      const front = W([s.x + Math.sin(s.face) * (s.d / 2 + 2), s.z + Math.cos(s.face) * (s.d / 2 + 2)]);
      expect(nearestRoad(front[0], front[1], 12)).not.toBeNull();
      const c = nearestRoad(s.x + DIV_OX, s.z + DIV_OZ, 60)!;
      expect(c.d).toBeGreaterThan(Math.min(s.w, s.d) / 2);
      expect(onSiteLot(s.x, s.z)).toBe(true);
    }
  });
});

describe('the Rio do Peixe as water', () => {
  it('has a long course that always runs downhill', () => {
    expect(RIVER_LEN).toBeGreaterThan(4000);
    let prev = Infinity;
    for (let s = 0; s <= RIVER_LEN; s += 100) { const y = riverAt(s).y; expect(y).toBeLessThanOrEqual(prev + 1e-6); prev = y; }
  });
  it('is deep enough to swim and float a boat mid-channel, not on the bank', () => {
    let deep = 0, n = 0;
    for (let s = 200; s < RIVER_LEN - 200; s += 150) {
      const r = riverAt(s); n++;
      if (deepWater(r.x, r.z)) deep++;
      expect(waterSurface(r.x, r.z)).not.toBeNull();
      // 20 m to the side is bank — unless a tight meander brings the course back there
      const bx = r.x - r.dz * 20, bz = r.z + r.dx * 20;
      if (riverArcAt(bx, bz).d > 8) expect(deepWater(bx, bz)).toBe(false);
    }
    expect(deep / n).toBeGreaterThan(.7);
  });
  it('the moored boat sits on the river by the town', () => {
    const r = riverAt(BOAT_MOOR_S);
    expect(riverArcAt(r.x, r.z).d).toBeLessThan(.5);
    expect(Math.hypot(r.x - DIV_OX, r.z - DIV_OZ)).toBeLessThan(800);
  });
});
