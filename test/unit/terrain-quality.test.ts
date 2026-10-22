// Divinolândia's relief, as driven and built on (src/js/world/divinolandia/data.ts and
// ground-fit.ts). Guards the street grading (level cross-section, no kinks), that a car
// posed anywhere on a street never cuts into it, and that every generated house is seated
// with no wall floating over the ground. tools/terrain-report.ts prints the same numbers.
import { describe, it, expect } from 'vitest';
import { divData as D, divinoHeight as H, DIV_OX, DIV_OZ, PLAY } from '../../src/js/world/divinolandia/data.ts';
import { SITE_TABLE, SITE_PAD, SITE_BLEND } from '../../src/js/world/divinolandia/sites-table.ts';

// A few streets run across the levelled lots of the game's places (the Hospital Regional's
// campus, the Prefeitura's porch on Rua XV): there the lot's flat floor wins over the
// street grade by design, so those stretches are not judged as street.
const onPlaceLot = (x: number, z: number) => Object.values(SITE_TABLE).some(s => {
  const fx = Math.sin(s.face), fz = Math.cos(s.face), dx = x - DIV_OX - s.x, dz = z - DIV_OZ - s.z;
  const m = (s.pad ?? SITE_PAD) + (s.blend ?? SITE_BLEND);
  return Math.abs(dx * fz - dz * fx) < s.w / 2 + m && Math.abs(dx * fx + dz * fz) < s.d / 2 + m;
});
import { groundRange, fitBuilding, rect } from '../../src/js/world/divinolandia/ground-fit.ts';
import { poseOnGround } from '../../src/js/actors/vehicle-ground.ts';

const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

describe('graded streets', () => {
  const cross: number[] = [], kink: number[] = [];
  let pen = 0;
  for (const r of D.roads) {
    if (!r.p) continue;
    for (let i = 1; i < r.pts.length; i++) {
      const ax = r.pts[i - 1][0] + DIV_OX, az = r.pts[i - 1][1] + DIV_OZ, bx = r.pts[i][0] + DIV_OX, bz = r.pts[i][1] + DIV_OZ;
      const len = Math.hypot(bx - ax, bz - az); if (len < .5) continue;
      const fx = (bx - ax) / len, fz = (bz - az) / len, nx = -fz, nz = fx;
      for (let s = 0; s <= len; s += 3) {
        const x = ax + fx * s, z = az + fz * s;
        if (x < PLAY.x0 || x > PLAY.x1 || z < PLAY.z0 || z > PLAY.z1 || onPlaceLot(x, z)) continue;
        cross.push(Math.abs(H(x + nx * r.hw, z + nz * r.hw) - H(x - nx * r.hw, z - nz * r.hw)) / (2 * r.hw));
        kink.push(Math.abs((H(x + fx * 4, z + fz * 4) - H(x, z)) / 4 - (H(x, z) - H(x - fx * 4, z - fz * 4)) / 4));
        for (const d of [1, -1]) pen = Math.max(pen, poseOnGround(H, x + nx * r.hw * .45 * d, z + nz * r.hw * .45 * d, Math.atan2(fx * d, fz * d)).penetration);
      }
    }
  }
  it('are level across (no street leaning sideways)', () => {
    expect(pct(cross, .5)).toBeLessThan(.01);
    expect(pct(cross, .95)).toBeLessThan(.08);
    expect(Math.max(...cross)).toBeLessThan(.3);       // only inside junctions
  });
  it('have no kinks along the way', () => {
    expect(pct(kink, .95)).toBeLessThan(.05);
    expect(Math.max(...kink)).toBeLessThan(.35);       // (the odd junction where a square's patch meets a street)
  });
  it('carry a car anywhere without it cutting into the ground', () => {
    expect(pen).toBeLessThanOrEqual(1e-9);
  });
});

describe('seating buildings', () => {
  it('finds the exact lowest/highest ground under a footprint (never above a dense sampling)', () => {
    for (const [x, z, w, d, rot] of D.houses.slice(0, 200)) {
      const poly = rect(x + DIV_OX, z + DIV_OZ, w, d, rot);
      const exact = groundRange(poly);
      let lo = 1e9, hi = -1e9;
      for (let a = 0; a <= 1; a += .05) for (let b = 0; b <= 1; b += .05) {
        const [p0, p1, , p3] = poly;
        const px = p0[0] + (p1[0] - p0[0]) * a + (p3[0] - p0[0]) * b, pz = p0[1] + (p1[1] - p0[1]) * a + (p3[1] - p0[1]) * b;
        const h = H(px, pz); lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      expect(exact.min).toBeLessThanOrEqual(lo + 1e-6);
      expect(exact.max).toBeGreaterThanOrEqual(hi - 1e-6);
      expect(lo - exact.min).toBeLessThan(.25);          // and it is a real point of the ground, not a guess
    }
  });
  it('seats every generated house with its base below all the ground under it', () => {
    for (const [x, z, w, d, rot] of D.houses) {
      const wx = x + DIV_OX, wz = z + DIV_OZ, c = Math.cos(rot), s = Math.sin(rot);
      const fit = fitBuilding(rect(wx, wz, w, d, rot), [wx - s * d / 2, wz + c * d / 2], { footing: .6, maxBuried: 3.5 });
      expect(fit.base).toBeLessThan(fit.low);            // no wall floats over a dip
      expect(fit.buried).toBeLessThanOrEqual(3.5 + 1e-9); // the uphill wall is cut in at most a storey
    }
  });
});
