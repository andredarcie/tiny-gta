// The four fuel stations and the Monumento ao Ciclista rebuilt from Street View
// (src/assets/models/divinolandia/posto-*.ts, monumento-ciclista.ts):
// they build on the real terrain, stay inside their lots, keep their buildings, islands and
// columns off every roadway, and their lots don't collide with the game's other places.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { divData as D, divinoHeight, nearGrid, DIV_OX, DIV_OZ } from '@/world/divinolandia/data.ts';
import { ALL_LOTS, DRAPED_LOTS, type LotId } from '@/world/divinolandia/sites-table.ts';
import type { GroundAt } from '../../src/assets/models/divinolandia/praca-chao.ts';
import Triangulo, { ORIGIN as TRI_O, POSTO_FOOT as TRI_F } from '../../src/assets/models/divinolandia/posto-triangulo.ts';
import Passoni, { ORIGIN as PAS_O, POSTO_FOOT as PAS_F } from '../../src/assets/models/divinolandia/posto-passoni.ts';
import Lurain, { ORIGIN as LUR_O, POSTO_FOOT as LUR_F } from '../../src/assets/models/divinolandia/posto-lurain.ts';
import Taurus, { ORIGIN as TAU_O, POSTO_FOOT as TAU_F } from '../../src/assets/models/divinolandia/posto-taurus.ts';
import TaurusCentro, { ORIGIN as TC_O, POSTO_FOOT as TC_F } from '../../src/assets/models/divinolandia/posto-taurus-centro.ts';
import Monumento, { ORIGIN as MON_O, MONUMENTO_FOOT as MON_F } from '../../src/assets/models/divinolandia/monumento-ciclista.ts';
import { PLAY } from '@/world/divinolandia/data.ts';
import Entorno, { ORIGIN as ENT_O, ENTORNO_FOOT as ENT_F } from '../../src/assets/models/divinolandia/entorno-ciclista.ts';
import Mahindra, { ORIGIN as MAH_O, MAHINDRA_FOOT as MAH_F } from '../../src/assets/models/divinolandia/concessionaria-mahindra.ts';

type P2 = [number, number];
const STATIONS = [
  { lot: 'postoTriangulo', model: Triangulo, origin: TRI_O, foot: TRI_F },
  { lot: 'postoPassoni', model: Passoni, origin: PAS_O, foot: PAS_F },
  { lot: 'postoLurain', model: Lurain, origin: LUR_O, foot: LUR_F },
  { lot: 'postoTaurus', model: Taurus, origin: TAU_O, foot: TAU_F },
  { lot: 'postoTaurusCentro', model: TaurusCentro, origin: TC_O, foot: TC_F },
  { lot: 'monumentoCiclista', model: Monumento, origin: MON_O, foot: MON_F },
] as const;
const H = (x: number, z: number): number => divinoHeight(x + DIV_OX, z + DIV_OZ);
const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number): number => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
};

