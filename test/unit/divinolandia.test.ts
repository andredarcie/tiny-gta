// Divinolândia (the real town): baked data sanity + the physics/visual contract.
import { describe, it, expect } from 'vitest';
import { divData, divinoHeight, nearGrid, altitudeAt, DIV_OX, DIV_OZ, PLAY } from '@/world/divinolandia/data.ts';
import { addObb, divinoCollide, setPlayBounds } from '@/world/divinolandia/collide.ts';
import { groundHeight, setDivinoTerrain, DIVINO_X_MIN } from '@/core/terrain.ts';
import * as THREE from 'three';
import { makeTerrainMesh } from '../../src/assets/models/divinolandia/terreno.ts';
import { makeStreets, makeWater } from '../../src/assets/models/divinolandia/rua.ts';
import { waterLines } from '@/world/divinolandia/water.ts';
import { addCasa, finalizeCasas, casaTop } from '../../src/assets/models/divinolandia/casa.ts';
import { makeTrees, makeCoffee } from '../../src/assets/models/divinolandia/vegetacao.ts';
import { makeSurface, type Surface } from '../../src/assets/models/divinolandia/praca.ts';
import { buildEuclidesSchool, EUCLIDES_SITE } from '../../src/assets/models/divinolandia/escola-euclides.ts';

const W = (p: number[]): [number, number] => [p[0] + DIV_OX, p[1] + DIV_OZ];
const L = divData.landmarks;

describe('Divinolândia relief matches the real town (SRTM)', () => {
  it('Igreja Matriz stands at ~1058 m (IBGE/Wikipedia altitude of the seat)', () => {
    const [x, z] = W([L.matriz.cx, L.matriz.cz]);
    expect(Math.abs(altitudeAt(x, z) - 1058)).toBeLessThan(20);
  });
  it('the hospital is UP the hill from the Matriz, the mirante tower far above both', () => {
    const m = altitudeAt(...W([L.matriz.cx, L.matriz.cz]));
    const h = altitudeAt(...W(L.hospital));
    const t = altitudeAt(...W(L.torre));
    expect(h).toBeGreaterThan(m + 40);
    expect(Math.abs(t - 1380)).toBeLessThan(30);           // "morro da torre, 1380 m"
  });
  it('the Rio do Peixe (beira do rio) runs below the centre and always downhill', () => {
    const m = altitudeAt(...W([L.matriz.cx, L.matriz.cz]));
    const rivers = divData.waters.filter(w => w.name === 'Rio do Peixe');
    expect(rivers.length).toBeGreaterThan(0);
    for (const r of rivers) {
      for (let i = 1; i < r.pts.length; i++) expect(r.pts[i][2]).toBeLessThanOrEqual(r.pts[i - 1][2] + 1e-6);
      expect(Math.min(...r.pts.map(p => p[2])) + divData.ref).toBeLessThan(m);
    }
  });
  it('has the town: thousands of houses, named real streets', () => {
    expect(divData.houses.length).toBeGreaterThan(2000);
    const names = new Set(divData.roads.map(r => r.n));
    for (const n of ['Rua XV de Novembro', 'Avenida Marginal do Rio do Peixe', 'Rua João Darcie']) expect(names.has(n)).toBe(true);
  });
});

describe('Divinolândia ground = the drawn triangles', () => {
  it('returns the node height on grid nodes and the b–c diagonal mean at cell centres', () => {
    const { x0, z0, cell, nx, h } = nearGrid;
    const i = 120, j = 140;
    expect(divinoHeight(x0 + i * cell, z0 + j * cell)).toBeCloseTo(h[j * nx + i], 4);
    const b = h[j * nx + i + 1], c = h[(j + 1) * nx + i];
    expect(divinoHeight(x0 + (i + .5) * cell, z0 + (j + .5) * cell)).toBeCloseTo((b + c) / 2, 4);
  });
  it('plugs into groundHeight east of DIVINO_X_MIN', () => {
    setDivinoTerrain(divinoHeight);
    const [x, z] = W([0, 0]);
    expect(groundHeight(x, z)).toBeCloseTo(divinoHeight(x, z), 6);
    expect(DIVINO_X_MIN).toBeLessThan(PLAY.x0);
    expect(groundHeight(-800, 0)).toBe(0);                  // the off-map rooms stay flat
  });
});

