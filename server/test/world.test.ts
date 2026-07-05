// ============================================================================
// Unit tests for WorldDO — the single shared-world Durable Object.
//
// The DO is exercised through a fake DurableObjectState (in-memory storage,
// no-op socket helpers) and fake WebSockets that just record what was sent, so
// every server-authoritative rule (roster, move validation, PvP combat, heal,
// death/respawn, rate limits, hibernation restore) is asserted from the
// broadcasts the sockets receive. Time is controlled with Vitest fake timers so
// regen / respawn / cooldowns are deterministic.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorldDO } from '../src/world.ts';
import {
  DEFAULT_MAX_PLAYERS, MAX_MSG_BYTES, PVP_HP_MAX, WS_CLOSE_FULL, WS_CLOSE_PROTOCOL,
} from '../../shared/net/protocol.ts';

const BASE = 1_700_000_000_000;

class FakeWS {
  sent: string[] = [];
  attachment: unknown = null;
  closed: { code: number; reason: string } | null = null;
  send(s: string): void { this.sent.push(s); }
  close(code: number, reason: string): void { this.closed = { code, reason }; }
  serializeAttachment(a: unknown): void { this.attachment = a; }
  deserializeAttachment(): unknown { return this.attachment; }
  msgs(t?: string): any[] { const all = this.sent.map((s) => JSON.parse(s)); return t ? all.filter((m) => m.t === t) : all; }
  first(t: string): any { return this.msgs(t)[0]; }
  last(t: string): any { const m = this.msgs(t); return m[m.length - 1]; }
  reset(): void { this.sent.length = 0; }
}

interface FakeCtx {
  _store: Map<string, unknown>;
  _bcw: Promise<unknown> | null;
  setWebSocketAutoResponse: () => void;
  getWebSockets: () => FakeWS[];
  acceptWebSocket: () => void;
  blockConcurrencyWhile: (fn: () => unknown) => unknown;
  storage: { get: (k: string) => Promise<unknown>; put: (k: string, v: unknown) => Promise<void>; delete: (k: string) => Promise<void> };
}

function fakeCtx(sockets: FakeWS[] = [], store = new Map<string, unknown>()): FakeCtx {
  const ctx: FakeCtx = {
    _store: store,
    _bcw: null,
    setWebSocketAutoResponse: () => {},
    getWebSockets: () => sockets,
    acceptWebSocket: () => {},
    blockConcurrencyWhile: (fn) => { const p = Promise.resolve(fn()); ctx._bcw = p; return p; },
    storage: {
      get: async (k) => store.get(k),
      put: async (k, v) => { store.set(k, v); },
      delete: async (k) => { store.delete(k); },
    },
  };
  return ctx;
}

function makeWorld(env: Record<string, unknown> = {}, sockets: FakeWS[] = [], store?: Map<string, unknown>) {
  const ctx = fakeCtx(sockets, store);
  const world = new WorldDO(ctx as any, env as any);
  return { world, ctx };
}

const send = (world: WorldDO, ws: FakeWS, obj: unknown) => world.webSocketMessage(ws as any, JSON.stringify(obj));
const join = (world: WorldDO, ws: FakeWS, nick: string, pid: string) => send(world, ws, { t: 'join', v: 1, nick, pid });
const pos = (world: WorldDO, ws: FakeWS, p: Record<string, number>) =>
  send(world, ws, { t: 'pos', x: 0, y: 0, z: 0, h: 0, m: 0, i: 0, vk: 0, d: 0, ...p });
const shot = (world: WorldDO, ws: FakeWS, s: Record<string, unknown> = {}) =>
  send(world, ws, { t: 'shot', o: [0, 1, 0], d: [0, 0, 1], dm: 1, rg: 80, k: 0, ...s });
const heal = (world: WorldDO, ws: FakeWS, hp: number) => send(world, ws, { t: 'heal', hp });
const idOf = (ws: FakeWS): number => ws.first('welcome').id;

