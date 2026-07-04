// View layer for remote players: one rigged avatar (same NPC GLB pipeline) +
// floating name tag per online player, moved by interpolating server snapshots
// ~INTERP_DELAY_MS in the past. updateNpcGlb() (main loop) picks idle/walk/run
// from the group's own movement, so animation is automatic here.
import * as THREE from 'three';
import { refs } from '@/core/state.ts';
import { scene } from '@/core/engine.ts';
import { makeRemoteAvatar, makeNameTag } from '../../assets/models/characters/remote-player.ts';
import { disposeNpcGlb, setNpcGlbSeated } from '../../assets/models/characters/npc-glb.ts';
import { INTERP_DELAY_MS, wrapAngle, type MoveMode, type PlayerPub, type SnapRow } from '../../shared/net/protocol.ts';

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
      addRemote({ id, nick: 'Player ' + id, x: row[1], y: row[2], z: row[3], h: row[4], m: (row[5] | 0) as MoveMode, i: row[6] ? 1 : 0 }, ts);
      r = remotes.get(id);
      if (!r) continue;
    }
    r.buf.push({ t: ts, x: row[1], y: row[2], z: row[3], h: row[4] });
    if (r.buf.length > 20) r.buf.splice(0, r.buf.length - 20);
    if (r.m !== ((row[5] | 0) as MoveMode)) applyMode(r, (row[5] | 0) as MoveMode);
    r.interior = !!row[6];
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
  const r: Remote = { id: p.id, nick: p.nick, g, tag, buf: [{ t, x: p.x, y: p.y, z: p.z, h: p.h }], m: 0, interior: !!p.i, seated: false };
  remotes.set(p.id, r);
  applyMode(r, p.m);
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

function removeRemote(id: number): void {
  const r = remotes.get(id);
  if (!r) return;
  remotes.delete(id);
  disposeNpcGlb(r.g);
  r.g.parent?.remove(r.g);
  r.tag.parent?.remove(r.tag);
  r.tag.material.map?.dispose();
  r.tag.material.dispose();
}

export function clearRemotes(): void {
  for (const id of [...remotes.keys()]) removeRemote(id);
}

/** Per-frame: place every remote at the interpolated pose. Cheap when empty. */
export function updateRemotes(): void {
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
    r.g.position.set(x, y, z);
    r.g.rotation.y = h;
    r.tag.position.set(x, y + TAG_Y, z);
    let vis = !r.interior;
    if (vis && pp) {
      const dx = x - pp.x, dz = z - pp.z, d2 = dx * dx + dz * dz;
      vis = d2 < VIS_DIST2;
      r.tag.visible = vis && d2 < TAG_DIST2;
    } else r.tag.visible = false;
    r.g.visible = vis;
  }
}
