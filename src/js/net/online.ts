// Online glue: decides IF/WHERE to connect, samples the local player's pose at
// SEND_HZ (only when it changed) and drives the remote-player views. The whole
// feature is fail-open: server down/full/offline → the game just plays
// single-player, silently retrying in the background.
//
// URL switches: ?mp=off disables the online layer; ?mpserver=ws://... overrides
// the server (used by the local wrangler dev loop and tests).
import { state, refs } from '@/core/state.ts';
import { getNickname, getPlayerId } from '@/ui/leaderboard.ts';
import { thud } from '@/audio/audio.ts';
import { SEND_HZ, type AreaHit, type AttackKind, type MoveMode, type RemotePose } from '../../../shared/net/protocol.ts';
import { clampHealth, deadPoseFlag, shouldSyncLocalHeal, shouldTriggerLocalWasted } from '../../../shared/net/online-lifecycle.ts';
import { isJoined, netMaintain, netPing, netSendHeal, netSendPos, netSendShot, netStatus, type NetHandlers } from './net-client.ts';
import {
  clearRemotes, getMyOnlineId, handleAdd, handleDel, handleSnap, handleWelcome, localHitBlood,
  remoteBlastFx, remoteCount, remoteHitBlood, remoteMeleeFx, remoteNick, remoteShotFx, setRemoteDead, updateRemotes,
} from './remote-players.ts';

// Dev/test introspection facade: the two-player online harness reads the remote
// poses through render_game_to_text (see js/core/main.ts). Gameplay never calls it.
export { remoteSnapshot } from './remote-players.ts';

const PROD_WS = 'wss://tiny-gta-mp.andredarcie.workers.dev/ws';

let enabled = false;
let acc = 0;
let last: RemotePose | null = null;
let lastHealthSeen = 100;

const handlers: NetHandlers = {
  onWelcome: (id, players) => {
    handleWelcome(id, players);
    lastHealthSeen = clampHealth(state.health);
  },
  onAdd: handleAdd,
  onDel: handleDel,
  onSnap: handleSnap,
  onShot: ({ by, o, d, hit, hp, k, hits }) => {
    if (k === 1) remoteMeleeFx(by);               // punch swing on the remote avatar
    else if (k === 2) remoteBlastFx(by, o);       // explosion/fire-pool visual pulse
    else remoteShotFx(by, o, d);                  // tracer/bang/aim pose (no-op for own echo)
    const me = getMyOnlineId();
    if (by === me && (hit || hits.length)) {
      // hitmarker: the server confirmed MY attack connected
      thud(3);
      state.crosshairKick = Math.max(state.crosshairKick, .6);
    }
    // Blood: the server just confirmed these hits, so splatter at every struck
    // player — the attacker and bystanders SEE the punch/shot connect (punches
    // spray less than gunfire). Struck REMOTES bleed on their avatar; if I'm the
    // one hit I bleed on my own body below.
    const amt = k === 1 ? 8 : k === 2 ? 12 : 10;
    if (hit && hit !== me) remoteHitBlood(hit, d, amt);
    for (const [id] of hits) if (id !== me) remoteHitBlood(id, d, amt);
    const ownAreaHp = ownAreaHit(hits, me);
    if (hit === me && hp >= 0) applyServerHp(hp);
    else if (ownAreaHp >= 0) applyServerHp(ownAreaHp);
    if ((hit === me && hp >= 0) || ownAreaHp >= 0) {
      state.shake = Math.max(state.shake, .3);
      localHitBlood(d, amt);                        // I'm the victim: bleed on my own body too
    }
  },
  onDeath: (id, by) => {
    setRemoteDead(id, true);
    const me = getMyOnlineId();
    if (id === me) {
      // A remote player killed me (server-decided). Drive the LOCAL wasted flow so
      // the PvP kill actually drops me and sends me to the hospital. Nothing else
      // does: the on-foot pipeline has no generic health<=0 check — only specific
      // hazards (cops, traffic, drowning) trigger WASTED, and in a pure PvP fight
      // none may be present. Without this the victim is left at 0 HP, walking,
      // un-hittable and lying dead to everyone else until the server respawn.
      // getWasted() self-guards (returns if already dying), so this is idempotent.
      lastHealthSeen = 0;
      if (shouldTriggerLocalWasted(0, !!refs.isWasted?.())) refs.getWasted?.();
      refs.radioMessage?.(`<b>${remoteNick(by)}</b> took you down.`, 6000);
    }
    else if (by === me) {
      refs.message?.('YOU TOOK DOWN ' + remoteNick(id), '#ff2e88');
      refs.radioMessage?.(`You took down <b>${remoteNick(id)}</b>.`, 5000);
    } else refs.radioMessage?.(`<b>${remoteNick(by)}</b> took down <b>${remoteNick(id)}</b>.`, 5000);
  },
  onSpawn: (id) => {
    setRemoteDead(id, false);
    if (id === getMyOnlineId()) lastHealthSeen = clampHealth(state.health);
  },
  onDropped: () => { clearRemotes(); last = null; lastHealthSeen = clampHealth(state.health); },
};

