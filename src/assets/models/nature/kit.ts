// ===========================================================================
// nature/kit.ts — ALL vegetation and rocks, generated purely in code (no model or
// texture files). Every named variant below is built from Three.js primitives —
// tapered cylinders, stacked cones, faceted icosahedron blobs, jittered polyhedra and
// double-sided blade/leaf cards — coloured per vertex from the NATURE palette, then
// normalised into a merge-ready PROTOTYPE: unit height, base at y=0, centred in XZ.
//
// nature/batch.ts records placements and merges every instance per spatial chunk.
// All nature shares just TWO materials (solid + double-sided cards), so a whole forest
// chunk is at most two draw calls. Variants are seeded by name, so each one looks the
// same every run.
// ===========================================================================
import * as THREE from 'three';
import { NATURE } from '@/core/palette.ts';
import { makeRng } from '@/core/rng.ts';

// One merge primitive: geometry (unit height, base y=0, centred XZ) + shared material.
export interface NaturePart { geo: THREE.BufferGeometry; mat: THREE.Material; }
export interface NatureProto { parts: NaturePart[]; footprint: number; }

// Variant pools — placement picks a random member (all variants merge into the same
// two material buckets, so a rich pool is free).
export const POOLS = {
  tree: ['tree_round', 'tree_oval', 'tree_umbrella', 'tree_cluster', 'tree_tall'],
  pine: ['pine_1', 'pine_2', 'pine_3', 'pine_4', 'pine_5'],
  palm: ['palm_1', 'palm_2', 'palm_3'],
  bush: ['bush_round', 'bush_flowers', 'plant_blades', 'plant_broad'],
  fern: ['fern_1', 'fern_2'],
  mushroom: ['mushroom_cap', 'mushroom_shelf'],
  rock: ['rock_1', 'rock_2', 'rock_3', 'rock_4'],
  grass: ['grass_short', 'grass_tall', 'grass_wispy', 'grass_dry'],
  flower: ['flowers_1', 'flowers_2'],
  clover: ['clover_1', 'clover_2'],
} as const;
export type NatureKind = keyof typeof POOLS;

export function pick(kind: NatureKind): string {
  const pool = POOLS[kind];
  return pool[(Math.random() * pool.length) | 0];
}

// ---- the two shared materials -------------------------------------------------
const SOLID = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const CARD = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });

// ---- geometry helpers -----------------------------------------------------------
type Rng = ReturnType<typeof makeRng>;
const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

