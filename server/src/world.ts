// WorldDO — THE single shared world (no rooms: everyone plays together).
// Design decision (user): one world for all players; when it is full, whoever
// arrives next simply plays offline (the client falls back silently).
//
// Movement v1: the DO owns the roster (ids, nicks, join/leave), validates and
// clamps every reported pose, and rebroadcasts snapshots at SNAP_INTERVAL_MS.
// It uses the WebSocket Hibernation API so idle worlds cost ~zero: the
// broadcast interval stops after QUIET_TICKS with nobody moving, keepalive
// pings are answered by auto-response without waking the object, and sessions
// survive hibernation via socket attachments (+ parked poses in storage).
import {
  DEFAULT_MAX_PLAYERS, KEEPALIVE_PING, KEEPALIVE_PONG, MAX_MSG_BYTES,
  SNAP_INTERVAL_MS, WS_CLOSE_FULL, WS_CLOSE_PROTOCOL,
  HIT_CHEST_Y, HIT_RADIUS, MELEE_DMG_HP, PVP_HP_MAX, PVP_REGEN_PER_S, PVP_RESPAWN_MS,
  SHOT_BUCKET_CAP, SHOT_BUCKET_REFILL_PER_S, SHOT_DMG_HP, SHOT_REWIND_MS,
  parseClientMsg, raySphereT,
  type AreaHit, type PlayerPub, type RemotePose, type ServerMsg, type ShotMsg, type SnapRow,
} from '../../shared/net/protocol.ts';

export interface Env {
  WORLD: DurableObjectNamespace;
  MAX_PLAYERS?: string;
  /** rotate the world to a fresh DO (placement is decided at creation) */
  WORLD_NAME?: string;
  /** locationHint for that first creation, e.g. 'sam' (South America) */
  WORLD_HINT?: string;
}

import { checkMove, clampPoseY } from '../../shared/sim/move-check.ts';

interface Att { id: number; nick: string; pid: string }
interface HistSample { t: number; x: number; y: number; z: number }
interface Session extends Att {
  ws: WebSocket;
  pose: RemotePose | null;
  dirty: boolean;
  /** broadcast 'add' only once the first pose arrives (no ghost at origin) */
  announced: boolean;
  msgs: number;
  msgWindow: number;
  // ---- combat v1 (all decided HERE, never by clients) ----
  hp: number;
  hpAt: number;          // last regen timestamp
  deadUntil: number;     // >now while waiting to respawn (shots in/out ignored)
  shotTokens: number;    // rate budget (burst = one full shotgun blast)
  shotRefillAt: number;
  hist: HistSample[];    // short pose history for the lag-comp rewind
  posAt: number;         // timestamp of the last ACCEPTED pose (speed checks)
  tpAt: number;          // last accepted teleport (budget: 1 per cooldown)
}

const freshCombat = () => ({
  hp: PVP_HP_MAX, hpAt: 0, deadUntil: 0,
  shotTokens: SHOT_BUCKET_CAP, shotRefillAt: 0, hist: [] as HistSample[],
  posAt: 0, tpAt: 0,
});

/** Stop the broadcast interval (and allow hibernation) after this many
 * consecutive empty ticks — 30 s of nobody moving. */
const QUIET_TICKS = 300;
const RATE_MAX_PER_SEC = 40;