function ownAreaHit(hits: AreaHit[], me: number): number {
  for (const [id, hp] of hits) if (id === me) return hp;
  return -1;
}

function applyServerHp(hp: number): void {
  const next = clampHealth(hp);
  if (state.health > next) state.health = next;
  lastHealthSeen = state.health;
  if (shouldTriggerLocalWasted(next, !!refs.isWasted?.())) refs.getWasted?.();
}

// Wire-compaction: positions to 2 decimals, unit-ray components to 3. Defined
// once at module scope (not re-created on every shot).
const r2 = (v: number): number => Math.round(v * 100) / 100;
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

interface Vec3ish { x: number; y: number; z: number }

// The ONE place every weapon path reports an attack. The client only states
// "I attacked from O toward D"; the SERVER alone decides who was hit (see
// server/src/world.ts). Centralizing the guard + rounding + message shape keeps
// the four public entry points below to a single line each.
function sendAttack(k: AttackKind, o: Vec3ish, d: Vec3ish, damage: number, range: number): void {
  if (!enabled || !isJoined()) return;
  netSendShot({
    t: 'shot',
    o: [r2(o.x), r2(o.y), r2(o.z)],
    d: [r3(d.x), r3(d.y), r3(d.z)],
    dm: damage | 0,
    rg: Math.round(range),
    k,
  });
}

export function initOnline(): void {
  enabled = resolveEnabled();
  // Consumed by the HUD (players/ping lines under the FPS meter) and by the
  // render_game_to_text debug snapshot.
  refs.getOnlineState = () => ({
    enabled,
    ...netStatus(),
    remotes: remoteCount(),
    players: isJoined() ? remoteCount() + 1 : 0, // world population, me included
    ping: netPing(),
  });
  // weapons.ts fires these for each attack; each just names the kind, its origin
  // and direction — sendAttack() does the rest (guard/round/send).
  // Hitscan bullet (after spread): "I fired from origin toward dir".
  refs.onlineShot = (origin, dir, damage, range) => sendAttack(0, origin, dir, damage, range);
  // Melee swing (~2m reach): origin/dir derived from the player's pose; remotes
  // play the punch clip instead of a tracer.
  refs.onlineMelee = (range, lethal) => {
    const pp = refs.playerPos?.();
    if (!pp) return;
    let h = refs.getPlayerHeading?.() ?? 0;
    if (!Number.isFinite(h)) h = 0;
    sendAttack(1, { x: pp.x, y: pp.y + 1.2, z: pp.z }, { x: Math.sin(h), y: 0, z: Math.cos(h) }, lethal ? 2 : 1, range);
  };
  // Radial blast / fire-pool tick centered on origin (dir is unused; straight-up
  // just keeps the ray non-degenerate for the server parser).
  refs.onlineBlast = (origin, damage, radius) => sendAttack(2, origin, { x: 0, y: 1, z: 0 }, damage, radius);
  // Flamethrower cone: a short ray the server tests like a fat bullet.
  refs.onlineFlame = (origin, dir, damage, range) => sendAttack(3, origin, dir, damage, range);
}

