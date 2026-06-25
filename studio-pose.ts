// ===========================================================================
// studio-pose.ts — a small IK posing rig for /studio. Click a joint handle and
// drag it in 3D; the limb follows realistically (analytic 2-bone IK), respecting
// the skeleton. End-effector handles (feet, hands) drive their whole limb; the
// hips handle moves the body; the head handle tilts the head. Auto-pole bends the
// knees forward and the elbows back so the bend stays natural. Exposes the posed
// bone rotations so the user can copy a custom mount/seated pose.
// Dev-only tool — not part of the shipped game.
// ===========================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const _y = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _pw = new THREE.Quaternion(), _dq = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

// Swing a bone's +Y to point along dirW, PRESERVING its current roll (a minimal
// swing delta from the bone's current orientation — NOT an absolute world aim).
// Absolute aim (setFromUnitVectors from world +Y) ignores the bone's rest roll and
// wrings the limb base like twisted cloth; this keeps the natural roll.
function aimY(bone: THREE.Object3D, dirW: THREE.Vector3): void {
  if (dirW.lengthSq() < 1e-10) return;
  bone.getWorldQuaternion(_q);
  _v3.copy(_y).applyQuaternion(_q).normalize();              // current +Y in world
  _dq.setFromUnitVectors(_v3, _v2.copy(dirW).normalize());   // minimal swing onto dirW
  bone.getWorldQuaternion(_q); _q.premultiply(_dq);          // newWorld = swing * current
  if (bone.parent) { bone.parent.getWorldQuaternion(_pw); _q.premultiply(_pw.invert()); }
  bone.quaternion.copy(_q);
  bone.updateMatrixWorld(true);
}

// full 2-bone IK: rotate bone `a` and `b` so b's far end reaches targetW, bending
// toward poleW. La/Lb are the (rigid) bone lengths.
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

interface Limb { a: THREE.Object3D; b: THREE.Object3D; La: number; Lb: number; foot?: THREE.Object3D; front: number; }
interface Handle { mesh: THREE.Mesh; type: 'foot' | 'hand' | 'hips' | 'head'; side: 'L' | 'R' | ''; bone: THREE.Object3D; limb?: Limb; }

export interface PoseRig {
  enter(root: THREE.Object3D): void;
  exit(): void;
  update(): void;
  active(): boolean;
  dumpPose(): string;
}

