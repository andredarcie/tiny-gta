// ===========================================================================
// gen-glb-poses.ts — offline pose generator for the rigged GLB hero/NPC.
//
// The shipped game drives the GLB with baked bone-local Euler poses (AIM_POSE,
// CAR_POSE, MOTO_POSE in player-glb.ts), originally hand-tuned in /studio's pose
// editor. This tool reproduces that pipeline WITHOUT the browser GUI: it loads the
// same FBX, runs the SAME analytic 2-bone IK (copied from studio-pose.ts) from
// geometric hand/foot TARGET positions, and dumps the resulting bone-local Eulers
// ready to paste as constants. Deterministic, reviewable, no visual tuning loop.
//
//   npx tsx tools/gen-glb-poses.ts
//
// Frame after normalize (matches player-glb.ts): feet at y=0, ~1.8m tall, facing
// +Z, left side +X / right side -X. Shoulders y≈1.41, hips y≈0.72, head y≈1.58.
// ===========================================================================
import * as fs from 'fs';
import * as THREE from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';

const FBX = process.argv[2] || 'public/models/player.fbx';

// ---- load + normalize exactly like player-glb.ts ----------------------------
function load(): THREE.Group {
  const buf = fs.readFileSync(FBX);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const root = new FBXLoader().parse(ab, '') as unknown as THREE.Group;
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root); const size = new THREE.Vector3(); box.getSize(size);
  let scl = 1.8 / (size.y || 1); if (!Number.isFinite(scl) || scl <= 0) scl = 0.0037;
  root.scale.setScalar(scl); root.updateWorldMatrix(true, true);
  const box2 = new THREE.Box3().setFromObject(root); const c = new THREE.Vector3(); box2.getCenter(c);
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box2.min.y;
  root.updateWorldMatrix(true, true);
  return root;
}

// ---- IK (verbatim from studio-pose.ts) --------------------------------------
const _y = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _pw = new THREE.Quaternion(), _dq = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
function aimY(bone: THREE.Object3D, dirW: THREE.Vector3): void {
  if (dirW.lengthSq() < 1e-10) return;
  bone.getWorldQuaternion(_q);
  _v3.copy(_y).applyQuaternion(_q).normalize();
  _dq.setFromUnitVectors(_v3, _v2.copy(dirW).normalize());
  bone.getWorldQuaternion(_q); _q.premultiply(_dq);
  if (bone.parent) { bone.parent.getWorldQuaternion(_pw); _q.premultiply(_pw.invert()); }
  bone.quaternion.copy(_q); bone.updateMatrixWorld(true);
}
function solve2Bone(a: THREE.Object3D, b: THREE.Object3D, La: number, Lb: number, targetW: THREE.Vector3, poleW: THREE.Vector3): void {
  const hip = _v.setFromMatrixPosition(a.matrixWorld);
  const dir = _v2.subVectors(targetW, hip); const len = dir.length(); if (len < 1e-5) return; dir.multiplyScalar(1 / len);
  const reach = La + Lb;
  const dist = Math.max(Math.abs(La - Lb) + 1e-4, Math.min(reach - 1e-4, len));
  const pole = new THREE.Vector3().subVectors(poleW, hip);
  const bend = pole.addScaledVector(dir, -pole.dot(dir));
  if (bend.lengthSq() < 1e-8) bend.set(0, 0, 1).addScaledVector(dir, -dir.z);
  bend.normalize();
  const cosA = Math.max(-1, Math.min(1, (La * La + dist * dist - Lb * Lb) / (2 * La * dist)));
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const knee = new THREE.Vector3().copy(hip).addScaledVector(dir, La * cosA).addScaledVector(bend, La * sinA);
  aimY(a, new THREE.Vector3().subVectors(knee, hip));
  const kneeNow = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
  aimY(b, new THREE.Vector3().subVectors(targetW, kneeNow));
}

