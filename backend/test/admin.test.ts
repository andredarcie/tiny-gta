import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../lib/redis.js', () => import('./helpers/fakeRedis.js'));

import { redis, resetRedis } from './helpers/fakeRedis.js';
import handler from '../api/admin.js';
import { makeReq, makeRes } from './helpers/http.js';
import * as C from '../lib/scores.js';
import * as L from '../lib/ledger.js';

const REI = '11111111-1111-4111-8111-111111111111';   // owns the admin account
const OTHER = '22222222-2222-4222-8222-222222222222';  // a regular player

beforeEach(() => resetRedis());

async function sessionFor(pid: string): Promise<string> {
  const token = 'tok-' + Math.random().toString(16).slice(2);
  await redis.set(C.SESSION_PREFIX + token, { at: Date.now(), base: 0, pid, name: 'X', secret: 's' });
  return token;
}
async function post(body: unknown) {
  const res = makeRes();
  await handler(makeReq({ method: 'POST', body }), res);
  return res;
}

describe('admin endpoint — authorization', () => {
  beforeEach(async () => { await redis.set(C.acctKey('REI'), { hash: 'h', salt: 's', pid: REI, at: 1 }); });

  it('403 not_admin when the caller pid does not own the REI account', async () => {
    const token = await sessionFor(OTHER);
    const res = await post({ token, pid: OTHER, action: 'players' });
    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toBe('not_admin');
  });

  it('403 invalid_session for an unknown token', async () => {
    expect((await post({ token: 'nope', pid: REI, action: 'players' }))._status).toBe(403);
  });

  it('400 bad_request without token/pid', async () => {
    expect((await post({ action: 'players' }))._status).toBe(400);
  });
});

describe('admin endpoint — data (admin authorized)', () => {
  beforeEach(async () => { await redis.set(C.acctKey('REI'), { hash: 'h', salt: 's', pid: REI, at: 1 }); });

  it('lists players with name, ranking money and ledger balance', async () => {
    await redis.set(C.saveKey(OTHER), { money: 500, name: 'BOB' });
    await redis.zadd(C.LEADERBOARD_KEY, { score: 480, member: 'BOB' });
    await L.appendTxs(OTHER, [{ id: 'a', amt: 500, why: 'race', t: 1 }]);
    const token = await sessionFor(REI);
    const res = await post({ token, pid: REI, action: 'players' });
    expect(res._status).toBe(200);
    const bob = (res._json as { players: Array<{ pid: string; name: string; money: number; bal: number }> })
      .players.find(p => p.name === 'BOB');
    expect(bob).toMatchObject({ pid: OTHER, name: 'BOB', money: 480, bal: 500 });
  });

  it('returns a player transactions (newest first) with reason and balance', async () => {
    await L.appendTxs(OTHER, [{ id: 'a', amt: 920, why: 'race', t: 1000 }, { id: 'b', amt: -50, why: 'ammo', t: 2000 }]);
    const token = await sessionFor(REI);
    const res = await post({ token, pid: REI, action: 'txs', target: OTHER });
    expect(res._status).toBe(200);
    const { bal, txs } = res._json as { bal: number; txs: Array<{ why: string; amt: number }> };
    expect(bal).toBe(870);
    expect(txs.map(t => t.why)).toEqual(['ammo', 'race']); // sorted by time desc
    expect(txs.find(t => t.why === 'ammo')?.amt).toBe(-50);
  });
});
