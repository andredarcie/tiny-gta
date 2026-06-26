// ===========================================================================
// mixamo-rig.ts — the ONE shared character base for EVERY humanoid in the game.
//
// There is a single rigged mesh (public/models/mixamo/player-mesh.fbx, the
// mixamorig skeleton), a single set of animation clips (public/models/mixamo/*.fbx),
// and a single per-vertex REGION map (skin/hair/shirt/…) — all loaded ONCE. The
// player and every NPC are a SkeletonUtils.clone of that base with their own skeleton
// + mixer, tinted per region by a `Look`. No per-character meshes, no per-character
// clips, no separate player/NPC pipelines — one source, recoloured per instance.
//
// Colours come from the ORIGINAL Quaternius mesh: its geometry is identical to the
// re-rigged one (verified 0-vertex drift), so we read each vertex's material region
// from the original by position and bake a region id per base vertex.
// ===========================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const BASE_URL = import.meta.env.BASE_URL;
const MODELS = BASE_URL + 'models/mixamo/';

// clip key -> downloaded Mixamo file. ONE shared set (Walking pending a re-download;
// `walk` falls back to `run` until then). Add a file here to add an animation game-wide.
export const CLIP_FILES: Record<string, string> = {
  idle: 'Breathing_Idle', run: 'Standard_Running', jump: 'Jump_In_Place', punch: 'Cross_Punch',
  death: 'Dying_Falling_Backward', sit: 'Sitting_Cross_Legged', aim: 'Rifle_Standing_Aiming_Idle',
  dance: 'Hip_Hop_Dancing_Shimmy', wave: 'Waving', talk: 'Asking_A_Question_With_Two_Hands',
  lie: 'Laying_On_Back', work: 'Digging_Hole_With_Shovel', drive: 'Male_Driving_A_Car',
  fall: 'Mid-Air_Falling_Idle', swim: 'Swimming_Underwater',
};

// Natural locomotion speed (u/s) of the Standard Running clip — measured from its root
// motion (3.19u per 0.73s cycle). The FSM scales playback by groundSpeed/this so feet don't
// skate; the old HumanArmature value (2.45) made the Mixamo legs whirl ~1.8x too fast.
export const MIXAMO_LOCO_NAT = 4.4;
// "Walking" uses the run clip (no walk clip yet) at a LOWER natural so it plays a touch faster
// for a livelier walk cadence (lower nat → higher timescale).
export const MIXAMO_WALK_NAT = 3.4;

// the recolourable regions (must match the original mesh's material names).
export const REGIONS = ['Skin', 'Hair', 'Eyes', 'Shirt', 'Pants', 'Socks'] as const;
export type Region = typeof REGIONS[number];
export type Look = Record<Region, number>;

// ---- per-instance look generation (seeded so a named NPC always looks the same) ----
const SKINS = [0xeec2a0, 0xd9a06b, 0xb8754c, 0x8f5637, 0x6f3e2a, 0xf0c8a0];
const HAIRS = [0x2e2018, 0x14100c, 0x4a2b18, 0x6b5137, 0x0d0d12, 0x7a5a3a, 0x9a9a9a];
const SHIRTS = [0xc23b4e, 0x3b7ac2, 0xcf9a3a, 0x3aa06b, 0xd96fae, 0xe8e3d2, 0x7a4f9e, 0x40c8c0, 0x2f9fd6, 0x444a55];
const PANTSC = [0x202435, 0x263454, 0x2e2a24, 0x3d3f46, 0x18191f, 0xe7dec9, 0x4a3b2a];
// the hero's fixed "Vice City" look.
export const PLAYER_LOOK: Look = { Skin: 0xeec2a0, Hair: 0x2e2018, Eyes: 0x141414, Shirt: 0x2f9fd6, Pants: 0xe7dec9, Socks: 0xf0f0f0 };
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) || 1; }
// a deterministic look from a seed string (an NPC name); colours fixed for eyes/socks.
export function lookFor(seed: string): Look {
  let s = hash(seed); const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const pick = <T,>(a: T[]) => a[(r() * a.length) | 0];
  return { Skin: pick(SKINS), Hair: pick(HAIRS), Eyes: 0x141414, Shirt: pick(SHIRTS), Pants: pick(PANTSC), Socks: 0xf0f0f0 };
}

// ---- shared base load (once) -----------------------------------------------
interface Base { root: THREE.Group; clips: Record<string, THREE.AnimationClip>; region: Uint8Array; }
let baseSync: Base | null = null;
let pending: Promise<Base | null> | null = null;

function skinned(g: THREE.Object3D): THREE.SkinnedMesh | null { let m: THREE.SkinnedMesh | null = null; g.traverse(o => { if (!m && (o as THREE.SkinnedMesh).isSkinnedMesh) m = o as THREE.SkinnedMesh; }); return m; }
// strip HORIZONTAL root motion (keep vertical) so locomotion clips don't drift — the game
// drives x/z by code; jumps/swim bobs keep their vertical.
function inPlace(clip: THREE.AnimationClip): void {
  for (const t of clip.tracks) if (t.name.endsWith('Hips.position')) { const v = t.values; for (let i = 0; i < v.length; i += 3) { v[i] = 0; v[i + 2] = 0; } }
}