export class WorldDO {
  private ctx: DurableObjectState;
  private env: Env;
  private sessions = new Map<WebSocket, Session>();
  private nextId = 1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private quiet = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(KEEPALIVE_PING, KEEPALIVE_PONG));
    // Rebuild sessions after hibernation/restart: identity rides on the socket
    // attachment; the last known poses were parked in storage on quiet-stop.
    for (const ws of ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Att | null;
      if (!a) continue;
      this.sessions.set(ws, { ...a, ws, pose: null, dirty: false, announced: true, msgs: 0, msgWindow: 0, ...freshCombat() });
      if (a.id >= this.nextId) this.nextId = a.id + 1;
    }
    if (this.sessions.size) {
      ctx.blockConcurrencyWhile(async () => {
        const parked = await ctx.storage.get<Record<string, RemotePose>>('poses');
        if (parked) for (const s of this.sessions.values()) {
          const p = parked[String(s.id)];
          if (p) s.pose = { ...p, vk: p.vk | 0, d: (p.d | 0) as 0 | 1 }; // older parked blobs lack vk/d
        }
      });
    }
  }

  private maxPlayers(): number {
    const n = Number(this.env.MAX_PLAYERS);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_PLAYERS;
  }

  /** Which Cloudflare colo this DO actually runs in — THE latency diagnostic
   * (a Brazil player pinging a US-homed DO explains a 150ms+ HUD PING). */
  private doColo: string | null = null;

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/health') {
      if (this.doColo === null) {
        this.doColo = '?';
        try {
          const t = await fetch('https://www.cloudflare.com/cdn-cgi/trace').then(r => r.text());
          this.doColo = /colo=([A-Z]+)/.exec(t)?.[1] ?? '?';
        } catch { /* diagnostics only */ }
      }
      return Response.json({ players: this.sessions.size, max: this.maxPlayers(), worldColo: this.doColo });
    }
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.ctx.acceptWebSocket(server);
    if (this.sessions.size >= this.maxPlayers()) {
      // Tell the client explicitly so it backs off longer than on a plain error.
      server.send(JSON.stringify({ t: 'full' } satisfies ServerMsg));
      server.close(WS_CLOSE_FULL, 'world full');
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, raw: ArrayBuffer | string): void {
    if (typeof raw !== 'string' || raw.length > MAX_MSG_BYTES) {
      ws.close(WS_CLOSE_PROTOCOL, 'bad message');
      return;
    }
    const known = this.sessions.get(ws);
    if (known) { // flood guard: drop past the per-second budget (jitter-tolerant)
      const now = (Date.now() / 1000) | 0;
      if (known.msgWindow !== now) { known.msgWindow = now; known.msgs = 0; }
      if (++known.msgs > RATE_MAX_PER_SEC) return;
    }
    const m = parseClientMsg(raw);
    if (!m) return; // malformed: silent drop, never crash
    if (m.t === 'join') { this.onJoin(ws, m.nick, m.pid); return; }
    const s = this.sessions.get(ws);
    if (!s) { ws.close(WS_CLOSE_PROTOCOL, 'join first'); return; }
    if (m.t === 'shot') { this.onShot(s, m); return; }
    if (m.t === 'heal') { this.onHeal(s, m.hp); return; }
    // pos — plausibility first: the server walks the SAME shared terrain as the
    // client, so impossible sustained speeds are dropped (one legit teleport per
    // cooldown survives: hospital/prison/race warps) and the height is clamped
    // into the plausible band (no under-the-map, no orbit).
    const now = Date.now();
    if (s.pose) {
      const v = checkMove(s.pose.x, s.pose.z, m.x, m.z, now - s.posAt, m.m, now - s.tpAt, s.pose.m);
      if (v === 'reject') return;
      if (v === 'teleport') s.tpAt = now;
    }
    s.posAt = now;
    s.pose = { x: m.x, y: clampPoseY(m.x, m.y, m.z, m.m), z: m.z, h: m.h, m: m.m, i: m.i, vk: m.vk, d: m.d };
    s.hist.push({ t: now, x: m.x, y: s.pose.y, z: m.z });
    if (s.hist.length > 8) s.hist.shift();
    s.dirty = true;
    if (!s.announced) {
      s.announced = true;
      this.broadcast({ t: 'add', p: this.pub(s) }, ws);
    }
    this.quiet = 0;
    this.ensureTicking();
  }

  private onJoin(ws: WebSocket, nick: string, pid: string): void {
    if (this.sessions.has(ws)) return; // duplicate join: ignore
    if (this.sessions.size >= this.maxPlayers()) {
      ws.send(JSON.stringify({ t: 'full' } satisfies ServerMsg));
      ws.close(WS_CLOSE_FULL, 'world full');
      return;
    }
    const id = this.nextId++;
    const s: Session = { id, nick, pid, ws, pose: null, dirty: false, announced: false, msgs: 0, msgWindow: 0, ...freshCombat() };
    this.sessions.set(ws, s);
    ws.serializeAttachment({ id, nick, pid } satisfies Att);
    const players: PlayerPub[] = [];
    for (const o of this.sessions.values()) if (o !== s && o.pose) players.push(this.pub(o));
    ws.send(JSON.stringify({ t: 'welcome', id, max: this.maxPlayers(), players } satisfies ServerMsg));
  }

  private pub(s: Session): PlayerPub {
    const p = s.pose!;
    return { id: s.id, nick: s.nick, x: p.x, y: p.y, z: p.z, h: p.h, m: p.m, i: p.i, vk: p.vk, d: p.d };
  }

  // ---- combat v1: every hit is decided HERE (ray vs rewound chest spheres) ----

  /** Target pose ~SHOT_REWIND_MS ago — roughly what the shooter's screen showed. */
  private rewound(s: Session, t: number): HistSample | null {
    const h = s.hist;
    if (!h.length) return s.pose ? { t, x: s.pose.x, y: s.pose.y, z: s.pose.z } : null;
    for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= t) return h[i];
    return h[0];
  }

  private onHeal(s: Session, hp: number): void {
    const now = Date.now();
    if (s.deadUntil > now) return;
    this.regen(s, now);
    s.hp = Math.max(s.hp, Math.min(PVP_HP_MAX, hp));
  }

  private regen(s: Session, now: number): void {
    if (s.hpAt) s.hp = Math.min(PVP_HP_MAX, s.hp + (now - s.hpAt) / 1000 * PVP_REGEN_PER_S);
    s.hpAt = now;
  }

  private damage(m: ShotMsg): number {
    return (m.k === 1 ? MELEE_DMG_HP : SHOT_DMG_HP)[m.dm];
  }

  private applyDamage(target: Session, now: number, damage: number): number {
    this.regen(target, now);
    target.hp -= damage;
    return Math.max(0, Math.round(target.hp));
  }

  private killIfNeeded(target: Session, attackerId: number, now: number): void {
    if (target.hp > 0) return;
    target.deadUntil = now + PVP_RESPAWN_MS;
    this.broadcast({ t: 'death', id: target.id, by: attackerId });
    this.ensureTicking();                         // the respawn timer lives in tick()
  }

  private onShot(s: Session, m: ShotMsg): void {
    const now = Date.now();
    // The dead fire no attacks (PvP OR local death). SYMMETRIC with the target
    // immunity below (interior/vehicle): a shooter who claims to be immune must
    // not also be able to deal damage — else a crafted client sends one pos with
    // i:1 (or a vehicle mode) to become invisible+unkillable AND keep killing
    // everyone. Honest clients only ever fire on foot (weapons.ts gates firing to
    // state.mode==='foot'), so this never rejects a legitimate shot.
    if (s.deadUntil > now || !s.pose || s.pose.d || s.pose.i || (s.pose.m >= 1 && s.pose.m <= 3)) return;
    // rate: token bucket sized so one shotgun blast of pellets fits as a burst
    if (s.shotRefillAt === 0) s.shotRefillAt = now;
    s.shotTokens = Math.min(SHOT_BUCKET_CAP, s.shotTokens + (now - s.shotRefillAt) / 1000 * SHOT_BUCKET_REFILL_PER_S);
    s.shotRefillAt = now;
    if (s.shotTokens < 1) return;
    s.shotTokens -= 1;
    // Hitscan/melee/flame start at the shooter. Explosions and fire pools happen
    // at the impact point, so a muzzle-origin check would incorrectly drop them.
    if (m.k !== 2) {
      const mx = m.o[0] - s.pose.x, mz = m.o[2] - s.pose.z;
      if (mx * mx + mz * mz > 36) return;
    }
    const ev: Extract<ServerMsg, { t: 'shot' }> = { t: 'shot', by: s.id, o: m.o, d: m.d, k: m.k };
    const dmg = this.damage(m);
    const rt = now - SHOT_REWIND_MS;

    if (m.k === 2) {
      const hits: AreaHit[] = [];
      const struck: Session[] = [];               // keep the refs so the kill pass below needs no re-lookup
      const reach = m.rg + HIT_RADIUS;
      const reach2 = reach * reach;
      for (const o of this.sessions.values()) {
        if (o === s || !o.pose || o.deadUntil > now) continue;
        if (o.pose.i || o.pose.d) continue;       // interiors/already-dead stay out of PvP blast damage
        const p = this.rewound(o, rt);
        if (!p) continue;
        const dx = p.x - m.o[0], dz = p.z - m.o[2];
        if (dx * dx + dz * dz > reach2) continue;
        hits.push([o.id, this.applyDamage(o, now, dmg)]);
        struck.push(o);
      }
      if (hits.length) ev.hits = hits;
      this.broadcast(ev);
      for (const o of struck) this.killIfNeeded(o, s.id, now);
      return;
    }

    let best: Session | null = null, bestT = Infinity;
    // Melee (k=1) aims off a coarse heading, so widen the target sphere a touch —
    // otherwise a punch that is only roughly on-target whiffs, and needing 3 clean
    // hits (protocol MELEE_DMG_HP) becomes impractical. Flame (k=3) already fattens
    // its cone the same way.
    const hitRadius = m.k === 3 ? HIT_RADIUS + 0.55 : m.k === 1 ? HIT_RADIUS + 0.45 : HIT_RADIUS;
    for (const o of this.sessions.values()) {
      if (o === s || !o.pose || o.deadUntil > now) continue;
      if (o.pose.i || o.pose.d || (o.pose.m >= 1 && o.pose.m <= 3)) continue; // interior/vehicle/already-dead: direct PvP-immune in v1
      const p = this.rewound(o, rt);
      if (!p) continue;
      const t = raySphereT(m.o[0], m.o[1], m.o[2], m.d[0], m.d[1], m.d[2],
        p.x, p.y + HIT_CHEST_Y, p.z, hitRadius, m.rg);
      if (t !== null && t < bestT) { bestT = t; best = o; }
    }
    if (best) {
      ev.hit = best.id;
      ev.hp = this.applyDamage(best, now, dmg);
    }
    this.broadcast(ev);
    if (best) this.killIfNeeded(best, s.id, now);
  }

  webSocketClose(ws: WebSocket): void { this.drop(ws); }
  webSocketError(ws: WebSocket): void { this.drop(ws); }

  private drop(ws: WebSocket): void {
    const s = this.sessions.get(ws);
    if (!s) return;
    this.sessions.delete(ws);
    if (s.announced) this.broadcast({ t: 'del', id: s.id });
    if (this.sessions.size === 0) this.stopTicking(true);
  }

  private broadcast(msg: ServerMsg, except?: WebSocket): void {
    const raw = JSON.stringify(msg);
    for (const s of this.sessions.values()) {
      if (s.ws === except) continue;
      try { s.ws.send(raw); } catch { /* dead socket: webSocketClose will reap it */ }
    }
  }

  private ensureTicking(): void {
    if (this.timer === null) this.timer = setInterval(() => this.tick(), SNAP_INTERVAL_MS);
  }

  /** Stop broadcasting; with no interval pending the runtime can hibernate the
   * object (duration billing stops) while the sockets stay connected. */
  private stopTicking(worldEmpty = false): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    if (worldEmpty) void this.ctx.storage.delete('poses');
    else void this.parkPoses();
  }

  private parkPoses(): Promise<void> {
    const o: Record<string, RemotePose> = {};
    for (const s of this.sessions.values()) if (s.pose) o[String(s.id)] = s.pose;
    return this.ctx.storage.put('poses', o);
  }

  private tick(): void {
    const now = Date.now();
    let pendingDead = false;
    for (const s of this.sessions.values()) {
      if (!s.deadUntil) continue;
      if (now >= s.deadUntil) {
        s.deadUntil = 0; s.hp = PVP_HP_MAX; s.hpAt = now;
        this.broadcast({ t: 'spawn', id: s.id });
      } else pendingDead = true;
    }
    const rows: SnapRow[] = [];
    for (const s of this.sessions.values()) {
      if (!s.dirty || !s.pose) continue;
      s.dirty = false;
      const p = s.pose;
      rows.push([s.id, p.x, p.y, p.z, p.h, p.m, p.i, p.vk | 0, p.d | 0]);
    }
    if (rows.length === 0) {
      if (!pendingDead && ++this.quiet >= QUIET_TICKS) this.stopTicking();
      return;
    }
    this.quiet = 0;
    if (this.sessions.size > 1) this.broadcast({ t: 'snap', ts: Date.now(), p: rows });
  }
}