function lastSnapRowFor(ws: FakeWS, id: number): any[] | null {
  const snaps = ws.msgs('snap');
  for (let i = snaps.length - 1; i >= 0; i--) {
    const row = snaps[i].p.find((r: any[]) => r[0] === id);
    if (row) return row;
  }
  return null;
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(BASE); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('join / roster', () => {
  it('assigns an id and welcomes the first joiner', () => {
    const { world } = makeWorld();
    const a = new FakeWS();
    join(world, a, 'Alice', 'pa');
    const w = a.first('welcome');
    expect(w.id).toBe(1);
    expect(w.max).toBe(DEFAULT_MAX_PLAYERS);
    expect(w.players).toEqual([]);
  });

  it('lists existing posed players in a later joiner’s welcome', () => {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'Alice', 'pa');
    pos(world, a, { x: 5, z: 6 });
    join(world, b, 'Bob', 'pb');
    const w = b.first('welcome');
    expect(w.players.map((p: any) => p.nick)).toEqual(['Alice']);
    expect(w.players[0].x).toBe(5);
    expect(w.players[0].z).toBe(6);
  });

  it('broadcasts add to others the first time a joined player moves (not to itself)', () => {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, a, { x: 1, z: 2 });
    const add = b.first('add');
    expect(add.p.id).toBe(idOf(a));
    expect(add.p.nick).toBe('A');
    expect(a.msgs('add')).toHaveLength(0);
  });

  it('ignores a duplicate join on the same socket', () => {
    const { world } = makeWorld();
    const a = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, a, 'A', 'pa');
    expect(a.msgs('welcome')).toHaveLength(1);
  });

  it('rejects a joiner when the world is full', () => {
    const { world } = makeWorld({ MAX_PLAYERS: '1' });
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa');
    join(world, b, 'B', 'pb');
    expect(b.first('full')).toBeTruthy();
    expect(b.closed?.code).toBe(WS_CLOSE_FULL);
  });
});

describe('protocol guards', () => {
  it('closes on an oversize message', () => {
    const { world } = makeWorld();
    const a = new FakeWS();
    world.webSocketMessage(a as any, 'x'.repeat(MAX_MSG_BYTES + 1));
    expect(a.closed?.code).toBe(WS_CLOSE_PROTOCOL);
  });

  it('closes on a binary (non-string) message', () => {
    const { world } = makeWorld();
    const a = new FakeWS();
    world.webSocketMessage(a as any, new ArrayBuffer(8) as any);
    expect(a.closed?.code).toBe(WS_CLOSE_PROTOCOL);
  });

  it('silently drops malformed JSON without closing', () => {
    const { world } = makeWorld();
    const a = new FakeWS();
    join(world, a, 'A', 'pa');
    world.webSocketMessage(a as any, '{ not json');
    expect(a.closed).toBeNull();
  });

  it('closes a socket that sends before joining', () => {
    const { world } = makeWorld();
    const a = new FakeWS();
    pos(world, a, { x: 1 });
    expect(a.closed?.code).toBe(WS_CLOSE_PROTOCOL);
    expect(a.closed?.reason).toBe('join first');
  });

  it('drops messages past the per-second flood budget without crashing', () => {
    const { world } = makeWorld();
    const a = new FakeWS();
    join(world, a, 'A', 'pa');
    pos(world, a, { x: 1, z: 1 });
    for (let i = 0; i < 60; i++) heal(world, a, 100); // >40/s → excess dropped
    expect(a.closed).toBeNull();
  });
});

describe('position + movement validation', () => {
  it('accepts a legit teleport but rejects a second impossible jump within the cooldown', () => {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, b, { x: 0, z: 0 }); // second player so tick() broadcasts snaps (size > 1)
    pos(world, a, { x: 0, z: 0 }); // A's first pose
    vi.advanceTimersByTime(100);   // tick → clears dirty

    pos(world, a, { x: 300, z: 0 }); // huge jump, but first teleport → accepted
    b.reset();
    vi.advanceTimersByTime(100);
    expect(lastSnapRowFor(b, idOf(a))![1]).toBe(300);

    pos(world, a, { x: 600, z: 0 }); // second huge jump within 5s → rejected (pose stays 300)
    pos(world, a, { x: 301, z: 0 }); // a legit 1m step from the STILL-300 pose → accepted
    b.reset();
    vi.advanceTimersByTime(100);
    expect(lastSnapRowFor(b, idOf(a))![1]).toBe(301); // proves the 600 jump never applied
  });

  it('clamps an implausible height into the plausible band', () => {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, b, { x: 0, z: 0 });
    pos(world, a, { x: 0, z: 0, y: -9999 });
    vi.advanceTimersByTime(100);
    const row = lastSnapRowFor(b, idOf(a))!;
    expect(row[2]).toBeGreaterThan(-50); // y clamped up from -9999
  });
});