// Canonical non-indexed geometry (position/normal/uv/color) so everything merges.
// Each triangle gets a slight random shade so faceted foliage/rock reads as volume.
function finish(src: THREE.BufferGeometry, color: number, rng: Rng, shade = .1): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src.clone();
  for (const n of Object.keys(g.attributes)) if (n !== 'position') g.deleteAttribute(n);
  g.computeVertexNormals();
  const count = g.getAttribute('position').count;
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 3) {
    _c.set(color).multiplyScalar(1 - shade / 2 + rng.random() * shade);
    for (let k = 0; k < 3 && i + k < count; k++) { col[(i + k) * 3] = _c.r; col[(i + k) * 3 + 1] = _c.g; col[(i + k) * 3 + 2] = _c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  return g;
}
function place(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
  return g.applyMatrix4(_m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz)));
}
// Displace the vertices of a polyhedron consistently (shared corners move together) so
// rocks/blobs are lumpy instead of perfect.
function lumpy(g: THREE.BufferGeometry, amt: number, rng: Rng): THREE.BufferGeometry {
  const p = g.getAttribute('position'), seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < p.count; i++) {
    const key = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
    let d = seen.get(key);
    if (!d) { d = [(rng.random() - .5) * amt, (rng.random() - .5) * amt, (rng.random() - .5) * amt]; seen.set(key, d); }
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  return g;
}
// A flat tapered blade/leaf card from base (0,0,0) to tip (0,len,0): width w at the base,
// optional bend (tip leans toward +z), built from `seg` quads so it can curve.
function blade(w: number, len: number, bend: number, seg = 2): THREE.BufferGeometry {
  const pos: number[] = [];
  const pt = (t: number, side: number): [number, number, number] => {
    const half = w * (1 - t) * .5 * side;
    return [half, len * t * (1 - bend * t * .25), bend * len * t * t];
  };
  for (let s = 0; s < seg; s++) {
    const t0 = s / seg, t1 = (s + 1) / seg;
    const a = pt(t0, -1), b = pt(t0, 1), c = pt(t1, -1), d = pt(t1, 1);
    if (s === seg - 1) pos.push(...a, ...b, ...c);                  // pointed tip
    else pos.push(...a, ...b, ...d, ...a, ...d, ...c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  return g;
}
const vary = (c: number, rng: Rng, amt = .12): number => {
  _c.set(c).multiplyScalar(1 - amt / 2 + rng.random() * amt);
  return _c.getHex();
};

// ---- builders (arbitrary units; normalised afterwards) ---------------------------
interface Built { solid: THREE.BufferGeometry[]; card: THREE.BufferGeometry[]; }
const B = (): Built => ({ solid: [], card: [] });

function trunk(o: Built, rng: Rng, h: number, r: number, color: number, lean = 0): void {
  o.solid.push(finish(place(new THREE.CylinderGeometry(r * .6, r, h, 6), 0, h / 2, 0, 0, 0, lean), color, rng, .08));
}
function blob(o: Built, rng: Rng, r: number, x: number, y: number, z: number, color: number, sy = 1): void {
  o.solid.push(finish(place(lumpy(new THREE.IcosahedronGeometry(r, 1), r * .22, rng), x, y, z, 0, rng.random() * 6, 0, 1, sy, 1), color, rng, .16));
}

function buildTree(style: string, rng: Rng): Built {
  const o = B();
  const leaf = rng.random() < .5 ? NATURE.treeLeaf : NATURE.treeLeafDark;
  if (style === 'tree_tall') {
    trunk(o, rng, 3.6, .2, NATURE.trunk);
    for (let k = 0; k < 4; k++) blob(o, rng, .9 - k * .12, rng.rand(-.2, .2), 2.9 + k * .75, rng.rand(-.2, .2), vary(leaf, rng), 1.1);
  } else if (style === 'tree_umbrella') {
    trunk(o, rng, 2.8, .22, NATURE.trunk);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; blob(o, rng, .95, Math.cos(a) * 1.1, 3.2 + rng.rand(-.15, .2), Math.sin(a) * 1.1, vary(leaf, rng), .55); }
    blob(o, rng, 1.1, 0, 3.5, 0, vary(leaf, rng), .6);
  } else if (style === 'tree_oval') {
    trunk(o, rng, 2.5, .2, NATURE.trunk);
    blob(o, rng, 1.3, 0, 3.4, 0, vary(leaf, rng), 1.45);
    blob(o, rng, .8, .6, 2.9, .2, vary(leaf, rng));
    blob(o, rng, .75, -.5, 3.1, -.3, vary(leaf, rng));
  } else if (style === 'tree_cluster') {
    trunk(o, rng, 2.6, .21, NATURE.trunk);
    for (let k = 0; k < 7; k++) blob(o, rng, rng.rand(.55, .85), rng.rand(-1, 1), rng.rand(2.6, 3.9), rng.rand(-1, 1), vary(k % 2 ? NATURE.treeLeaf : NATURE.treeLeafDark, rng));
  } else { // tree_round
    trunk(o, rng, 2.4, .2, NATURE.trunk);
    blob(o, rng, 1.35, 0, 3.3, 0, vary(leaf, rng));
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + rng.random(); blob(o, rng, .8, Math.cos(a) * .8, 3.0 + rng.rand(-.2, .4), Math.sin(a) * .8, vary(leaf, rng)); }
  }
  return o;
}

function buildPine(n: number, rng: Rng): Built {
  const o = B();
  const tiers = 3 + (n % 3), h = 6 + n * .4;
  trunk(o, rng, h * .35, .18, NATURE.trunk);
  for (let k = 0; k < tiers; k++) {
    const t = k / tiers, r = (1.7 - t * 1.2) * (1 + (n % 2) * .12), ch = h * .38;
    o.solid.push(finish(place(new THREE.ConeGeometry(r, ch, 7), 0, h * .25 + t * h * .62 + ch / 2, 0, 0, rng.random() * 6, 0),
      vary(k % 2 ? NATURE.pineLeaf : NATURE.pineLeafDark, rng), rng, .14));
  }
  return o;
}

function buildPalm(n: number, rng: Rng): Built {
  const o = B();
  const segs = 7, lean = .06 + n * .03;
  let x = 0, y = 0;
  for (let s = 0; s < segs; s++) {                         // curved, ringed trunk
    const len = .95, r = .22 - s * .015;
    o.solid.push(finish(place(new THREE.CylinderGeometry(r * .92, r, len, 6), x, y + len / 2, 0, 0, 0, -lean * (s + 1) * .5), vary(NATURE.palmTrunk, rng, .18), rng, .06));
    x += Math.sin(lean * (s + 1) * .5) * len; y += Math.cos(lean * (s + 1) * .5) * len;
  }
  const fronds = 8 + n;
  for (let k = 0; k < fronds; k++) {                       // drooping fronds
    const a = k / fronds * Math.PI * 2 + rng.random() * .3;
    const f = blade(.55, 3.2, 1.3 + rng.random() * .5, 4);
    o.card.push(finish(place(f, x, y, 0, 1.15 + rng.rand(-.15, .2), a, 0), vary(NATURE.palmLeaf, rng), rng, .1));
  }
  for (let k = 0; k < 3; k++) {                            // coconuts
    const a = k / 3 * Math.PI * 2;
    o.solid.push(finish(place(new THREE.IcosahedronGeometry(.16, 0), x + Math.cos(a) * .2, y - .2, Math.sin(a) * .2), NATURE.coconut, rng));
  }
  return o;
}