describe('fuel stations (posto-*.ts)', () => {
  it('build on the real terrain and stay within their lots', () => {
    for (const s of STATIONS) {
      const y0 = H(...s.origin);
      const at: GroundAt = (x, z) => H(x, z) - y0;
      at.grid = [(x, _z) => (x + DIV_OX - nearGrid.x0) / nearGrid.cell, (_x, z) => (z + DIV_OZ - nearGrid.z0) / nearGrid.cell];
      const g = s.model.build({ groundAt: at });
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g), L = DRAPED_LOTS[s.lot];
      // the aprons run out to the kerbs, so a few metres past the lot
      expect(b.min.x + s.origin[0]).toBeGreaterThan(L.x - L.w / 2 - 12);
      expect(b.max.x + s.origin[0]).toBeLessThan(L.x + L.w / 2 + 12);
      expect(b.min.z + s.origin[1]).toBeGreaterThan(L.z - L.d / 2 - 12);
      expect(b.max.z + s.origin[1]).toBeLessThan(L.z + L.d / 2 + 12);
      expect(b.max.y).toBeLessThan(14);                 // nothing flies off: canopies ~6 m, two storeys ~10 m
      expect(b.min.y).toBeGreaterThan(-8);
      let n = 0; g.traverse(o => { if ((o as THREE.Mesh).isMesh) n++; });
      expect(n).toBeGreaterThan(40);
    }
  });
  it('keep buildings, islands and columns off every roadway', () => {
    const bad: string[] = [];
    for (const s of STATIONS) for (const [x, z, w, d, rot] of s.foot) {
      const c = Math.cos(rot), sn = Math.sin(rot);
      for (let a = -.5; a <= .5; a += .1) for (let k = -.5; k <= .5; k += .1) {
        const px = x + a * w * c - k * d * sn, pz = z + a * w * sn + k * d * c;
        for (const r of D.roads) for (let i = 1; i < r.pts.length; i++) {
          const dist = segDist(px, pz, r.pts[i - 1][0], r.pts[i - 1][1], r.pts[i][0], r.pts[i][1]);
          if (dist < r.hw - .05) bad.push(`${s.lot} box@${x},${z} on ${r.n || r.k} (${dist.toFixed(2)} m)`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
  it('can be reached: every lot lies inside the playable box', () => {
    for (const id of Object.keys(DRAPED_LOTS) as (keyof typeof DRAPED_LOTS)[]) {
      const L = DRAPED_LOTS[id];
      expect(L.x + L.w / 2 + DIV_OX).toBeLessThan(PLAY.x1); expect(L.x - L.w / 2 + DIV_OX).toBeGreaterThan(PLAY.x0);
      expect(L.z + L.d / 2 + DIV_OZ).toBeLessThan(PLAY.z1); expect(L.z - L.d / 2 + DIV_OZ).toBeGreaterThan(PLAY.z0);
    }
  });
  it('their lots overlap no other place', () => {
    const ids = Object.keys(ALL_LOTS) as LotId[];
    for (const id of Object.keys(DRAPED_LOTS) as LotId[]) {
      const s = ALL_LOTS[id];
      for (const o of ids) if (o !== id)
        expect(Math.hypot(s.x - ALL_LOTS[o].x, s.z - ALL_LOTS[o].z)).toBeGreaterThan((Math.max(s.w, s.d) + Math.max(ALL_LOTS[o].w, ALL_LOTS[o].d)) / 2);
    }
  });
  it('stand where the real stations are (Google Maps places, town-local metres)', () => {
    const LAT0 = D.lat0, LON0 = D.lon0, MX = D.mx, MZ = D.mz;
    const real: Record<string, P2> = {
      postoTriangulo: [-21.6619478, -46.7342335], postoPassoni: [-21.66075, -46.72835],
      postoLurain: [-21.6600693, -46.726942], postoTaurus: [-21.6576741, -46.7387521],
      monumentoCiclista: [-21.6605515, -46.7250474],
    };
    for (const [id, [lat, lng]] of Object.entries(real)) {
      const L = DRAPED_LOTS[id as keyof typeof DRAPED_LOTS], x = (lng - LON0) * MX, z = (LAT0 - lat) * MZ;
      expect(Math.hypot(x - L.x, z - L.z)).toBeLessThan(Math.max(L.w, L.d) / 2 + 2);
    }
  });
});

describe('the surroundings of the Monumento ao Ciclista (entorno-ciclista.ts, concessionaria-mahindra.ts)', () => {
  const PARTS = [
    { name: 'entorno', model: Entorno, origin: ENT_O, foot: ENT_F },
    { name: 'mahindra', model: Mahindra, origin: MAH_O, foot: MAH_F },
  ];
  it('build on the real terrain', () => {
    for (const p of PARTS) {
      const y0 = H(...p.origin);
      const at: GroundAt = (x, z) => H(x, z) - y0;
      const g = p.model.build({ groundAt: at });
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g);
      expect(b.max.y).toBeLessThan(16); expect(b.min.y).toBeGreaterThan(-10);
      expect(b.max.x - b.min.x).toBeLessThan(140);
    }
  });
  it('keep every building, wall, tree and pole off the roadways and out of the square', () => {
    const bad: string[] = [];
    for (const p of PARTS) for (const [x, z, w, d, rot] of p.foot) {
      const c = Math.cos(rot), sn = Math.sin(rot);
      for (let a = -.5; a <= .5; a += .1) for (let k = -.5; k <= .5; k += .25) {
        const px = x + a * w * c - k * d * sn, pz = z + a * w * sn + k * d * c;
        for (const r of D.roads) for (let i = 1; i < r.pts.length; i++) {
          const dist = segDist(px, pz, r.pts[i - 1][0], r.pts[i - 1][1], r.pts[i][0], r.pts[i][1]);
          if (dist < r.hw - .05) bad.push(`${p.name} box@${x.toFixed(1)},${z.toFixed(1)} on ${r.n || r.k}`);
        }
        if (Math.hypot(px - MON_O[0], pz - MON_O[1]) < 11 && (px - MON_O[0]) * -.461 + (pz - MON_O[1]) * -.887 > 0) bad.push(`${p.name} box@${x},${z} in the square`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});