function resolveEnabled(): boolean {
  try {
    const v = new URLSearchParams(location.search).get('mp');
    if (v === '0' || v === 'off') return false;
  } catch { /* no URL (tests): stay enabled */ }
  return true;
}

function wsUrl(): string {
  try {
    const o = new URLSearchParams(location.search).get('mpserver');
    if (o) return o;
  } catch { /* no URL (tests): fall through to the default server */ }
  if (import.meta.env.DEV) return `ws://${location.hostname}:8787/ws`;
  return PROD_WS;
}

const SEND_INTERVAL = 1 / SEND_HZ;

// Fail-open insurance: the presence layer must NEVER be able to break the
// game. Any unexpected exception here is caught; after 3 strikes the whole
// online mode disables itself for the session (single-player unaffected).
let errStrikes = 0;

export function updateOnline(dt: number): void {
  if (!enabled) return;
  try { updateOnlineInner(dt); } catch (e) {
    if (++errStrikes >= 3) {
      enabled = false;
      try { clearRemotes(); } catch { /* nothing left to salvage */ }
      console.warn('[online] disabled after repeated errors:', e);
    }
  }
}

function updateOnlineInner(dt: number): void {
  updateRemotes();
  if (!state.started) return;
  acc += dt;
  if (acc < SEND_INTERVAL) return;
  acc = 0;
  netMaintain(wsUrl(), getNickname() || 'Player', getPlayerId() || 'anon', handlers);
  if (!isJoined()) return;
  syncLocalHeal();
  const pose = samplePose();
  if (pose && (!last || poseChanged(last, pose))) {
    netSendPos(pose);
    last = pose;
  }
}

function syncLocalHeal(): void {
  const hp = clampHealth(state.health);
  if (hp < lastHealthSeen) { lastHealthSeen = hp; return; }
  if (!shouldSyncLocalHeal(hp, lastHealthSeen)) return;
  lastHealthSeen = hp;
  netSendHeal(Math.round(hp));
}

function samplePose(): RemotePose | null {
  const pp = refs.playerPos?.();
  if (!pp) return null;
  const cur = refs.getCur?.();
  let m: MoveMode = 0, vk = 0, px = pp.x, py = pp.y, pz = pp.z;
  if (state.mode === 'car' && cur) {
    m = cur.plane ? 3 : cur.boat ? 2 : 1;
    vk = cur.plane ? 4 : cur.boat ? 3 : cur.bike ? 2 : cur.tractor ? 5 : cur.police ? 6 : cur.taxi ? 7 : 1;
    // While driving, share the VEHICLE's origin (viewers render the vehicle
    // there and seat the avatar inside it — mirrors how the game seats us).
    px = cur.g.position.x; py = cur.g.position.y; pz = cur.g.position.z;
  } else if (state.swimming) m = 4;
  let h = refs.getPlayerHeading?.() ?? 0;
  if (!Number.isFinite(h)) h = 0;
  const r = (v: number) => Math.round(v * 100) / 100;
  // dead from ANY local cause (roof fall, cops, drowning, PvP): remotes lie the
  // avatar down + blood puddle until the hospital respawn flips this back.
  // NOTE: deadPoseFlag reads isWasted() (a predicate) — NOT getWasted(), which
  // TRIGGERS the death and would kill the local player on every sample (~10Hz).
  const dead = deadPoseFlag(state.health, !!refs.isWasted?.());
  return { x: r(px), y: r(py), z: r(pz), h: Math.round(h * 1000) / 1000, m, i: state.interior ? 1 : 0, vk, d: dead as 0 | 1 };
}

function poseChanged(a: RemotePose, b: RemotePose): boolean {
  return Math.abs(a.x - b.x) > 0.02 || Math.abs(a.z - b.z) > 0.02 || Math.abs(a.y - b.y) > 0.05
    || Math.abs(a.h - b.h) > 0.01 || a.m !== b.m || a.i !== b.i || a.vk !== b.vk || a.d !== b.d;
}