async function load(): Promise<Base | null> {
  const loader = new FBXLoader();
  const [regionBuf, root] = await Promise.all([
    fetch(MODELS + 'regions.bin').then(r => r.arrayBuffer()),   // precomputed region map (tools/bake-regions.ts)
    loader.loadAsync(MODELS + 'player-mesh.fbx'),
  ]);
  // normalize the base to ~1.8m, feet at y=0, centred
  root.updateWorldMatrix(true, true);
  let bb = new THREE.Box3().setFromObject(root); const sz = new THREE.Vector3(); bb.getSize(sz);
  root.scale.setScalar(1.8 / (sz.y || 1)); root.updateWorldMatrix(true, true);
  bb = new THREE.Box3().setFromObject(root); const c = new THREE.Vector3(); bb.getCenter(c);
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= bb.min.y; root.updateWorldMatrix(true, true);
  if (!skinned(root)) return null;
  const region = new Uint8Array(regionBuf);
  const clips: Record<string, THREE.AnimationClip> = {};
  await Promise.all(Object.entries(CLIP_FILES).map(([key, file]) =>
    loader.loadAsync(MODELS + file + '.fbx').then(a => { const cl = (a.animations || [])[0]; if (cl) { inPlace(cl); cl.name = key; clips[key] = cl; } }).catch(() => { })));
  if (!clips.walk && clips.run) clips.walk = clips.run;   // Walking pending re-download
  return (baseSync = { root, clips, region });
}
export function preloadRig(): Promise<Base | null> { if (!pending) pending = load().catch(() => null); return pending; }
export function rigReady(): boolean { return !!baseSync; }

// ---- held-weapon anchor -----------------------------------------------------
// The rigged right-hand bone weapons.ts hangs the gun on. Set when the hero is built
// (player.ts); read by weapons.ts. Lives here so the old Quaternius loader can be deleted.
let gunHandBone: THREE.Bone | null = null;
export function glbGunHand(): THREE.Bone | null { return gunHandBone; }
export function setGunHandBone(b: THREE.Bone | null): void { gunHandBone = b; }

// ---- gun-aim overlay --------------------------------------------------------
// Upper-body-ONLY aim posture (mixamorig), extracted from the Rifle Standing Aiming Idle
// clip. Applied AFTER mixer.update so the legs keep the locomotion clip (walk/run) while the
// arms hold the rifle — the player can move and aim. Arms + head only; the spine stays on the
// loco clip so the torso still bobs with the stride.
const AIM_POSE: Record<string, [number, number, number]> = {
  LeftShoulder: [0.929, -0.254, -1.512], LeftArm: [0.881, -0.227, 0.630], LeftForeArm: [0.074, 0.047, 1.120], LeftHand: [-2.253, -0.826, -2.375],
  RightShoulder: [0.836, 0.092, 1.723], RightArm: [0.683, -0.816, -0.886], RightForeArm: [0.075, -0.087, -1.712], RightHand: [-0.658, 0.639, 0.748],
  Neck: [0.088, 0.131, 0.015], Head: [-0.094, 0.377, 0.205],
};
const _aimCache = new WeakMap<THREE.Object3D, Map<string, THREE.Bone>>();
const _aRight = new THREE.Vector3(), _aQ = new THREE.Quaternion(), _aCur = new THREE.Quaternion(), _aPar = new THREE.Quaternion();
// The extracted aim pose holds the gun ~0.55 rad (~30°) HIGH; this bias leans the chest to
// bring the base aim (aimPitch 0) level, so the gun then tracks the reticle linearly.
const AIM_PITCH_BIAS = 0.55;
// Apply the gun-hold posture, then PITCH the chest (Spine2 → carries both arms + the gun) by
// `aimPitch`+bias around the body's right axis, so the gun points where the player is aiming
// up/down — level when the reticle is level. aimPitch >0 = aim down, <0 = up.
export function applyMixamoAim(root: THREE.Object3D, aimPitch = 0): void {
  let bones = _aimCache.get(root);
  if (!bones) { bones = new Map(); root.traverse(o => { if ((o as THREE.Bone).isBone) bones!.set(o.name, o as THREE.Bone); }); _aimCache.set(root, bones); }
  for (const n in AIM_POSE) { const b = bones.get('mixamorig' + n); if (b) { const r = AIM_POSE[n]; b.rotation.set(r[0], r[1], r[2]); } }
  const s2 = bones.get('mixamorigSpine2');
  if (s2) {
    _aRight.setFromMatrixColumn(root.matrixWorld, 0).normalize();   // body right (horizontal)
    _aQ.setFromAxisAngle(_aRight, aimPitch + AIM_PITCH_BIAS);
    s2.getWorldQuaternion(_aCur).premultiply(_aQ);                  // add the pitch in world space (on top of loco)
    if (s2.parent) { s2.parent.getWorldQuaternion(_aPar); _aCur.premultiply(_aPar.invert()); }
    s2.quaternion.copy(_aCur);
  }
  root.updateMatrixWorld(true);
}

// ---- make one character from the shared base --------------------------------
export interface MixamoChar { root: THREE.Group; mixer: THREE.AnimationMixer; actions: Record<string, THREE.AnimationAction>; }
// Clone the base (own skeleton + mixer), give it its own region-tinted geometry, and bind
// every shared clip. Returns null until preloadRig() has resolved.
export function makeCharacter(look: Look): MixamoChar | null {
  const b = baseSync; if (!b) return null;
  const root = cloneSkinned(b.root) as THREE.Group;
  const mesh = skinned(root); if (!mesh) return null;
  // per-instance geometry only for the colour attribute (shape/skeleton stay shared in spirit)
  const geo = mesh.geometry.clone();
  const n = geo.getAttribute('position').count;
  const colours = new Float32Array(n * 3); const col = new THREE.Color();
  for (let v = 0; v < n; v++) { col.setHex(look[REGIONS[b.region[v]]] ?? 0x888888); colours[v * 3] = col.r; colours[v * 3 + 1] = col.g; colours[v * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  mesh.geometry = geo;
  mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  mesh.frustumCulled = false; mesh.castShadow = false;
  const mixer = new THREE.AnimationMixer(root);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const [key, clip] of Object.entries(b.clips)) actions[key] = mixer.clipAction(clip);
  return { root, mixer, actions };
}