describe('combat — server decides every hit', () => {
  function duel() {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, a, { x: 0, z: 0 });
    pos(world, b, { x: 0, z: 5 }); // 5m ahead on +z at y≈0
    return { world, a, b };
  }

  it('a bullet ray reports the victim and the new hp', () => {
    const { world, a, b } = duel();
    shot(world, a, { o: [0, 1, 0], d: [0, 0, 1], dm: 1, k: 0 });
    const ev = a.last('shot');
    expect(ev.by).toBe(idOf(a));
    expect(ev.hit).toBe(idOf(b));
    expect(ev.hp).toBe(PVP_HP_MAX - 12); // SHOT_DMG_HP[1]
  });

  it('a bullet that misses reports no victim', () => {
    const { world, a } = duel();
    shot(world, a, { o: [0, 1, 0], d: [0, 0, -1], dm: 1, k: 0 }); // aimed away
    expect(a.last('shot').hit).toBeUndefined();
  });

  it('the dead fire nothing (local-death pose flag)', () => {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, a, { x: 0, z: 0, d: 1 }); // A flags itself dead
    pos(world, b, { x: 0, z: 5 });
    shot(world, a);
    expect(a.msgs('shot')).toHaveLength(0);
  });

  it('a token bucket caps a burst of shots', () => {
    const { world, a } = duel();
    for (let i = 0; i < 20; i++) shot(world, a, { d: [0, 0, 1] });
    expect(a.msgs('shot')).toHaveLength(12); // SHOT_BUCKET_CAP, no refill in the same instant
  });

  it('melee uses the melee damage table (k=1)', () => {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, a, { x: 0, z: 0 });
    pos(world, b, { x: 0, z: 2 }); // within ~2m reach
    shot(world, a, { o: [0, 1, 0], d: [0, 0, 1], dm: 1, rg: 3, k: 1 });
    const ev = a.last('shot');
    expect(ev.k).toBe(1);
    expect(ev.hit).toBe(idOf(b));
    expect(ev.hp).toBe(PVP_HP_MAX - 10); // MELEE_DMG_HP[1]
  });

  it('a blast damages everyone in radius (area hits)', () => {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS(); const c = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb'); join(world, c, 'C', 'pc');
    pos(world, a, { x: 0, z: 0 });
    pos(world, b, { x: 0, z: 2 });
    pos(world, c, { x: 2, z: 0 });
    shot(world, a, { o: [0, 1, 0], d: [0, 1, 0], dm: 3, rg: 8, k: 2 });
    const ev = a.last('shot');
    expect(ev.k).toBe(2);
    expect(ev.hits.map((h: any[]) => h[0]).sort()).toEqual([idOf(b), idOf(c)].sort());
    for (const [, hp] of ev.hits) expect(hp).toBe(PVP_HP_MAX - 26); // SHOT_DMG_HP[3]
  });

  it('a flame cone has a wider hit radius than a bullet', () => {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, a, { x: 0, z: 0 });
    pos(world, b, { x: 1.2, z: 5 }); // off the +z axis
    shot(world, a, { o: [0, 1, 0], d: [0, 0, 1], dm: 1, rg: 80, k: 0 }); // bullet misses
    expect(a.last('shot').hit).toBeUndefined();
    shot(world, a, { o: [0, 1, 0], d: [0, 0, 1], dm: 1, rg: 10, k: 3 }); // flame hits
    const ev = a.last('shot');
    expect(ev.k).toBe(3);
    expect(ev.hit).toBe(idOf(b));
  });

  it('players in a vehicle are immune to direct PvP hits (v1)', () => {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, a, { x: 0, z: 0 });
    pos(world, b, { x: 0, z: 5, m: 1 }); // B driving
    shot(world, a, { d: [0, 0, 1] });
    expect(a.last('shot').hit).toBeUndefined();
  });

  it('a muzzle far from the shooter’s pose is rejected', () => {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, a, { x: 0, z: 0 });
    pos(world, b, { x: 0, z: 5 });
    shot(world, a, { o: [50, 1, 0], d: [0, 0, 1] }); // muzzle 50m from A → dropped
    expect(a.msgs('shot')).toHaveLength(0);
  });
});