// ---- rig handle -------------------------------------------------------------
const root = load();
const bind = new Map<string, THREE.Quaternion>();
const bone = (n: string): THREE.Object3D => {
  let b: THREE.Object3D | null = null;
  root.traverse(o => { if (!b && (o as THREE.Bone).isBone && o.name === n) b = o; });
  if (!b) throw new Error('no bone ' + n);
  return b;
};
root.traverse(o => { if ((o as THREE.Bone).isBone) bind.set(o.name, o.quaternion.clone()); });
const wpos = (n: string) => new THREE.Vector3().setFromMatrixPosition(bone(n).matrixWorld);
const len = (a: string, b: string) => wpos(a).distanceTo(wpos(b));
const LA = { armL: len('UpperArmL', 'LowerArmL'), armLb: len('LowerArmL', 'PalmL'),
  armR: len('UpperArmR', 'LowerArmR'), armRb: len('LowerArmR', 'PalmR'),
  legL: len('UpperLegL', 'LowerLegL'), legLb: len('LowerLegL', 'LowerLegL_end'),
  legR: len('UpperLegR', 'LowerLegR'), legRb: len('LowerLegR', 'LowerLegR_end') };

function reset(): void {
  root.traverse(o => { const q = bind.get(o.name); if (q) (o as THREE.Bone).quaternion.copy(q); });
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
}
type V3 = [number, number, number];
interface Targets { handL?: V3; handR?: V3; footL?: V3; footR?: V3; head?: V3; }
function front(): THREE.Vector3 { return new THREE.Vector3(0, 0, 1); } // root unrotated

// Solve a limb (auto-pole like studio: arms bend back/down, knees bend forward).
function solveArm(side: 'L' | 'R', t: V3): void {
  const a = bone('UpperArm' + side), b = bone('LowerArm' + side);
  const La = side === 'L' ? LA.armL : LA.armR, Lb = side === 'L' ? LA.armLb : LA.armRb;
  const hipW = new THREE.Vector3().setFromMatrixPosition(a.matrixWorld);
  const f = front().multiplyScalar(-1);
  const pole = hipW.clone().add(f).addScaledVector(_y, -0.5);
  solve2Bone(a, b, La, Lb, new THREE.Vector3(...t), pole);
}
function solveLeg(side: 'L' | 'R', t: V3): void {
  const a = bone('UpperLeg' + side), b = bone('LowerLeg' + side);
  const La = side === 'L' ? LA.legL : LA.legR, Lb = side === 'L' ? LA.legLb : LA.legRb;
  const hipW = new THREE.Vector3().setFromMatrixPosition(a.matrixWorld);
  const pole = hipW.clone().add(front());
  solve2Bone(a, b, La, Lb, new THREE.Vector3(...t), pole);
  // snap the (root-parented) foot bone onto the shin end so it reconnects
  const end = bone('LowerLeg' + side + '_end'), foot = bone('Foot' + side);
  const p = new THREE.Vector3().setFromMatrixPosition(end.matrixWorld);
  foot.parent!.worldToLocal(p); foot.position.copy(p); foot.updateMatrixWorld(true);
}

const NAMES = ['Body', 'UpperLegL', 'LowerLegL', 'FootL', 'UpperLegR', 'LowerLegR', 'FootR',
  'UpperArmL', 'LowerArmL', 'UpperArmR', 'LowerArmR', 'Neck', 'Head'];
// arms-only output (legs/feet stay on the underlying clip): drop the leg bones.
const ARM_NAMES = ['Body', 'UpperArmL', 'LowerArmL', 'UpperArmR', 'LowerArmR', 'Neck', 'Head'];
function dump(name: string, t: Targets, arms?: boolean): string {
  reset();
  if (t.handL) solveArm('L', t.handL);
  if (t.handR) solveArm('R', t.handR);
  if (t.footL) solveLeg('L', t.footL);
  if (t.footR) solveLeg('R', t.footR);
  if (t.head) aimY(bone('Head'), new THREE.Vector3(...t.head).sub(wpos('Head')));
  const e = new THREE.Euler();
  const parts = (arms ? ARM_NAMES : NAMES).map(n => {
    const q = bind.get(n) ? bone(n).quaternion : null; if (!q) return '';
    e.setFromQuaternion(bone(n).quaternion);
    return `  ${n}: [${e.x.toFixed(3)}, ${e.y.toFixed(3)}, ${e.z.toFixed(3)}],`;
  }).filter(Boolean);
  return `export const ${name}: Pose = {\n${parts.join('\n')}\n};`;
}

