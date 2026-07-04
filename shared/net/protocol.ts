// Wire protocol for the shared-world presence server — movement v1.
// Pure TypeScript, ZERO dependencies and ZERO DOM/Workers APIs: this file is
// imported by BOTH the browser client (js/net/**) and the Cloudflare Worker
// server (server/src/**), and unit-tested in Node (test/unit).
//
// v1 scope (see ONLINE_MULTIPLAYER_PLAN.md, revision 2): every player shares ONE
// world; clients report their own pose (position/heading/mode) at up to SEND_HZ
// and the server validates structure/bounds, keeps the authoritative roster and
// rebroadcasts. Full input-driven server simulation lands in later increments.

export const PROTOCOL_VERSION = 1;
/** Client sends at most this many pose updates per second (only when moving). */
export const SEND_HZ = 10;
/** Server broadcast cadence (ms) while at least one player is moving. */
export const SNAP_INTERVAL_MS = 100;
/** World capacity — beyond this, new joiners get {t:'full'} and play offline. */
export const DEFAULT_MAX_PLAYERS = 32;
export const NICK_MAX = 16;
/** Any client message longer than this is dropped (kick on binary/oversize). */
export const MAX_MSG_BYTES = 512;
// World bounds (map is ~±750 with the island at x≈-500; planes fly high/far).
export const POS_LIMIT_XZ = 2200;
export const POS_MIN_Y = -12;
export const POS_MAX_Y = 800;
/** Keepalive: the server answers 'p' with 'o' WITHOUT waking the Durable Object
 * (WebSocket auto-response) — free on the Cloudflare side, keeps NATs open. */
export const KEEPALIVE_PING = 'p';
export const KEEPALIVE_PONG = 'o';
/** Ping cadence: doubles as keepalive AND live RTT for the HUD "PING" line.
 * Auto-response pairs are not billed and never wake the DO, so 3 s is free. */
export const PING_INTERVAL_MS = 3_000;
/** Remote entities render this far in the past so two snapshots bracket the
 * render time and interpolation stays smooth across network jitter. */
export const INTERP_DELAY_MS = 150;
export const WS_CLOSE_FULL = 4001;
export const WS_CLOSE_PROTOCOL = 4002;

/** 0 on foot, 1 car/bike, 2 boat, 3 plane, 4 swimming. */
export type MoveMode = 0 | 1 | 2 | 3 | 4;

export interface RemotePose {
  x: number;
  y: number;
  z: number;
  /** heading (rad, wrapped to [-PI, PI]) */
  h: number;
  m: MoveMode;
  /** 1 while inside an interior (remote avatar is hidden) */
  i: 0 | 1;
}

export interface PlayerPub extends RemotePose {
  id: number;
  nick: string;
}

/** Compact snapshot row: [id, x, y, z, h, m, i]. */
export type SnapRow = [number, number, number, number, number, number, number];

export type ClientMsg =
  | { t: 'join'; v: number; nick: string; pid: string }
  | ({ t: 'pos' } & RemotePose);

export type ServerMsg =
  | { t: 'welcome'; id: number; max: number; players: PlayerPub[] }
  | { t: 'add'; p: PlayerPub }
  | { t: 'del'; id: number }
  | { t: 'snap'; ts: number; p: SnapRow[] }
  | { t: 'full' }
  | { t: 'bye'; reason: string };

export const clampNum = (v: number, a: number, b: number): number =>
  v < a ? a : v > b ? b : v;

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Printable, short, safe display name; never empty. Non-strings (objects
 * would stringify to "[object Object]") are rejected outright. */
export function sanitizeNick(raw: unknown): string {
  const s = typeof raw === 'string'
    ? raw.replace(/[^\w .\-[\]]/g, '').trim().slice(0, NICK_MAX).trim()
    : '';
  return s || 'Player';
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** Parse + validate a client message. Returns null for anything malformed —
 * the server silently drops those (never crashes, never trusts). Position
 * fields are clamped to world bounds and the heading is wrapped. */
export function parseClientMsg(raw: string): ClientMsg | null {
  if (raw.length > MAX_MSG_BYTES) return null;
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return null; }
  if (typeof o !== 'object' || o === null) return null;
  const m = o as Record<string, unknown>;
  if (m.t === 'join') {
    if (typeof m.pid !== 'string' || m.pid.length === 0 || m.pid.length > 64) return null;
    return { t: 'join', v: typeof m.v === 'number' ? m.v : 0, nick: sanitizeNick(m.nick), pid: m.pid };
  }
  if (m.t === 'pos') {
    const x = num(m.x), y = num(m.y), z = num(m.z), h = num(m.h);
    if (x === null || y === null || z === null || h === null) return null;
    let mode = typeof m.m === 'number' ? m.m | 0 : 0;
    if (mode < 0 || mode > 4) mode = 0;
    return {
      t: 'pos',
      x: clampNum(x, -POS_LIMIT_XZ, POS_LIMIT_XZ),
      y: clampNum(y, POS_MIN_Y, POS_MAX_Y),
      z: clampNum(z, -POS_LIMIT_XZ, POS_LIMIT_XZ),
      h: wrapAngle(h),
      m: mode as MoveMode,
      i: m.i ? 1 : 0,
    };
  }
  return null;
}
