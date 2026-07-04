// View layer for remote players: one rigged avatar (same NPC GLB pipeline) +
// floating name tag per online player, moved by interpolating server snapshots
// ~INTERP_DELAY_MS in the past. updateNpcGlb() (main loop) picks idle/walk/run
// from the group's own movement, so animation is automatic here.
import * as THREE from 'three';
import { state, refs, carColors } from '@/core/state.ts';
import { scene } from '@/core/engine.ts';
import { gunshot } from '@/audio/audio.ts';
import { makeRemoteAvatar, makeNameTag } from '../../assets/models/characters/remote-player.ts';
import { makeWeaponTracerLine } from '../../assets/models/effects/weapon-tracer.ts';
import { disposeNpcGlb, setNpcGlbSeated } from '../../assets/models/characters/npc-glb.ts';
import { makeCar, makeMotorcycle, makeBoat, makePlane, disposeGeometries } from '@/core/entities.ts';
import { makeTractor } from '../../assets/models/vehicles/tractor.ts';
import { SEAT_OFFSET, GLB_SEAT_OFFSET } from '@/actors/vehicle-pose.ts';
import { INTERP_DELAY_MS, wrapAngle, type MoveMode, type PlayerPub, type SnapRow, type Vec3 } from '../../shared/net/protocol.ts';

interface Sample { t: number; x: number; y: number; z: number; h: number }
interface Remote {
  id: number;
  nick: string;
  g: THREE.Group;
  tag: THREE.Sprite;
  buf: Sample[];
  m: MoveMode;
  interior: boolean;
  seated: boolean;
  /** vehicle kind currently rendered (protocol vk; 0 = on foot) */
  vk: number;
  /** the vehicle model; when set, the avatar rides as its CHILD at the seat */
  veh: THREE.Object3D | null;
}

const remotes = new Map<number, Remote>();
let myId = -1;
/** serverMs − performance.now(), EWMA-smoothed from snapshot stamps. */
let clockOffset: number | null = null;

const VIS_DIST2 = 170 * 170;   // beyond the fog there is nothing to draw
const TAG_DIST2 = 48 * 48;     // name tags only near the player
const SNAP_JUMP = 9;           // >9 m between samples = legit teleport (hospital, interiors): snap, don't glide
const TAG_Y = 2.55;

export const remoteCount = (): number => remotes.size;
export const getMyOnlineId = (): number => myId;

// ---- combat v1 fx: tracers + gunshot audio + death pose for remote shots ----
const shotFx: { line: THREE.Line; at: number }[] = [];
const _sv0 = new THREE.Vector3(), _sv1 = new THREE.Vector3();

/** A bullet fired by another player: tracer + distance-faded bang + brief aim
 * pose on the shooter — and the local ambient (NPC scatter) reacts exactly as
 * it does to your own gunfire. No-op for your own echoes. */
export function remoteShotFx(by: number, o: Vec3, d: Vec3): void {
  if (by === myId) return;                        // my own shot echoed back
  const r = remotes.get(by);
  if (r) r.g.userData.npcAimT = state.time;       // shooter strikes the aim pose
  const pp = refs.playerPos?.();
  const dist = pp ? Math.hypot(o[0] - pp.x, o[2] - pp.z) : 999;
  if (dist > 180) return;                         // past the fog and out of earshot
  _sv0.set(o[0], o[1], o[2]);
  _sv1.set(o[0] + d[0] * 3.2, o[1] + d[1] * 3.2, o[2] + d[2] * 3.2);
  const line = makeWeaponTracerLine(_sv0, _sv1);
  scene.add(line);
  shotFx.push({ line, at: performance.now() });
  gunshot(Math.max(0.12, 1 - dist / 160));
  state.shotT = state.time; state.shotX = o[0]; state.shotZ = o[2]; // NPCs scatter
}

/** Server-declared PvP death/respawn: lie down / get back up. */
export function setRemoteDead(id: number, dead: boolean): void {
  const r = remotes.get(id);
  if (!r) return;
  r.g.userData.npcDead = dead || undefined;
  r.g.userData.npcGrounded = dead || undefined;   // settle straight into the Lie clip
}

export function handleWelcome(id: number, players: PlayerPub[]): void {
  myId = id;
  clearRemotes();
  clockOffset = null;
  for (const p of players) addRemote(p, 0);
}

export function handleAdd(p: PlayerPub): void { addRemote(p, 0); }

