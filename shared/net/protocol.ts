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

/** Vehicle model to render for a remote player (0 = none/on foot):
 * 1 car, 2 motorcycle, 3 boat, 4 plane, 5 tractor, 6 police car, 7 taxi.
 * Body colour is NOT synced yet (vehicles are still client-local entities);
 * viewers derive a stable palette colour from the player id. */
export const VK_MAX = 7;

export interface RemotePose {
  x: number;
  y: number;
  z: number;
  /** heading (rad, wrapped to [-PI, PI]) */
  h: number;
  m: MoveMode;
  /** 1 while inside an interior (remote avatar is hidden) */
  i: 0 | 1;
  /** vehicle kind being driven (see VK_MAX doc); 0 on foot. While driving, the
   * pose is the VEHICLE's origin — the avatar rides at the seat offset. */
  vk: number;
  /** 1 while DEAD from any local cause (falls, cops, drowning, PvP): remotes
   * lie the avatar down (+ blood puddle) until the hospital respawn flips it. */
  d: 0 | 1;
}

export interface PlayerPub extends RemotePose {
  id: number;
  nick: string;
}

/** Compact snapshot row: [id, x, y, z, h, m, i, vk, d]. Columns are append-only —
 * older clients destructure by index and ignore the tail, so adding here is
 * backward-compatible in both directions. */
export type SnapRow = [number, number, number, number, number, number, number, number, number];

export type Vec3 = [number, number, number];
export type AttackKind = 0 | 1 | 2 | 3;
export type AreaHit = [number, number]; // [playerId, hp]

/** One attack. k=0: a hitscan bullet (shotgun = one message per pellet).
 * k=1: a MELEE swing — same server-side hit pipeline with a ~2m reach and its
 * own damage table; remotes play the punch clip instead of a tracer.
 * k=2: radial blast/fire-pool tick around `o`; `rg` is radius.
 * k=3: short cone/flame ray. `dm` is the game's local damage unit (1..3);
 * the SERVER maps it to PvP HP and decides the hit — the client never claims
 * "I hit X". */
export interface ShotMsg { t: 'shot'; o: Vec3; d: Vec3; dm: number; rg: number; k: AttackKind }

export type ClientMsg =
  | { t: 'join'; v: number; nick: string; pid: string }
  | ({ t: 'pos' } & RemotePose)
  | ShotMsg
  | { t: 'heal'; hp: number };

export type ServerMsg =
  | { t: 'welcome'; id: number; max: number; players: PlayerPub[] }
  | { t: 'add'; p: PlayerPub }
  | { t: 'del'; id: number }
  | { t: 'snap'; ts: number; p: SnapRow[] }
  | { t: 'shot'; by: number; o: Vec3; d: Vec3; k: AttackKind; hit?: number; hp?: number; hits?: AreaHit[] }
  | { t: 'death'; id: number; by: number }
  | { t: 'spawn'; id: number }
  | { t: 'full' }
  | { t: 'bye'; reason: string };

// ---- combat v1 (PvP hits decided server-side; see server/src/world.ts) ------
/** Local damage units (1..3) → PvP HP damage. Index 0 unused. */
export const SHOT_DMG_HP = [0, 12, 18, 26] as const;
/** Melee damage: dm 1 = fists, dm 2+ = lethal blade/club. */
export const MELEE_DMG_HP = [0, 10, 18, 18] as const;
export const SHOT_RANGE_MAX = 80;
export const MELEE_RANGE_MAX = 3;
export const BLAST_RANGE_MAX = 8;
export const FLAME_RANGE_MAX = 10;
/** Shot-rate token bucket: burst covers a full shotgun blast of pellets. */
export const SHOT_BUCKET_CAP = 12;
export const SHOT_BUCKET_REFILL_PER_S = 12;
/** Hits test each target's pose ~this far in the past (what the shooter saw).
 * Sized for the real-world floor: BR players reach the US-homed world DO in
 * ~180ms RTT (DOs don't run in South America yet), so rewind ≈ RTT/2 + the
 * remote interp delay. */
export const SHOT_REWIND_MS = 250;
export const PVP_HP_MAX = 100;
/** Slow fallback regen between PvP hits; explicit local healing also syncs via
 * the heal message, so food/hospital recovery does not leave server HP stale. */
export const PVP_REGEN_PER_S = 2;
export const PVP_RESPAWN_MS = 5000;
/** Target = sphere around the chest (pose y is at the feet). */
export const HIT_RADIUS = 0.9;
export const HIT_CHEST_Y = 1.0;

/** Ray/sphere intersection: distance t along the (normalized) ray, or null.
 * Pure — shared so the server logic is unit-tested in Node. */
export function raySphereT(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  cx: number, cy: number, cz: number,
  r: number, maxT: number,
): number | null {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;      // closest approach along the ray
  if (tca < 0 || tca > maxT + r) return null;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return null;
  const t = tca - Math.sqrt(r2 - d2);
  return t >= 0 && t <= maxT ? t : null;
}

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
  if (m.t === 'heal') {
    const hp = num(m.hp);
    if (hp === null) return null;
    return { t: 'heal', hp: Math.round(clampNum(hp, 0, PVP_HP_MAX)) };
  }
  if (m.t === 'pos') {
    const x = num(m.x), y = num(m.y), z = num(m.z), h = num(m.h);
    if (x === null || y === null || z === null || h === null) return null;
    let mode = typeof m.m === 'number' ? m.m | 0 : 0;
    if (mode < 0 || mode > 4) mode = 0;
    let vk = typeof m.vk === 'number' ? m.vk | 0 : 0; // absent on v1 clients → on foot
    if (vk < 0 || vk > VK_MAX) vk = 0;
    return {
      t: 'pos',
      x: clampNum(x, -POS_LIMIT_XZ, POS_LIMIT_XZ),
      y: clampNum(y, POS_MIN_Y, POS_MAX_Y),
      z: clampNum(z, -POS_LIMIT_XZ, POS_LIMIT_XZ),
      h: wrapAngle(h),
      m: mode as MoveMode,
      i: m.i ? 1 : 0,
      vk,
      d: m.d ? 1 : 0,
    };
  }
  if (m.t === 'shot') {
    const o = vec3(m.o), d = vec3(m.d);
    if (!o || !d) return null;
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1e-4) return null;
    d[0] /= len; d[1] /= len; d[2] /= len;      // server only ever sees unit rays
    o[0] = clampNum(o[0], -POS_LIMIT_XZ, POS_LIMIT_XZ);
    o[1] = clampNum(o[1], POS_MIN_Y, POS_MAX_Y);
    o[2] = clampNum(o[2], -POS_LIMIT_XZ, POS_LIMIT_XZ);
    let dm = typeof m.dm === 'number' ? m.dm | 0 : 1;
    if (dm < 1) dm = 1; else if (dm > 3) dm = 3;
    const k: AttackKind = m.k === 1 ? 1 : m.k === 2 ? 2 : m.k === 3 ? 3 : 0;
    const rgMax = k === 1 ? MELEE_RANGE_MAX : k === 2 ? BLAST_RANGE_MAX : k === 3 ? FLAME_RANGE_MAX : SHOT_RANGE_MAX;
    let rg = typeof m.rg === 'number' ? m.rg | 0 : rgMax;
    if (rg < 1) rg = 1; else if (rg > rgMax) rg = rgMax;
    return { t: 'shot', o, d, dm, rg, k };
  }
  return null;
}

function vec3(v: unknown): Vec3 | null {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const a = num(v[0]), b = num(v[1]), c = num(v[2]);
  return a === null || b === null || c === null ? null : [a, b, c];
}
