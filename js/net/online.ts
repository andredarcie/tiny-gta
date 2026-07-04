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
import { SEND_HZ, type MoveMode, type RemotePose } from '../../shared/net/protocol.ts';
import { isJoined, netMaintain, netPing, netSendPos, netSendShot, netStatus, type NetHandlers } from './net-client.ts';
import {
  clearRemotes, getMyOnlineId, handleAdd, handleDel, handleSnap, handleWelcome,
  remoteCount, remoteMeleeFx, remoteNick, remoteShotFx, setRemoteDead, updateRemotes,
} from './remote-players.ts';

const PROD_WS = 'wss://tiny-gta-mp.andredarcie.workers.dev/ws';

let enabled = false;
let acc = 0;
let last: RemotePose | null = null;

const handlers: NetHandlers = {
  onWelcome: handleWelcome,
  onAdd: handleAdd,
  onDel: handleDel,
  onSnap: handleSnap,
  onShot: (by, o, d, hit, hp, k) => {
    if (k === 1) remoteMeleeFx(by);               // punch swing on the remote avatar
    else remoteShotFx(by, o, d);                  // tracer/bang/aim pose (no-op for own echo)
    const me = getMyOnlineId();
    if (hit && by === me) {
      // hitmarker: the server confirmed MY bullet connected
      thud(3);
      state.crosshairKick = Math.max(state.crosshairKick, .6);
    }
    if (hit && hit === me && hp >= 0) {
      // The server decided I was hit. Its PvP hp is an authoritative CEILING on
      // my local health — damage lands through the normal pipeline, so the
      // existing wasted/hospital flow handles death and respawn untouched.
      if (state.health > hp) state.health = hp;
      state.shake = Math.max(state.shake, .3);
    }
  },
  onDeath: (id, by) => {
    setRemoteDead(id, true);                      // own id: the shot already zeroed health
    const me = getMyOnlineId();
    if (id === me) refs.radioMessage?.(`<b>${remoteNick(by)}</b> took you down.`, 6000);
    else if (by === me) {
      refs.message?.('YOU TOOK DOWN ' + remoteNick(id), '#ff2e88');
      refs.radioMessage?.(`You took down <b>${remoteNick(id)}</b>.`, 5000);
    } else refs.radioMessage?.(`<b>${remoteNick(by)}</b> took down <b>${remoteNick(id)}</b>.`, 5000);
  },
  onSpawn: (id) => setRemoteDead(id, false),
  onDropped: () => { clearRemotes(); last = null; },
};

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
  // Called by weapons.ts for every hitscan bullet it fires (after spread).
  // The client only says "I fired from O toward D" — the SERVER decides hits.
  refs.onlineShot = (origin, dir, damage, range) => {
    if (!enabled || !isJoined()) return;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    netSendShot({
      t: 'shot',
      o: [r2(origin.x), r2(origin.y), r2(origin.z)],
      d: [r3(dir.x), r3(dir.y), r3(dir.z)],
      dm: damage | 0,
      rg: Math.round(range),
      k: 0,
    });
  };
  // Called by weapons.ts for every melee swing: same server-decided hit
  // pipeline with a ~2m reach; remotes see the punch clip instead of a tracer.
  refs.onlineMelee = (range: number, lethal: boolean) => {
    if (!enabled || !isJoined()) return;
    const pp = refs.playerPos?.();
    if (!pp) return;
    let h = refs.getPlayerHeading?.() ?? 0;
    if (!Number.isFinite(h)) h = 0;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    netSendShot({
      t: 'shot',
      o: [r2(pp.x), r2(pp.y + 1.2), r2(pp.z)],
      d: [Math.round(Math.sin(h) * 1000) / 1000, 0, Math.round(Math.cos(h) * 1000) / 1000],
      dm: lethal ? 2 : 1,
      rg: Math.max(1, Math.min(3, Math.round(range))),
      k: 1,
    });
  };
}

function resolveEnabled(): boolean {
  try {
    const v = new URLSearchParams(location.search).get('mp');
    if (v === '0' || v === 'off') return false;
  } catch (e) { /* no URL (tests): stay enabled */ }
  return true;
}

function wsUrl(): string {
  try {
    const o = new URLSearchParams(location.search).get('mpserver');
    if (o) return o;
  } catch (e) {}
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
      try { clearRemotes(); } catch (e2) {}
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
  const pose = samplePose();
  if (pose && (!last || poseChanged(last, pose))) {
    netSendPos(pose);
    last = pose;
  }
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
  // avatar down + blood puddle until the hospital respawn flips this back
  const dead = state.health <= 0 || !!refs.getWasted?.() ? 1 : 0;
  return { x: r(px), y: r(py), z: r(pz), h: Math.round(h * 1000) / 1000, m, i: state.interior ? 1 : 0, vk, d: dead as 0 | 1 };
}

function poseChanged(a: RemotePose, b: RemotePose): boolean {
  return Math.abs(a.x - b.x) > 0.02 || Math.abs(a.z - b.z) > 0.02 || Math.abs(a.y - b.y) > 0.05
    || Math.abs(a.h - b.h) > 0.01 || a.m !== b.m || a.i !== b.i || a.vk !== b.vk || a.d !== b.d;
}