function buildBush(style: string, rng: Rng): Built {
  const o = B();
  if (style === 'plant_blades' || style === 'plant_broad') {
    const broad = style === 'plant_broad', n = broad ? 7 : 12;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + rng.random() * .4;
      const f = blade(broad ? .5 : .16, rng.rand(1.1, 1.7), rng.rand(.5, 1.1), 3);
      o.card.push(finish(place(f, 0, 0, 0, rng.rand(.15, .55), a, 0), vary(broad ? NATURE.bush : NATURE.treeLeaf, rng), rng, .12));
    }
    return o;
  }
  const n = 5 + ((rng.random() * 3) | 0);
  for (let k = 0; k < n; k++) blob(o, rng, rng.rand(.45, .7), rng.rand(-.6, .6), rng.rand(.35, .8), rng.rand(-.6, .6), vary(k % 2 ? NATURE.bush : NATURE.bushDark, rng), .85);
  if (style === 'bush_flowers') {
    for (let k = 0; k < 14; k++) {
      const a = rng.random() * Math.PI * 2, r = rng.rand(.5, .95);
      o.solid.push(finish(place(new THREE.IcosahedronGeometry(.09, 0), Math.cos(a) * r * .9, rng.rand(.6, 1.2), Math.sin(a) * r * .9), NATURE.petals[k % NATURE.petals.length], rng, .05));
    }
  }
  return o;
}

function buildFern(n: number, rng: Rng): Built {
  const o = B();
  const fronds = 7 + n * 2;
  for (let k = 0; k < fronds; k++) {
    const a = k / fronds * Math.PI * 2 + rng.random() * .3;
    o.card.push(finish(place(blade(.34, rng.rand(.9, 1.3), 1.4, 4), 0, 0, 0, rng.rand(.5, .8), a, 0), vary(NATURE.treeLeafDark, rng), rng, .12));
  }
  return o;
}

function buildMushroom(style: string, rng: Rng): Built {
  const o = B();
  if (style === 'mushroom_shelf') {                        // bracket fungus: stacked half-discs
    for (let k = 0; k < 3; k++) {
      const r = .5 - k * .1;
      o.solid.push(finish(place(new THREE.CylinderGeometry(r, r * 1.05, .1, 8, 1, false, 0, Math.PI), 0, .15 + k * .22, 0), vary(NATURE.shelfFungus, rng), rng, .1));
    }
    return o;
  }
  const n = 1 + ((rng.random() * 3) | 0);
  for (let k = 0; k < n; k++) {
    const x = k ? rng.rand(-.35, .35) : 0, z = k ? rng.rand(-.35, .35) : 0, s = k ? rng.rand(.55, .8) : 1;
    o.solid.push(finish(place(new THREE.CylinderGeometry(.09 * s, .12 * s, .5 * s, 6), x, .25 * s, z), NATURE.mushroomStem, rng, .06));
    o.solid.push(finish(place(new THREE.SphereGeometry(.34 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), x, .45 * s, z, 0, 0, 0, 1, .7, 1), vary(NATURE.mushroomCap, rng), rng, .1));
    for (let d = 0; d < 4; d++) {                          // white spots
      const a = d / 4 * Math.PI * 2 + rng.random();
      o.solid.push(finish(place(new THREE.BoxGeometry(.07 * s, .03 * s, .07 * s), x + Math.cos(a) * .2 * s, .62 * s, z + Math.sin(a) * .2 * s), NATURE.mushroomStem, rng, .04));
    }
  }
  return o;
}

function buildRock(n: number, rng: Rng): Built {
  const o = B();
  const col = [NATURE.rock, NATURE.rockDark, NATURE.rockWarm, NATURE.rock][n % 4];
  const base = n % 2 ? new THREE.DodecahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 1);
  o.solid.push(finish(place(lumpy(base, .35, rng), 0, .55, 0, rng.random(), rng.random() * 6, 0, rng.rand(1.1, 1.5), rng.rand(.6, .85), rng.rand(.9, 1.3)), col, rng, .18));
  if (n >= 2) o.solid.push(finish(place(lumpy(new THREE.IcosahedronGeometry(.55, 0), .2, rng), .9, .3, .3, 0, rng.random() * 6), vary(col, rng), rng, .18));
  return o;
}