export function createPoseRig(scene: THREE.Scene, camera: THREE.Camera, dom: HTMLElement, orbitTarget: THREE.Vector3): PoseRig & { orbit: OrbitControls | null } {
  let root: THREE.Object3D | null = null;
  let handles: Handle[] = [];
  let selected: Handle | null = null;
  let orbit: OrbitControls | null = null;
  let tcontrols: TransformControls | null = null;
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let isActive = false;
  let trackedBones: { name: string; bone: THREE.Object3D }[] = [];
  // hips drag bookkeeping
  let hipStartHandle = new THREE.Vector3(), hipStartRoot = new THREE.Vector3();

  const bone = (n: string): THREE.Object3D | null => {
    let b: THREE.Object3D | null = null;
    root!.traverse((o) => { if (!b && (o as THREE.Bone).isBone && o.name === n) b = o; });
    return b;
  };
  const wpos = (o: THREE.Object3D, out: THREE.Vector3) => out.setFromMatrixPosition(o.matrixWorld);
  const dist = (x: THREE.Object3D, y: THREE.Object3D) => wpos(x, _v).distanceTo(wpos(y, _v2));

  function mkHandle(color: number, r: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12),
      new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }));
    m.renderOrder = 999;
    return m;
  }

  // re-solve the limb / move the body when a handle is dragged
  function onChange(): void {
    if (!selected || !root) return;
    const h = selected;
    if (h.type === 'hips') {
      // translate the whole character by the handle delta
      root.position.copy(hipStartRoot).add(_v.copy(h.mesh.position).sub(hipStartHandle));
      root.updateMatrixWorld(true);
      return;
    }
    if (h.type === 'head') {
      aimY(h.bone, _v.copy(h.mesh.position).sub(wpos(h.bone, _v2)));
      return;
    }
    const L = h.limb!;
    const target = h.mesh.position;
    // auto-pole: knees bend toward the body's front, elbows away from it
    const front = _v.set(0, 0, h.type === 'foot' ? 1 : -1).applyQuaternion(root.getWorldQuaternion(_pw)).normalize();
    const hipW = wpos(L.a, _v2);
    const pole = _v3.copy(hipW).addScaledVector(front, 1).addScaledVector(_y, h.type === 'hand' ? -0.5 : 0);
    solve2Bone(L.a, L.b, L.La, L.Lb, target, pole);
    // for a foot (its own root-parented bone) move it onto the target too
    if (L.foot) {
      L.foot.parent!.worldToLocal(_v2.copy(target));
      L.foot.position.copy(_v2);
      L.foot.updateMatrixWorld(true);
    }
  }

  function onPointerDown(ev: PointerEvent): void {
    if (!isActive) return;
    const rect = dom.getBoundingClientRect();
    ptr.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ptr.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(handles.map((h) => h.mesh), false)[0];
    if (hit) {
      selected = handles.find((h) => h.mesh === hit.object)!;
      if (selected.type === 'hips') { hipStartHandle.copy(selected.mesh.position); hipStartRoot.copy(root!.position); }
      tcontrols!.attach(selected.mesh);
    }
  }

  return {
    orbit: null as OrbitControls | null,
    active() { return isActive; },

    enter(r: THREE.Object3D) {
      root = r; isActive = true;
      orbit = new OrbitControls(camera, dom);
      orbit.target.copy(orbitTarget); orbit.update();
      (this as { orbit: OrbitControls | null }).orbit = orbit;
      tcontrols = new TransformControls(camera, dom);
      tcontrols.setSize(0.8);
      tcontrols.addEventListener('dragging-changed', (e: { value: boolean }) => { if (orbit) orbit.enabled = !e.value; });
      tcontrols.addEventListener('objectChange', onChange);
      scene.add(tcontrols.getHelper ? tcontrols.getHelper() : (tcontrols as unknown as THREE.Object3D));

      const legL: Limb = { a: bone('UpperLegL')!, b: bone('LowerLegL')!, La: dist(bone('UpperLegL')!, bone('LowerLegL')!), Lb: dist(bone('LowerLegL')!, bone('LowerLegL_end')!), foot: bone('FootL')!, front: 1 };
      const legR: Limb = { a: bone('UpperLegR')!, b: bone('LowerLegR')!, La: dist(bone('UpperLegR')!, bone('LowerLegR')!), Lb: dist(bone('LowerLegR')!, bone('LowerLegR_end')!), foot: bone('FootR')!, front: 1 };
      const armL: Limb = { a: bone('UpperArmL')!, b: bone('LowerArmL')!, La: dist(bone('UpperArmL')!, bone('LowerArmL')!), Lb: dist(bone('LowerArmL')!, bone('PalmL')!), front: -1 };
      const armR: Limb = { a: bone('UpperArmR')!, b: bone('LowerArmR')!, La: dist(bone('UpperArmR')!, bone('LowerArmR')!), Lb: dist(bone('LowerArmR')!, bone('PalmR')!), front: -1 };

      const defs: { type: Handle['type']; side: Handle['side']; bone: THREE.Object3D; limb?: Limb; color: number; r: number }[] = [
        { type: 'foot', side: 'L', bone: bone('FootL')!, limb: legL, color: 0x2f9fd6, r: 0.05 },
        { type: 'foot', side: 'R', bone: bone('FootR')!, limb: legR, color: 0x2f9fd6, r: 0.05 },
        { type: 'hand', side: 'L', bone: bone('PalmL')!, limb: armL, color: 0x2fd68a, r: 0.05 },
        { type: 'hand', side: 'R', bone: bone('PalmR')!, limb: armR, color: 0x2fd68a, r: 0.05 },
        { type: 'hips', side: '', bone: bone('Body')!, color: 0xe2a33a, r: 0.06 },
        { type: 'head', side: '', bone: bone('Head')!, color: 0xc46fe2, r: 0.055 },
      ];
      handles = defs.filter((d) => d.bone).map((d) => {
        const mesh = mkHandle(d.color, d.r);
        wpos(d.bone, mesh.position);
        scene.add(mesh);
        return { mesh, type: d.type, side: d.side, bone: d.bone, limb: d.limb };
      });
      dom.addEventListener('pointerdown', onPointerDown);
    },

    update() {
      if (!isActive) return;
      orbit?.update();
      // keep non-dragged handles glued to their bones (so they track the live pose)
      for (const h of handles) {
        if (h === selected) continue;
        wpos(h.bone, h.mesh.position);
      }
    },

    exit() {
      isActive = false; selected = null;
      dom.removeEventListener('pointerdown', onPointerDown);
      for (const h of handles) { scene.remove(h.mesh); (h.mesh.material as THREE.Material).dispose(); h.mesh.geometry.dispose(); }
      handles = [];
      if (tcontrols) { tcontrols.detach(); scene.remove(tcontrols.getHelper ? tcontrols.getHelper() : (tcontrols as unknown as THREE.Object3D)); tcontrols.dispose(); tcontrols = null; }
      if (orbit) { orbit.dispose(); orbit = null; (this as { orbit: OrbitControls | null }).orbit = null; }
    },

    dumpPose(): string {
      if (!root) return '';
      const names = ['Body', 'UpperLegL', 'LowerLegL', 'FootL', 'UpperLegR', 'LowerLegR', 'FootR',
        'UpperArmL', 'LowerArmL', 'UpperArmR', 'LowerArmR', 'Neck', 'Head'];
      const e = new THREE.Euler();
      const lines = names.map((n) => {
        const b = bone(n); if (!b) return '';
        e.setFromQuaternion(b.quaternion);
        return `${n}: rot [${e.x.toFixed(3)}, ${e.y.toFixed(3)}, ${e.z.toFixed(3)}]`;
      }).filter(Boolean);
      const rp = root.position;
      return `root: [${rp.x.toFixed(3)}, ${rp.y.toFixed(3)}, ${rp.z.toFixed(3)}]\n` + lines.join('\n');
    },
  };
}