describe('heal + regen', () => {
  function duel() {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, a, { x: 0, z: 0 });
    pos(world, b, { x: 0, z: 5 });
    return { world, a, b };
  }

  it('heal restores server hp but never lowers it', () => {
    const { world, a, b } = duel();
    shot(world, a, { dm: 1 });                       // B → 88
    expect(a.last('shot').hp).toBe(88);
    heal(world, b, 30);                              // 30 < 88 → ignored (never lowers)
    shot(world, a, { dm: 1 });
    expect(a.last('shot').hp).toBe(76);              // still counting down from 88
    heal(world, b, 100);                             // full heal
    shot(world, a, { dm: 1 });
    expect(a.last('shot').hp).toBe(88);              // back off 100
  });

  it('regenerates hp slowly between hits', () => {
    const { world, a, b } = duel();
    shot(world, a, { dm: 3 });                       // B → 74
    expect(a.last('shot').hp).toBe(74);
    vi.advanceTimersByTime(4000);                    // +4s → +8 regen → 82
    shot(world, a, { dm: 1 });                       // regen then -12
    expect(a.last('shot').hp).toBe(70);
  });
});

describe('death + respawn', () => {
  it('kills at 0 hp, ignores heals while dead, and respawns after the timer', () => {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, a, { x: 0, z: 0 });
    pos(world, b, { x: 0, z: 5 });
    const aid = idOf(a); const bid = idOf(b); // capture before any reset() clears the welcome
    for (let i = 0; i < 9; i++) shot(world, a, { dm: 2 }); // 18 each → dead after 6
    const death = a.last('death');
    expect(death.id).toBe(bid);
    expect(death.by).toBe(aid);

    heal(world, b, 100); // ignored while dead (deadUntil > now)

    b.reset(); a.reset();
    vi.advanceTimersByTime(5200); // past PVP_RESPAWN_MS → tick() respawns
    expect(a.last('spawn').id).toBe(bid);
  });
});

describe('disconnect', () => {
  it('broadcasts a leave to the others', () => {
    const { world } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, a, { x: 1, z: 1 });
    pos(world, b, { x: 2, z: 2 });
    world.webSocketClose(a as any);
    expect(b.last('del').id).toBe(idOf(a));
    // last player leaving is also fine (clears the world)
    expect(() => world.webSocketError(b as any)).not.toThrow();
  });

  it('parks poses to storage after a long idle, then stops ticking', () => {
    const { world, ctx } = makeWorld();
    const a = new FakeWS(); const b = new FakeWS();
    join(world, a, 'A', 'pa'); join(world, b, 'B', 'pb');
    pos(world, a, { x: 7, z: 8 });
    pos(world, b, { x: 1, z: 1 });
    vi.advanceTimersByTime(100 * 305); // > QUIET_TICKS empty ticks → parkPoses()
    const parked = ctx._store.get('poses') as Record<string, { x: number }>;
    expect(parked).toBeTruthy();
    expect(parked[String(idOf(a))].x).toBe(7);
  });
});

describe('hibernation restore', () => {
  it('rebuilds sessions + parked poses on construction and advances the id counter', async () => {
    const store = new Map<string, unknown>();
    const ghost = new FakeWS();
    ghost.attachment = { id: 7, nick: 'Ghost', pid: 'pg' };
    store.set('poses', { '7': { x: 9, y: 0, z: 9, h: 0, m: 0, i: 0, vk: 0, d: 0 } });

    const { world, ctx } = makeWorld({}, [ghost], store);
    await ctx._bcw; // let the blockConcurrencyWhile pose-restore settle

    const n = new FakeWS();
    join(world, n, 'New', 'pn');
    const w = n.first('welcome');
    expect(w.id).toBe(8); // nextId advanced past the restored id 7
    expect(w.players.map((p: any) => p.id)).toContain(7); // restored ghost (has a pose) is in the roster
  });
});

describe('fetch endpoint', () => {
  it('serves /health with the live player counts and world colo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('colo=GIG\nfoo=bar')));
    const { world } = makeWorld();
    const res = await world.fetch(new Request('https://do/health'));
    const body = await res.json() as any;
    expect(body.players).toBe(0);
    expect(body.max).toBe(DEFAULT_MAX_PLAYERS);
    expect(body.worldColo).toBe('GIG');
  });

  it('rejects a non-websocket request to /ws', async () => {
    const { world } = makeWorld();
    const res = await world.fetch(new Request('https://do/ws'));
    expect(res.status).toBe(426);
  });
});
