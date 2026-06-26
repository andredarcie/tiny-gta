// bake-regions.ts — precompute the per-vertex REGION map (skin/hair/shirt/…) for the Mixamo
// base mesh, so the runtime no longer needs to load the 2 MB Quaternius player.fbx just to
// read its material regions. Reads the ORIGINAL mesh's material per vertex (by position) and
// writes one byte per BASE-mesh vertex to public/models/mixamo/regions.bin.
//   NODE_PATH="C:/repos/tiny-gta/node_modules" npx tsx tools/bake-regions.ts
import * as fs from 'fs';
import * as THREE from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';

const DIR = 'C:/repos/tg-gun-idle/public/models/';
const REGIONS = ['Skin', 'Hair', 'Eyes', 'Shirt', 'Pants', 'Socks'];   // must match mixamo-rig.ts
function load(p: string){ const b = fs.readFileSync(p); const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; return new FBXLoader().parse(ab, '') as unknown as THREE.Group; }
function skinned(g: THREE.Object3D): THREE.SkinnedMesh | null { let m: THREE.SkinnedMesh | null = null; g.traverse(o => { if (!m && (o as THREE.SkinnedMesh).isSkinnedMesh) m = o as THREE.SkinnedMesh; }); return m; }
function normalizeGeo(geo: THREE.BufferGeometry){ geo.computeBoundingBox(); const bb = geo.boundingBox!; const sz = new THREE.Vector3(); bb.getSize(sz); const s = 1.8 / (sz.y || 1); const c = new THREE.Vector3(); bb.getCenter(c); geo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -bb.min.y * s, 0).multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(new THREE.Matrix4().makeTranslation(-c.x, 0, -c.z))); }
const K = (x: number, y: number, z: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;

const orig = load(DIR + 'player.fbx'); orig.updateWorldMatrix(true, true);
const om = skinned(orig)!; const og = om.geometry.clone(); og.applyMatrix4(om.matrixWorld); normalizeGeo(og);
const op = og.getAttribute('position'); const idx = og.index;
const mats = (Array.isArray(om.material) ? om.material : [om.material]) as THREE.Material[];
const regionId = (name: string) => { const i = REGIONS.indexOf(name); return i < 0 ? 0 : i; };
const map = new Map<string, number>();
const groups = og.groups.length ? og.groups : [{ start: 0, count: idx ? idx.count : op.count, materialIndex: 0 }];
for (const g of groups) { const id = regionId(mats[g.materialIndex || 0]?.name || ''); for (let i = g.start; i < g.start + g.count; i++) { const v = idx ? idx.getX(i) : i; map.set(K(op.getX(v), op.getY(v), op.getZ(v)), id); } }

const base = load(DIR + 'mixamo/player-mesh.fbx'); base.updateWorldMatrix(true, true);
const bm = skinned(base)!; const bg = bm.geometry.clone(); bg.applyMatrix4(bm.matrixWorld); normalizeGeo(bg);
const bp = bg.getAttribute('position'); const out = new Uint8Array(bp.count);
let miss = 0;
for (let v = 0; v < bp.count; v++) { const r = map.get(K(bp.getX(v), bp.getY(v), bp.getZ(v))); if (r === undefined) miss++; out[v] = r ?? 0; }
fs.writeFileSync(DIR + 'mixamo/regions.bin', out);
console.log(`wrote regions.bin: ${out.length} bytes (${miss} miss); regions = ${REGIONS.join(',')}`);
