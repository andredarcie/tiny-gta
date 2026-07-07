// ===========================================================================
// nature/batch.ts — record-then-merge renderer for the stylized-nature kit.
//
// glTF loads ASYNC, but the world is built SYNC at import. So placement calls just
// RECORD a transform (kind + world matrix) into a list; once preloadNature() resolves,
// finalizeNature() bakes every recorded instance into per-chunk merged meshes — one
// mesh per (spatial chunk, shared material) — exactly like the primitive prop merger.
// Draw calls stay tiny and distant chunks cull with a size-appropriate cutoff.
// ===========================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from '@/core/engine.ts';
import { groundHeight } from '@/core/constants.ts';
import { natureProto, natureReady, pick, type NatureKind } from './kit.ts';

const CHUNK = 90;    // spatial super-block (m), matches the prop merger
const CULL = 150;    // trees read from further than small props; fog hides them ~200

interface Placement { name: string; m: THREE.Matrix4; }
const pending: Placement[] = [];
let finalized = false;

const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

// Record one instance. `height` is the world height in metres (protos are unit-height);
// scale is uniform. rotY defaults to a random yaw. Optional xzScale squashes/stretches
// the footprint independently (kept 1 for trees; handy for wide/short ground cover).
export function placeNature(kind: NatureKind, x: number, y: number, z: number, height: number, rotY?: number, xzScale?: number): void {
  const name = pick(kind);
  _q.setFromAxisAngle(_up, rotY ?? Math.random() * Math.PI * 2);
  _s.set(height * (xzScale ?? 1), height, height * (xzScale ?? 1));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, _s);
  pending.push({ name, m });
}

// Convenience: drop a ground-cover instance at terrain height (grass/flowers/clover).
export function scatterGround(kind: NatureKind, x: number, z: number, height: number, xzScale?: number): void {
  placeNature(kind, x, groundHeight(x, z), z, height, undefined, xzScale);
}

// Record a specific variant by name (island palms, curated placements).
export function placeNatureNamed(name: string, x: number, y: number, z: number, height: number, rotY?: number): void {
  _q.setFromAxisAngle(_up, rotY ?? Math.random() * Math.PI * 2);
  _s.set(height, height, height);
  pending.push({ name, m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, _s) });
}

interface Bucket { geos: THREE.BufferGeometry[]; }
export const natureChunks: THREE.Group[] = [];
const _wp = new THREE.Vector3();

// Bake every recorded placement into merged, frozen per-chunk meshes. Safe to call
// again as more placements arrive (rebuilds from scratch) — but normally called once
// after preloadNature() resolves.
export function finalizeNature(): void {
  if (!natureReady()) return;
  // clear any previous build (in case of a re-run)
  for (const g of natureChunks) scene.remove(g);
  natureChunks.length = 0;

  const chunks = new Map<string, Map<THREE.Material, Bucket>>();
  for (const p of pending) {
    const proto = natureProto(p.name);
    if (!proto) continue;
    _wp.setFromMatrixPosition(p.m);
    const key = Math.round(_wp.x / CHUNK) + '_' + Math.round(_wp.z / CHUNK);
    let cm = chunks.get(key);
    if (!cm) { cm = new Map(); chunks.set(key, cm); }
    for (const part of proto.parts) {
      let b = cm.get(part.mat);
      if (!b) { b = { geos: [] }; cm.set(part.mat, b); }
      b.geos.push(part.geo.clone().applyMatrix4(p.m));
    }
  }

  for (const [key, cm] of chunks) {
    const group = new THREE.Group();
    for (const [mat, b] of cm) {
      if (!b.geos.length) continue;
      const merged = mergeGeometries(b.geos);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = false; mesh.receiveShadow = false;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      group.add(mesh);
    }
    if (!group.children.length) continue;
    const [ki, kj] = key.split('_').map(Number);
    group.userData.cx = ki * CHUNK; group.userData.cz = kj * CHUNK;
    group.matrixAutoUpdate = false; group.updateMatrix();
    scene.add(group);
    natureChunks.push(group);
  }
  finalized = true;
}

export function natureFinalized(): boolean { return finalized; }

// Hide nature chunks beyond CULL of the player (size-based LOD, like the prop merger).
export function updateNatureCulling(px: number, pz: number): void {
  const f2 = CULL * CULL;
  for (const g of natureChunks) {
    const dx = g.userData.cx - px, dz = g.userData.cz - pz;
    g.visible = dx * dx + dz * dz < f2;
  }
}
