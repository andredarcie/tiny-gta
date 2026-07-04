// WebSocket transport for the shared-world presence layer. Pure plumbing:
// connect → join → dispatch server messages to handlers; reconnection with
// exponential backoff; longer back-off when the world reports it is FULL
// (design: a full world means this player simply keeps playing offline).
// Sampling/what-to-send lives in online.ts; rendering in remote-players.ts.
import {
  KEEPALIVE_MS, KEEPALIVE_PING, KEEPALIVE_PONG, PROTOCOL_VERSION,
  type PlayerPub, type RemotePose, type SnapRow,
} from '../../shared/net/protocol.ts';

export interface NetHandlers {
  onWelcome(id: number, players: PlayerPub[]): void;
  onAdd(p: PlayerPub): void;
  onDel(id: number): void;
  onSnap(ts: number, rows: SnapRow[]): void;
  onDropped(): void;
}

let ws: WebSocket | null = null;
let phase: 'idle' | 'connecting' | 'joined' = 'idle';
let nextTryAt = 0;
let backoff = 5_000;              // 5s → 10s → ... → 60s on plain failures
let fullUntil = 0;                // world full: retry only after 5 minutes
let pingTimer: ReturnType<typeof setInterval> | null = null;

export const isJoined = (): boolean => phase === 'joined';

export function netStatus(): Record<string, unknown> {
  return {
    phase,
    worldFull: performance.now() < fullUntil,
    retryInMs: phase === 'idle' ? Math.max(0, Math.round(Math.max(nextTryAt, fullUntil) - performance.now())) : 0,
  };
}

export function netSendPos(p: RemotePose): void {
  if (phase !== 'joined' || !ws) return;
  try { ws.send(JSON.stringify({ t: 'pos', ...p })); } catch (e) { /* drop; close handler reconnects */ }
}

/** Call periodically (the online glue calls it every send tick): opens/reopens
 * the connection when allowed. Cheap no-op while connected or backing off. */
export function netMaintain(url: string, nick: string, pid: string, h: NetHandlers): void {
  if (phase !== 'idle') return;
  const now = performance.now();
  if (now < nextTryAt || now < fullUntil) return;
  let sock: WebSocket;
  try { sock = new WebSocket(url); } catch (e) {
    nextTryAt = now + backoff; backoff = Math.min(backoff * 2, 60_000);
    return;
  }
  phase = 'connecting';
  ws = sock;
  let gotFull = false;
  sock.onopen = () => {
    try { sock.send(JSON.stringify({ t: 'join', v: PROTOCOL_VERSION, nick, pid })); } catch (e) {}
  };
  sock.onmessage = (ev: MessageEvent) => {
    if (typeof ev.data !== 'string' || ev.data === KEEPALIVE_PONG) return;
    let m: Record<string, unknown> | null = null;
    try { m = JSON.parse(ev.data) as Record<string, unknown>; } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'welcome':
        phase = 'joined'; backoff = 5_000;
        h.onWelcome((m.id as number) | 0, Array.isArray(m.players) ? m.players as PlayerPub[] : []);
        startPing(sock);
        break;
      case 'add': if (m.p) h.onAdd(m.p as PlayerPub); break;
      case 'del': h.onDel((m.id as number) | 0); break;
      case 'snap': if (Array.isArray(m.p)) h.onSnap(Number(m.ts) || 0, m.p as SnapRow[]); break;
      case 'full': gotFull = true; break;
    }
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
    if (wasJoined) h.onDropped();
  };
  sock.onclose = drop;
  sock.onerror = () => { try { sock.close(); } catch (e) {} drop(); };
}

function startPing(sock: WebSocket): void {
  stopPing();
  // Keepalive outside the rAF loop on purpose: it must run while the game is
  // paused/minimized. The server answers via auto-response (free, no DO wake).
  pingTimer = setInterval(() => { try { sock.send(KEEPALIVE_PING); } catch (e) {} }, KEEPALIVE_MS);
}
function stopPing(): void {
  if (pingTimer !== null) { clearInterval(pingTimer); pingTimer = null; }
}
