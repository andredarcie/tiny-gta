// WebSocket transport for the shared-world presence layer. Pure plumbing:
// connect → join → dispatch server messages to handlers; reconnection with
// exponential backoff; longer back-off when the world reports it is FULL
// (design: a full world means this player simply keeps playing offline).
// Sampling/what-to-send lives in online.ts; rendering in remote-players.ts.
import {
  KEEPALIVE_PING, KEEPALIVE_PONG, PING_INTERVAL_MS, PROTOCOL_VERSION,
  type AreaHit, type ClientMsg, type PlayerPub, type RemotePose, type ShotMsg, type SnapRow, type Vec3,
} from '../../../shared/net/protocol.ts';

/** A remote attack the server broadcast (k=0 bullet, 1 melee, 2 blast, 3 flame).
 * `hit`/`hp` describe a single confirmed direct hit (-1 = none); `hits` carries
 * the per-target results of an area attack (blast). Both may be empty for a miss. */
export interface RemoteShot {
  by: number;
  o: Vec3;
  d: Vec3;
  k: number;
  hit: number;
  hp: number;
  hits: AreaHit[];
}

export interface NetHandlers {
  onWelcome(id: number, players: PlayerPub[]): void;
  onAdd(p: PlayerPub): void;
  onDel(id: number): void;
  onSnap(ts: number, rows: SnapRow[]): void;
  onShot(ev: RemoteShot): void;
  onDeath(id: number, by: number): void;
  onSpawn(id: number): void;
  onDropped(): void;
}

let ws: WebSocket | null = null;
let phase: 'idle' | 'connecting' | 'joined' = 'idle';
let nextTryAt = 0;
let backoff = 5_000;              // 5s → 10s → ... → 60s on plain failures
let fullUntil = 0;                // world full: retry only after 5 minutes
let pingTimer: ReturnType<typeof setInterval> | null = null;
let pingSentAt = 0;               // performance.now() of the ping in flight (0 = none)
// HUD PING = the MINIMUM of the recent samples, not an average: the pong is
// processed on the main thread, so any render jank inflates individual samples
// — the window minimum shows the true network RTT instead of frame hiccups.
let rttSamples: number[] = [];
let rttMs: number | null = null;

export const isJoined = (): boolean => phase === 'joined';

/** Network RTT in ms (min of the recent probe window); null while offline. */
export const netPing = (): number | null => (phase === 'joined' ? rttMs : null);

export function netStatus(): Record<string, unknown> {
  return {
    phase,
    worldFull: performance.now() < fullUntil,
    retryInMs: phase === 'idle' ? Math.max(0, Math.round(Math.max(nextTryAt, fullUntil) - performance.now())) : 0,
  };
}

// One send path for every outbound message: no-op unless joined, and a failed
// send is swallowed — the socket's close handler drives the reconnect.
function send(msg: ClientMsg): void {
  if (phase !== 'joined' || !ws) return;
  try { ws.send(JSON.stringify(msg)); } catch { /* drop; close handler reconnects */ }
}

export function netSendPos(p: RemotePose): void { send({ t: 'pos', ...p }); }
export function netSendShot(m: ShotMsg): void { send(m); }
export function netSendHeal(hp: number): void { send({ t: 'heal', hp }); }

/** Call periodically (the online glue calls it every send tick): opens/reopens
 * the connection when allowed. Cheap no-op while connected or backing off. */
export function netMaintain(url: string, nick: string, pid: string, h: NetHandlers): void {
  if (phase !== 'idle') return;
  const now = performance.now();
  if (now < nextTryAt || now < fullUntil) return;
  let sock: WebSocket;
  try { sock = new WebSocket(url); } catch {
    nextTryAt = now + backoff; backoff = Math.min(backoff * 2, 60_000);
    return;
  }
  phase = 'connecting';
  ws = sock;
  let gotFull = false;
  sock.onopen = () => {
    try { sock.send(JSON.stringify({ t: 'join', v: PROTOCOL_VERSION, nick, pid })); } catch { /* close handler reconnects */ }
  };
  sock.onmessage = (ev: MessageEvent) => {
    if (typeof ev.data !== 'string') return;
    if (ev.data === KEEPALIVE_PONG) {  // auto-response echo: close the RTT sample
      if (pingSentAt) {
        const r = performance.now() - pingSentAt;
        rttSamples.push(r);
        if (rttSamples.length > 5) rttSamples.shift();
        rttMs = Math.min(...rttSamples);
        pingSentAt = 0;
      }
      return;
    }
    const m = parseJson(ev.data);
    if (!m || typeof m.t !== 'string') return;
    try { // fail-open: a broken handler must not take the connection down with it
    switch (m.t) {
      case 'welcome':
        phase = 'joined'; backoff = 5_000;
        h.onWelcome((m.id as number) | 0, Array.isArray(m.players) ? m.players as PlayerPub[] : []);
        startPing(sock);
        break;
      case 'add': if (m.p) h.onAdd(m.p as PlayerPub); break;
      case 'del': h.onDel((m.id as number) | 0); break;
      case 'snap': if (Array.isArray(m.p)) h.onSnap(Number(m.ts) || 0, m.p as SnapRow[]); break;
      case 'shot':
        if (Array.isArray(m.o) && Array.isArray(m.d))
          h.onShot({
            by: (m.by as number) | 0,
            o: m.o as Vec3,
            d: m.d as Vec3,
            k: (m.k as number) | 0,
            hit: (m.hit as number) | 0,
            hp: typeof m.hp === 'number' ? m.hp : -1,
            hits: Array.isArray(m.hits) ? m.hits as AreaHit[] : [],
          });
        break;
      case 'death': h.onDeath((m.id as number) | 0, (m.by as number) | 0); break;
      case 'spawn': h.onSpawn((m.id as number) | 0); break;
      case 'full': gotFull = true; break;
    }
    } catch (e) { console.warn('[online] message handler error:', e); }
  };
  const drop = () => {
    if (ws !== sock) return;
    stopPing();
    ws = null;
    const wasJoined = phase === 'joined';
    phase = 'idle';
    const nw = performance.now();
    if (gotFull) fullUntil = nw + 5 * 60_000;
    else { nextTryAt = nw + backoff; backoff = Math.min(backoff * 2, 60_000); }
    rttMs = null; pingSentAt = 0; rttSamples = [];
    if (wasJoined) h.onDropped();
  };
  sock.onclose = drop;
  sock.onerror = () => { try { sock.close(); } catch { /* already gone */ } drop(); };
}

/** JSON.parse that never throws: returns the object, or null on syntax error or
 * a non-object payload. */
function parseJson(s: string): Record<string, unknown> | null {
  try {
    const o = JSON.parse(s) as unknown;
    return o !== null && typeof o === 'object' ? o as Record<string, unknown> : null;
  } catch { return null; }
}

function startPing(sock: WebSocket): void {
  stopPing();
  // Keepalive + RTT probe, outside the rAF loop on purpose: it must run while
  // the game is paused/minimized. The server answers via auto-response (free,
  // no DO wake), and the 'o' echo closes the RTT sample for the HUD PING line.
  pingTimer = setInterval(() => {
    try { pingSentAt = performance.now(); sock.send(KEEPALIVE_PING); } catch { /* close handler reconnects */ }
  }, PING_INTERVAL_MS);
}
function stopPing(): void {
  if (pingTimer !== null) { clearInterval(pingTimer); pingTimer = null; }
}
