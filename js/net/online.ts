// Online glue: decides IF/WHERE to connect, samples the local player's pose at
// SEND_HZ (only when it changed) and drives the remote-player views. The whole
// feature is fail-open: server down/full/offline → the game just plays
// single-player, silently retrying in the background.
//
// URL switches: ?mp=off disables the online layer; ?mpserver=ws://... overrides
// the server (used by the local wrangler dev loop and tests).
import { state, refs } from '@/core/state.ts';
import { getNickname, getPlayerId } from '@/ui/leaderboard.ts';
import { SEND_HZ, type MoveMode, type RemotePose } from '../../shared/net/protocol.ts';
import { isJoined, netMaintain, netSendPos, netStatus, type NetHandlers } from './net-client.ts';
import { clearRemotes, handleAdd, handleDel, handleSnap, handleWelcome, remoteCount, updateRemotes } from './remote-players.ts';

const PROD_WS = 'wss://tiny-gta-mp.andredarcie.workers.dev/ws';

let enabled = false;
let acc = 0;
let last: RemotePose | null = null;

const handlers: NetHandlers = {
  onWelcome: handleWelcome,
  onAdd: handleAdd,
  onDel: handleDel,
  onSnap: handleSnap,
  onDropped: () => { clearRemotes(); last = null; },
};

export function initOnline(): void {
  enabled = resolveEnabled();
  refs.getOnlineState = () => ({ enabled, ...netStatus(), remotes: remoteCount() });
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

export function updateOnline(dt: number): void {
  if (!enabled) return;
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
  let m: MoveMode = 0;
  if (state.mode === 'car' && cur) m = cur.plane ? 3 : cur.boat ? 2 : 1;
  else if (state.swimming) m = 4;
  let h = refs.getPlayerHeading?.() ?? 0;
  if (!Number.isFinite(h)) h = 0;
  const r = (v: number) => Math.round(v * 100) / 100;
  return { x: r(pp.x), y: r(pp.y), z: r(pp.z), h: Math.round(h * 1000) / 1000, m, i: state.interior ? 1 : 0 };
}

function poseChanged(a: RemotePose, b: RemotePose): boolean {
  return Math.abs(a.x - b.x) > 0.02 || Math.abs(a.z - b.z) > 0.02 || Math.abs(a.y - b.y) > 0.05
    || Math.abs(a.h - b.h) > 0.01 || a.m !== b.m || a.i !== b.i;
}