describe('Divinolândia oriented collision', () => {
  it('pushes a body out of a rotated house and keeps it in the playable box', () => {
    setPlayBounds(PLAY);
    const cx = DIV_OX + 300, cz = DIV_OZ + 300, rot = Math.PI / 6;
    addObb(cx, cz, 10, 6, rot, 1e9);
    const p = { x: cx + 1, y: 0, z: cz + 1 };                // inside
    expect(divinoCollide(p, .5)).toBe(true);
    const dx = p.x - cx, dz = p.z - cz, c = Math.cos(rot), s = Math.sin(rot);
    const lu = dx * c + dz * s, lv = -dx * s + dz * c;
    expect(Math.abs(lu) >= 5 + .49 || Math.abs(lv) >= 3 + .49).toBe(true);
    const far = { x: PLAY.x1 + 50, y: 0, z: cz };
    divinoCollide(far, .5);
    expect(far.x).toBe(PLAY.x1);
  });
});

// Geometry smoke test: build the real town's meshes from the baked data in Node (no
// WebGL needed — geometry only) and check nothing is NaN or floating off the ground.
function checkPositions(o: THREE.Object3D, lo: number, hi: number): number {
  let n = 0;
  o.traverse(m => {
    const g = (m as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!g || (m as THREE.InstancedMesh).isInstancedMesh) return;
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (!Number.isFinite(p.getX(i)) || !Number.isFinite(y) || !Number.isFinite(p.getZ(i))) throw new Error('NaN vertex');
      if (y < lo || y > hi) throw new Error(`vertex y=${y} outside [${lo},${hi}]`);
      n++;
    }
  });
  return n;
}

describe('Divinolândia town geometry builds cleanly from the baked data', () => {
  const H = divinoHeight;
  const ymax = 1500 - divData.ref;
  it('terrain, streets, river, plazas', () => {
    expect(checkPositions(makeTerrainMesh(nearGrid), 0, ymax)).toBe(nearGrid.nx * nearGrid.nz);
    const lines = divData.roads.map(r => ({ pts: r.pts.map(p => W(p)), hw: r.hw, paved: !!r.p, sidewalk: !!r.p }));
    expect(checkPositions(makeStreets(lines, H), 0, ymax)).toBeGreaterThan(10000);
    const water = makeWater(waterLines);
    checkPositions(water, 0, ymax);
    for (const p of [...divData.plazas, ...divData.areas]) {
      if (p.k === 'hospital' || p.k === 'torre') continue;
      checkPositions(makeSurface(p.k as Surface, p.pts.map(q => W(q)), H), 0, ymax);
    }
  });
  it('every house sits on the ground (door at street level, no floating base)', () => {
    for (let i = 0; i < divData.houses.length; i++) {
      const [hx, hz, hw, hd, rot, fl, c, roof, shop] = divData.houses[i];
      const [x, z] = W([hx, hz]); const cs = Math.cos(rot), sn = Math.sin(rot);
      const hs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => H(x + u * hw / 2 * cs - v * hd / 2 * sn, z + u * hw / 2 * sn + v * hd / 2 * cs));
      const front = H(x - sn * hd / 2, z + cs * hd / 2);
      const floor = Math.max(front, Math.max(...hs) - 2.4) + .15, base = Math.min(...hs) - .6;
      expect(floor - base).toBeLessThan(8);
      const spec = { x, z, w: hw, d: hd, rot, floor, base, floors: fl, color: c, flat: !!roof, shop, seed: i + 1 };
      expect(casaTop(spec)).toBeGreaterThan(3);
      addCasa(spec);
    }
    const chunks = finalizeCasas();
    expect(chunks.length).toBeGreaterThan(10);
    for (const g of chunks) checkPositions(g, 0, ymax);
  });
  it('keeps UVs aligned with every merged house vertex', () => {
    for (const flat of [false, true]) addCasa({ x: 5000, z: 5000, w: 8, d: 12, rot: .4, floor: 300, base: 299, floors: 2, color: 2, flat, shop: 0, seed: flat ? 1 : 2 });
    const groups = finalizeCasas();
    for (const group of groups) group.traverse(object => {
      const geometry = (object as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (!geometry) return;
      expect(geometry.getAttribute('uv').count).toBe(geometry.getAttribute('position').count);
    });
  });
  it('woods and coffee rows', () => {
    const t = []; for (let i = 0; i < divData.trees.length; i += 3) { const [x, z] = W([divData.trees[i], divData.trees[i + 1]]); t.push({ x, y: H(x, z), z, s: divData.trees[i + 2], r: i }); }
    expect(makeTrees(t).length).toBeGreaterThan(5);
    const c = []; for (let i = 0; i < divData.coffee.length; i += 3) { const [x, z] = W([divData.coffee[i], divData.coffee[i + 1]]); c.push({ x, y: H(x, z), z, s: 1, r: divData.coffee[i + 2] }); }
    expect(makeCoffee(c).length).toBeGreaterThan(5);
  });
  it('builds the dedicated Euclides da Cunha campus within its mapped footprint', () => {
    const school = buildEuclidesSchool();
    expect(school.userData.name).toBe('EMEB Euclides da Cunha');
    expect(school.userData.width).toBe(EUCLIDES_SITE.width);
    expect(school.userData.depth).toBe(EUCLIDES_SITE.depth);
    expect(checkPositions(school, -4, 12)).toBeGreaterThan(100);
  });
  it('aligns its street fence with the actual school parcel front', () => {
    const parcel = divData.areas.find(area => area.n === 'Escola Municipal Euclides da Cunha');
    expect(parcel).toBeDefined();
    const {x,z,yaw,front,width} = EUCLIDES_SITE;
    expect(EUCLIDES_SITE.centerZ+EUCLIDES_SITE.depth/2).toBeCloseTo(front,5);
    const corners = [-width/2,width/2].map(localX => [
      x+localX*Math.cos(yaw)+front*Math.sin(yaw),
      z-localX*Math.sin(yaw)+front*Math.cos(yaw),
    ]);
    for (const [index, target] of [parcel!.pts[2],parcel!.pts[3]].entries()) {
      expect(Math.hypot(corners[index][0]-target[0],corners[index][1]-target[1])).toBeLessThan(1.5);
    }
  });
});

