// ===========================================================================
// nature/kit.ts — loads the Quaternius "Stylized Nature MegaKit" (CC0) glTF models
// baked under public/models/nature/ (see tools/bake-nature-assets.py) and turns each
// into a merge-ready PROTOTYPE: unit-height geometry (base at y=0, centred in XZ) +
// a small set of SHARED matte materials keyed by texture, so every instance of a kind
// folds into a handful of draw calls via nature/batch.ts.
//
// This is the single place that owns the stylized-nature look. The old primitive
// tree/pine/bush/fern/… builders stay only as the model-viewer gallery fallback; the
// live world routes ALL nature (trees, pines, palms, bushes, ferns, mushrooms, rocks,
// plus new grass/flowers/clover ground cover) through these loaded assets.
// ===========================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const BASE = import.meta.env.BASE_URL + 'models/nature/';

// One merge primitive: geometry (unit height, base y=0, centred XZ) + shared material.
export interface NaturePart { geo: THREE.BufferGeometry; mat: THREE.Material; }
export interface NatureProto { parts: NaturePart[]; footprint: number; }

const protos = new Map<string, NatureProto>();
export function natureProto(name: string): NatureProto | undefined { return protos.get(name); }
export function natureReady(): boolean { return protos.size > 0; }

// Variant pools — placement picks a random member. Variants that share a texture set
// merge into the SAME draw-call bucket, so a rich pool is essentially free.
export const POOLS = {
  tree: ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5'],
  pine: ['Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5'],
  palm: ['CoconutPalmTree'],   // beach/island palm — a separate OBJ pack (see OBJ_NAMES)
  bush: ['Bush_Common', 'Bush_Common_Flowers', 'Plant_1', 'Plant_7'],
  fern: ['Fern_1'],
  mushroom: ['Mushroom_Common', 'Mushroom_Laetiporus'],
  rock: ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'],
  pebble: ['Pebble_Round_1', 'Pebble_Round_2', 'Pebble_Round_3', 'Pebble_Round_4', 'Pebble_Round_5'],
  grass: ['Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Short', 'Grass_Wispy_Tall'],
  flower: ['Flower_3_Group', 'Flower_4_Group'],
  clover: ['Clover_1', 'Clover_2'],
} as const;
export type NatureKind = keyof typeof POOLS;
// Most models are glTF (MegaKit); a few are standalone OBJ packs loaded differently.
const OBJ_NAMES = new Set<string>(['CoconutPalmTree']);
const ALL_MODELS = [...new Set(Object.values(POOLS).flat())];
const GLTF_MODELS = ALL_MODELS.filter(n => !OBJ_NAMES.has(n));
const OBJ_MODELS = ALL_MODELS.filter(n => OBJ_NAMES.has(n));

export function pick(kind: NatureKind): string {
  const pool = POOLS[kind];
  return pool[(Math.random() * pool.length) | 0];
}

// ---- shared matte materials (consolidated by texture) -----------------------
// Two loaded meshes referencing the same base texture collapse onto ONE Lambert
// material instance, so the batch merger buckets them together.
const matCache = new Map<string, THREE.MeshLambertMaterial>();
function sharedMat(src: THREE.Material | THREE.Material[]): THREE.MeshLambertMaterial {
  const s = (Array.isArray(src) ? src[0] : src) as THREE.MeshStandardMaterial;
  const map = s.map ?? null;
  const key = (map ? (map.name || map.uuid) : (s.name || 'plain')) + '|' + (s.alphaTest || 0) + '|' + s.side + '|' + (s.vertexColors ? 1 : 0);
  let m = matCache.get(key);
  if (!m) {
    if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
    m = new THREE.MeshLambertMaterial({
      map,
      color: 0xffffff,
      vertexColors: s.vertexColors,
      alphaTest: s.alphaTest || 0,   // MASK foliage: crisp cutout, stays in the opaque queue
      transparent: false,
      side: s.side,                   // DoubleSide for leaf/grass/flower cards (from the gltf)
      fog: true,
    });
    matCache.set(key, m);
  }
  return m;
}

// Force a canonical, index-free attribute set (position/normal/uv/color-vec3) so any
// same-material bucket always merges (mergeGeometries needs identical attributes).
function canon(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = src.index ? src.toNonIndexed() : src.clone();
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const n = geo.getAttribute('position').count;
  if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const col = geo.getAttribute('color');
  if (!col) {
    const c = new Float32Array(n * 3); c.fill(1);
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  } else if (col.itemSize !== 3) {                       // COLOR_0 may be RGBA — drop alpha
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col.getX(i); c[i * 3 + 1] = col.getY(i); c[i * 3 + 2] = col.getZ(i); }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  // keep only the four canonical attributes
  for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) geo.deleteAttribute(name);
  return geo;
}

function addProto(name: string, gltf: { scene: THREE.Object3D }): void {
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  const h = size.y || 1;
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const parts: NaturePart[] = [];
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.updateWorldMatrix(true, false);
    const geo = canon(mesh.geometry).applyMatrix4(mesh.matrixWorld);
    geo.translate(-cx, -box.min.y, -cz);      // base to y=0, centre XZ
    geo.scale(1 / h, 1 / h, 1 / h);           // normalize to unit height
    parts.push({ geo, mat: sharedMat(mesh.material) });
  });
  if (parts.length) protos.set(name, { parts, footprint: Math.max(size.x, size.z) / h / 2 });
}

// OBJ models (no embedded material): load geometry + the pack's base-colour PNG and
// build one matte double-sided material, then feed the group through addProto like a glTF.
function loadObjProto(name: string): Promise<void> {
  const obj = new OBJLoader(), tex = new THREE.TextureLoader();
  return Promise.all([obj.loadAsync(BASE + name + '.obj'), tex.loadAsync(BASE + name + '_BaseColor.png')])
    .then(([root, map]) => {
      map.colorSpace = THREE.SRGBColorSpace; map.name = name; map.anisotropy = 4;
      const mat = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, metalness: 0, roughness: 1 });
      root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.material = mat; });
      addProto(name, { scene: root });
    })
    .catch(e => console.warn('[nature] obj failed', name, e));
}

// ---- preload (once, before nature/batch.ts finalizes) -----------------------
let pending: Promise<void> | null = null;
export function preloadNature(): Promise<void> {
  if (!pending) {
    THREE.Cache.enabled = true;                // share the small texture fetches across models
    const loader = new GLTFLoader();
    const t0 = performance.now();
    pending = Promise.all([
      ...GLTF_MODELS.map(name =>
        loader.loadAsync(BASE + name + '.gltf')
          .then(g => addProto(name, g))
          .catch(e => console.warn('[nature] failed', name, e))),
      ...OBJ_MODELS.map(loadObjProto),
    ]).then(() => { console.log(`[nature] ${protos.size}/${ALL_MODELS.length} models ready in ${Math.round(performance.now() - t0)}ms`); });
  }
  return pending;
}