// ===========================================================================
// POSE DEFINITIONS — geometric targets (world frame above).
// ===========================================================================
const POSES: { name: string; t: Targets; arms?: boolean }[] = [
  // RC Toyz operator: both hands on a remote held in front of the chest (~y1.10, z0.34).
  // (No head aim — see NPC_WAVE note; the neutral forward head reads fine.)
  { name: 'REMOTE_POSE', t: { handL: [0.085, 1.12, 0.36], handR: [-0.085, 1.12, 0.36] } },

  // NOTE: boat/plane/tractor seating REUSES the validated CAR_POSE (seated, knees bent) —
  // no separate pose here (an open-seat foot target out at the footwell is past the leg's
  // reach, so the IK straightens the knee instead of bending it; CAR_POSE is correct).

  // Gym bench press — ARMS ONLY (the lying body's legs stay flat from the idle clip; a
  // posed thigh-forward reads as knees-in-the-air once the body is rotated onto its back).
  // Generated UPRIGHT; the mini-game lays the body back, so "press up" = arms forward +Z.
  // Lockout = arms extended; chest = bar lowered near the chest.
  { name: 'BENCH_LOCKOUT', arms: true, t: { handL: [0.14, 1.46, 0.52], handR: [-0.14, 1.46, 0.52] } },
  { name: 'BENCH_CHEST', arms: true, t: { handL: [0.20, 1.40, 0.16], handR: [-0.20, 1.40, 0.16] } },

  // Dance lanes (arms; legs near neutral — the body bob/tilt is on the root group).
  { name: 'DANCE_NEUTRAL', t: { handL: [0.24, 0.98, 0.12], handR: [-0.24, 0.98, 0.12] } },
  { name: 'DANCE_UP', t: { handL: [0.18, 1.86, 0.06], handR: [-0.18, 1.86, 0.06] } },
  { name: 'DANCE_DOWN', t: { handL: [0.26, 1.02, 0.34], handR: [-0.26, 1.02, 0.34],
    footL: [0.18, 0.02, 0.10], footR: [-0.18, 0.02, 0.10] } },
  { name: 'DANCE_LEFT', t: { handL: [0.46, 1.42, 0.10], handR: [-0.04, 1.16, 0.30] } },
  { name: 'DANCE_RIGHT', t: { handL: [0.04, 1.16, 0.30], handR: [-0.46, 1.42, 0.10] } },

  // Swimming: prone glide (arms reaching forward, legs trailing) — animated on top.
  { name: 'SWIM_PRONE', t: { handL: [0.16, 1.46, 0.40], handR: [-0.16, 1.46, 0.40],
    footL: [0.16, 0.55, -0.30], footR: [-0.16, 0.55, -0.30] } },
  // Treading water: arms out to the sides sculling, knees up in front.
  { name: 'SWIM_TREAD', t: { handL: [0.42, 1.20, 0.22], handR: [-0.42, 1.20, 0.22],
    footL: [0.18, 0.40, 0.34], footR: [-0.18, 0.40, 0.34] } },

  // Weed farm RIGHT-arm overlays: pour (tip the arm up), deal reach-out. (Carry needs no
  // pose — the bucket just rides the walk cycle.)
  { name: 'WEED_POUR', arms: true, t: { handR: [-0.20, 1.18, 0.40] } },
  { name: 'WEED_DEAL', arms: true, t: { handR: [-0.14, 1.10, 0.46] } },

  // NPC: hailing a taxi (right arm raised high) — animated wave on top. (No head aim: aimY
  // points the CROWN at the target, which over-tilts the face down — head stays on the clip.)
  { name: 'NPC_WAVE', arms: true, t: { handR: [-0.30, 1.74, 0.12] } },
  // NPC: cutscene talking gesture (both hands up, mid-gesture) — animated on top.
  { name: 'NPC_TALK', arms: true, t: { handL: [0.26, 1.18, 0.34], handR: [-0.26, 1.18, 0.34] } },

  // Roof-fall ragdoll: limbs loose/up as the body tumbles — animated jiggle on top.
  { name: 'RAGDOLL', t: { handL: [0.34, 1.55, 0.05], handR: [-0.34, 1.55, 0.05],
    footL: [0.20, 0.30, 0.20], footR: [-0.20, 0.30, 0.20] } },
];

console.log('// AUTO-GENERATED by tools/gen-glb-poses.ts — do not hand-edit; re-run to regenerate.');
console.log('// Bone-local Euler rotations [x,y,z] for the HumanArmature rig.');
for (const p of POSES) console.log(dump(p.name, p.t, p.arms));