export function handleDel(id: number): void { removeRemote(id); }

export function handleSnap(ts: number, rows: SnapRow[]): void {
  const off = ts - performance.now();
  clockOffset = clockOffset === null ? off : clockOffset + (off - clockOffset) * 0.1;
  for (const row of rows) {
    const id = row[0] | 0;
    if (id === myId) continue;
    let r = remotes.get(id);
    if (!r) {
      // seen before its 'add' (e.g. right after the DO woke from hibernation)
      addRemote({ id, nick: 'Player ' + id, x: row[1], y: row[2], z: row[3], h: row[4], m: (row[5] | 0) as MoveMode, i: row[6] ? 1 : 0, vk: row[7] | 0 }, ts);
      r = remotes.get(id);
      if (!r) continue;
    }
    r.buf.push({ t: ts, x: row[1], y: row[2], z: row[3], h: row[4] });
    if (r.buf.length > 20) r.buf.splice(0, r.buf.length - 20);
    if (r.m !== ((row[5] | 0) as MoveMode)) applyMode(r, (row[5] | 0) as MoveMode);
    r.interior = !!row[6];
    applyVehicle(r, row[7] | 0); // column absent on a v1 server → 0 (on foot)
  }
}

function addRemote(p: PlayerPub, t: number): void {
  if (p.id === myId || remotes.has(p.id)) return;
  const g = makeRemoteAvatar(p.id);          // adds itself to the scene
  const tag = makeNameTag(p.nick);
  scene.add(tag);
  g.position.set(p.x, p.y, p.z);
  g.rotation.y = p.h;
  tag.position.set(p.x, p.y + TAG_Y, p.z);
  const r: Remote = { id: p.id, nick: p.nick, g, tag, buf: [{ t, x: p.x, y: p.y, z: p.z, h: p.h }], m: 0, interior: !!p.i, seated: false, vk: 0, veh: null };
  remotes.set(p.id, r);
  applyMode(r, p.m);
  applyVehicle(r, p.vk | 0); // undefined from a v1 server → 0
}

function applyMode(r: Remote, m: MoveMode): void {
  r.m = m;
  const seated = m === 1 || m === 2 || m === 3; // in a vehicle: ride the 'sit' clip
  if (seated === r.seated) return;
  r.seated = seated;
  if (seated) setNpcGlbSeated(r.g);
  else {
    r.g.userData.npcSeated = false;
    const h = r.g.userData.glbNpc as { seated?: boolean } | undefined;
    if (h) h.seated = false;
  }
}

// ---- remote vehicles ---------------------------------------------------------
// Vehicles are still client-local entities, so only the KIND is synced (protocol
// vk); the body colour is a stable palette pick per player id — every viewer sees
// the same colour, just not necessarily the one the driver stole. The avatar
// rides as a CHILD of the vehicle model at the same seat offsets the real game
// uses to seat the hero (vehicle-pose.ts / player.ts).
const CAR_SEAT_GLB: [number, number, number] = [-0.380, -0.157, -0.031]; // player.ts GLB car seat
const _wp = new THREE.Vector3();

function seatFor(vk: number): [number, number, number] {
  if (vk === 2) return GLB_SEAT_OFFSET.bike;
  if (vk === 3) return SEAT_OFFSET.boat;
  if (vk === 4) return SEAT_OFFSET.plane;
  if (vk === 5) return SEAT_OFFSET.tractor;
  return CAR_SEAT_GLB; // 1 car, 6 police, 7 taxi
}

function buildVehicle(vk: number, id: number): THREE.Object3D {
  const color = carColors[Math.abs(id) % carColors.length];
  switch (vk) {
    case 2: return makeMotorcycle(color);
    case 3: return makeBoat(color, false);
    case 4: return makePlane();
    case 5: return makeTractor();
    case 6: return makeCar(0xe8e8ee, true);   // police cruiser livery
    case 7: return makeCar(0xffd24a, false);  // cab yellow
    default: return makeCar(color, false);
  }
}

