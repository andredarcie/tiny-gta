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
  parseClientMsg,
  type PlayerPub, type RemotePose, type ServerMsg, type SnapRow,
} from '../../shared/net/protocol.ts';

export interface Env {
  WORLD: DurableObjectNamespace;
  MAX_PLAYERS?: string;
}

interface Att { id: number; nick: string; pid: string }
interface Session extends Att {
  ws: WebSocket;
  pose: RemotePose | null;
  dirty: boolean;
  /** broadcast 'add' only once the first pose arrives (no ghost at origin) */
  announced: boolean;
  msgs: number;
  msgWindow: number;
}

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
      this.sessions.set(ws, { ...a, ws, pose: null, dirty: false, announced: true, msgs: 0, msgWindow: 0 });
      if (a.id >= this.nextId) this.nextId = a.id + 1;
    }
    if (this.sessions.size) {
      ctx.blockConcurrencyWhile(async () => {
        const parked = await ctx.storage.get<Record<string, RemotePose>>('poses');
        if (parked) for (const s of this.sessions.values()) {
          const p = parked[String(s.id)];
          if (p) s.pose = p;
        }
      });
    }
  }

  private maxPlayers(): number {
    const n = Number(this.env.MAX_PLAYERS);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_PLAYERS;
  }

  fetch(req: Request): Response {
    const url = new URL(req.url);
    if (url.pathname === '/health') {
      return Response.json({ players: this.sessions.size, max: this.maxPlayers() });
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
    // pos
    const s = this.sessions.get(ws);
    if (!s) { ws.close(WS_CLOSE_PROTOCOL, 'join first'); return; }
    s.pose = { x: m.x, y: m.y, z: m.z, h: m.h, m: m.m, i: m.i };
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
    const s: Session = { id, nick, pid, ws, pose: null, dirty: false, announced: false, msgs: 0, msgWindow: 0 };
    this.sessions.set(ws, s);
    ws.serializeAttachment({ id, nick, pid } satisfies Att);
    const players: PlayerPub[] = [];
    for (const o of this.sessions.values()) if (o !== s && o.pose) players.push(this.pub(o));
    ws.send(JSON.stringify({ t: 'welcome', id, max: this.maxPlayers(), players } satisfies ServerMsg));
  }

  private pub(s: Session): PlayerPub {
    const p = s.pose!;
    return { id: s.id, nick: s.nick, x: p.x, y: p.y, z: p.z, h: p.h, m: p.m, i: p.i };
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
    const rows: SnapRow[] = [];
    for (const s of this.sessions.values()) {
      if (!s.dirty || !s.pose) continue;
      s.dirty = false;
      const p = s.pose;
      rows.push([s.id, p.x, p.y, p.z, p.h, p.m, p.i]);
    }
    if (rows.length === 0) {
      if (++this.quiet >= QUIET_TICKS) this.stopTicking();
      return;
    }
    this.quiet = 0;
    if (this.sessions.size > 1) this.broadcast({ t: 'snap', ts: Date.now(), p: rows });
  }
}