function buildGrass(style: string, rng: Rng): Built {
  const o = B();
  const tall = style === 'grass_tall', wispy = style === 'grass_wispy', dry = style === 'grass_dry';
  const n = wispy ? 14 : 10;
  for (let k = 0; k < n; k++) {
    const a = rng.random() * Math.PI * 2, r = rng.rand(0, .35);
    const f = blade(wispy ? .05 : .1, (tall ? 1.2 : .8) * rng.rand(.6, 1.1), wispy ? rng.rand(.6, 1.2) : rng.rand(.1, .5), wispy ? 3 : 2);
    o.card.push(finish(place(f, Math.cos(a) * r, 0, Math.sin(a) * r, rng.rand(0, .3), rng.random() * 6, 0),
      vary(dry ? NATURE.grassDry : NATURE.grass, rng, .2), rng, .1));
  }
  return o;
}

function buildFlowers(n: number, rng: Rng): Built {
  const o = B();
  const count = 4 + n * 2;
  for (let k = 0; k < count; k++) {
    const a = rng.random() * Math.PI * 2, r = rng.rand(0, .4), h = rng.rand(.45, .8);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    o.card.push(finish(place(blade(.05, h, .1, 1), x, 0, z, 0, rng.random() * 6, 0), NATURE.grass, rng, .1));
    o.solid.push(finish(place(new THREE.IcosahedronGeometry(.09, 0), x, h, z), NATURE.petals[(k + n) % NATURE.petals.length], rng, .06));
  }
  return o;
}

function buildClover(n: number, rng: Rng): Built {
  const o = B();
  const sprigs = 3 + n * 2;
  for (let k = 0; k < sprigs; k++) {
    const x = rng.rand(-.3, .3), z = rng.rand(-.3, .3), h = rng.rand(.12, .22);
    for (let l = 0; l < 3; l++) {                          // three round leaves per sprig
      const a = l / 3 * Math.PI * 2;
      o.card.push(finish(place(new THREE.CircleGeometry(.07, 5), x + Math.cos(a) * .06, h, z + Math.sin(a) * .06, -Math.PI / 2), vary(NATURE.clover, rng), rng, .1));
    }
  }
  return o;
}

function build(name: string, rng: Rng): Built {
  const num = parseInt(name.replace(/^\D+/, ''), 10) || 1;
  if (name.startsWith('tree_')) return buildTree(name, rng);
  if (name.startsWith('pine_')) return buildPine(num, rng);
  if (name.startsWith('palm_')) return buildPalm(num, rng);
  if (name.startsWith('bush_') || name.startsWith('plant_')) return buildBush(name, rng);
  if (name.startsWith('fern_')) return buildFern(num, rng);
  if (name.startsWith('mushroom_')) return buildMushroom(name, rng);
  if (name.startsWith('rock_')) return buildRock(num, rng);
  if (name.startsWith('grass_')) return buildGrass(name, rng);
  if (name.startsWith('flowers_')) return buildFlowers(num, rng);
  return buildClover(num, rng);
}

// Normalise to a unit-height prototype (base y=0, centred XZ) with the shared materials.
function toProto(b: Built): NatureProto {
  const box = new THREE.Box3();
  for (const g of [...b.solid, ...b.card]) { g.computeBoundingBox(); box.union(g.boundingBox!); }
  const size = new THREE.Vector3(); box.getSize(size);
  const h = size.y || 1, cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const norm = (g: THREE.BufferGeometry) => { g.translate(-cx, -box.min.y, -cz); g.scale(1 / h, 1 / h, 1 / h); return g; };
  const parts: NaturePart[] = [];
  const merge = (list: THREE.BufferGeometry[], mat: THREE.Material) => {
    if (!list.length) return;
    for (const g of list) norm(g);
    for (const g of list) parts.push({ geo: g, mat });
  };
  merge(b.solid, SOLID); merge(b.card, CARD);
  return { parts, footprint: Math.max(size.x, size.z) / h / 2 };
}

const protos = new Map<string, NatureProto>();
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
export function natureProto(name: string): NatureProto | undefined {
  let p = protos.get(name);
  if (!p) { p = toProto(build(name, makeRng(hash(name)))); protos.set(name, p); }
  return p;
}
export function natureReady(): boolean { return true; }
// Kept for the boot flow (main.ts awaits it before finalizing the merged chunks): every
// variant is generated synchronously, so this resolves immediately.
export function preloadNature(): Promise<void> {
  for (const pool of Object.values(POOLS)) for (const n of pool) natureProto(n);
  return Promise.resolve();
}