// The surveyed street (Rua José Augusto Machado, lot by lot from Street View).
import { LOTS, TREES, SURFACE, RUA } from '@/world/divinolandia/ruas/jose-augusto-machado.ts';
import { buildFachada } from '../../src/assets/models/divinolandia/fachada.ts';
import CasaRosa from '../../src/assets/models/divinolandia/casa-rosa-esquina.ts';

describe('Rua José Augusto Machado (surveyed)', () => {
  it('lots never overlap on a side and stay clear of the cross streets', () => {
    const cross = [0, 100, 172, 272, 367];
    for (const side of ['N', 'S'] as const) {
      const lots = LOTS.filter(l => l.side === side).sort((a, b) => a.s0 - b.s0);
      for (let i = 1; i < lots.length; i++) expect(lots[i].s0).toBeGreaterThanOrEqual(lots[i - 1].s1);
      for (const l of lots) for (const c of cross) expect(l.s0 >= c + 5 || l.s1 <= c - 5).toBe(true);
    }
    expect(LOTS.length).toBeGreaterThan(40);
    for (const t of TREES) expect(t.s).toBeGreaterThan(0);
  });
  it('the bake paved it as surveyed: asphalt, cobblestone from Barão to Francisco P. de Souza, asphalt', () => {
    expect(SURFACE.map(s => s[2])).toEqual(['asphalt', 'sett', 'asphalt']);
    const pieces = divData.roads.filter(r => r.n === RUA);
    expect(pieces.map(p => p.sf)).toEqual(['asphalt', 'sett', 'asphalt']);
    // no generated houses left along it (its lots come from the survey)
    const pts = pieces.flatMap(p => p.pts);
    for (const h of divData.houses) {
      let d = 1e9;
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
        let t = ((h[0] - ax) * dx + (h[1] - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        d = Math.min(d, Math.hypot(h[0] - ax - t * dx, h[1] - az - t * dz));
      }
      expect(d).toBeGreaterThan(20);
    }
  });
  it('every lot and the pink corner house build without NaN geometry', () => {
    const bounds = (g: THREE.Object3D): THREE.Box3 => { g.updateMatrixWorld(true); return new THREE.Box3().setFromObject(g); };
    for (const l of LOTS) {
      const g = buildFachada({ ...l.f, w: l.s1 - l.s0 - .1 });
      checkPositions(g, -60, 60);
      const b = bounds(g);
      expect(b.max.x - b.min.x).toBeLessThan(l.s1 - l.s0 + 3);        // stays on its lot (eaves allowed)
      expect(b.max.y).toBeLessThan(16);
    }
    const rosa = CasaRosa.build(); checkPositions(rosa, -60, 60);
    const b = bounds(rosa);
    expect(b.min.y).toBeGreaterThan(-2); expect(b.max.y).toBeLessThan(10);  // two storeys on a raised lot
    expect(b.max.x).toBeLessThan(1.5);                                    // nothing crosses into the street
  });
});