function applyVehicle(r: Remote, vk: number): void {
  if (r.vk === vk) return;
  r.vk = vk;
  if (r.veh) {
    // step out: back to the scene at the vehicle's world position (no 1-frame
    // flicker at the origin — the next updateRemotes() places it exactly)
    r.veh.getWorldPosition(_wp);
    scene.add(r.g);
    r.g.position.copy(_wp);
    r.g.rotation.set(0, r.veh.rotation.y, 0);
    scene.remove(r.veh);
    disposeGeoms(r.veh);
    r.veh = null;
  }
  if (vk > 0) {
    const v = buildVehicle(vk, r.id);          // factories scene.add() themselves
    v.position.copy(r.g.position);             // spawn where the avatar already is
    v.rotation.y = r.g.rotation.y;
    v.add(r.g);                                // ride as a child...
    r.g.position.fromArray(seatFor(vk));       // ...at the seat (vehicle-local)
    r.g.rotation.set(0, 0, 0);
    r.veh = v;
  }
}

// Only geometries: several vehicle materials are shared module-level singletons
// (e.g. the police beam material), so materials/textures must NOT be disposed.
function disposeGeoms(o: THREE.Object3D): void {
  o.traverse(c => { (c as THREE.Mesh).geometry?.dispose?.(); });
}

function removeRemote(id: number): void {
  const r = remotes.get(id);
  if (!r) return;
  remotes.delete(id);
  disposeNpcGlb(r.g);
  r.g.parent?.remove(r.g);
  if (r.veh) { scene.remove(r.veh); disposeGeoms(r.veh); r.veh = null; }
  r.tag.parent?.remove(r.tag);
  r.tag.material.map?.dispose();
  r.tag.material.dispose();
}

export function clearRemotes(): void {
  for (const id of [...remotes.keys()]) removeRemote(id);
  for (const fx of shotFx) {
    disposeGeometries(fx.line);
    (fx.line.material as THREE.Material).dispose();
    fx.line.parent?.remove(fx.line);
  }
  shotFx.length = 0;
}

/** Per-frame: place every remote at the interpolated pose. Cheap when empty. */
export function updateRemotes(): void {
  if (shotFx.length) {                            // fade remote tracers (mirrors weapons.ts, ~140ms)
    const nowMs = performance.now();
    for (let i = shotFx.length - 1; i >= 0; i--) {
      if (nowMs - shotFx[i].at < 140) continue;
      const l = shotFx[i].line;
      disposeGeometries(l);
      (l.material as THREE.Material).dispose();   // makeWeaponTracerLine clones its material
      l.parent?.remove(l);
      shotFx.splice(i, 1);
    }
  }
  if (!remotes.size) return;
  const now = performance.now();
  const rt = clockOffset === null ? null : now + clockOffset - INTERP_DELAY_MS;
  const pp = refs.playerPos?.();
  for (const r of remotes.values()) {
    const buf = r.buf;
    if (!buf.length) continue;
    let x: number, y: number, z: number, h: number;
    if (rt === null || buf.length === 1 || rt >= buf[buf.length - 1].t) {
      const s = buf[buf.length - 1];                 // no bracket yet / feed stalled: hold last
      x = s.x; y = s.y; z = s.z; h = s.h;
      if (buf.length > 3) buf.splice(0, buf.length - 3);
    } else {
      while (buf.length > 2 && buf[1].t <= rt) buf.shift();
      const s0 = buf[0], s1 = buf[1];
      const span = s1.t - s0.t;
      let a = span > 1 ? (rt - s0.t) / span : 1;
      if (a < 0) a = 0; else if (a > 1) a = 1;
      const jx = s1.x - s0.x, jz = s1.z - s0.z;
      if (jx * jx + jz * jz > SNAP_JUMP * SNAP_JUMP) { x = s1.x; y = s1.y; z = s1.z; h = s1.h; }
      else {
        x = s0.x + jx * a;
        y = s0.y + (s1.y - s0.y) * a;
        z = s0.z + jz * a;
        h = s0.h + wrapAngle(s1.h - s0.h) * a;
      }
    }
    if (r.veh) {
      // driving: the pose is the VEHICLE's origin; the avatar rides as a child
      r.veh.position.set(x, y, z);
      r.veh.rotation.y = h;
    } else {
      r.g.position.set(x, y, z);
      r.g.rotation.y = h;
    }
    r.tag.position.set(x, y + TAG_Y, z);
    let vis = !r.interior;
    if (vis && pp) {
      const dx = x - pp.x, dz = z - pp.z, d2 = dx * dx + dz * dz;
      vis = d2 < VIS_DIST2;
      r.tag.visible = vis && d2 < TAG_DIST2;
    } else r.tag.visible = false;
    r.g.visible = vis;
    if (r.veh) r.veh.visible = vis;
  }
}
