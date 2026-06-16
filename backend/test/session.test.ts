import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../lib/redis.js', () => import('./helpers/fakeRedis.js'));

import { redis, resetRedis } from './helpers/fakeRedis.js';
import handler from '../api/session.js';
import { makeReq, makeRes } from './helpers/http.js';
import * as C from '../lib/scores.js';

const PID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => resetRedis());

async function open(body: unknown) {
  const res = makeRes();
  await handler(makeReq({ method: 'POST', body }), res);
  return res;
}

describe('session restore', () => {
  it('restores from the new pid-only save key', async () => {
    await redis.set(C.saveKey(PID), { money: 1234, name: 'JOE', weapons: [1] });
    const res = await open({ pid: PID, name: 'JOE' });
    expect(res._status).toBe(200);
    const j = res._json as { money: number; save: C.SaveBlob; token: string };
    expect(j.money).toBe(1234);
    expect(j.save).toMatchObject({ money: 1234, weapons: [1] });
    expect(typeof j.token).toBe('string');
  });

  it('falls back to the legacy pid|nick save key', async () => {
    await redis.set(C.SAVE_PREFIX + C.saveMember(PID, 'JOE'), { money: 777 });
    expect((await open({ pid: PID, name: 'JOE' }))._json).toMatchObject({ money: 777 });
  });

  it('falls back to the legacy money-only sorted set, then to the seed', async () => {
    await redis.zadd(C.SAVE_LEGACY_KEY, { score: 555, member: C.saveMember(PID, 'JOE') });
    expect((await open({ pid: PID, name: 'JOE' }))._json).toMatchObject({ money: 555 });

    resetRedis();
    await redis.hset(C.SEED_KEY, { JOE: 999 });
    expect((await open({ pid: PID, name: 'JOE' }))._json).toMatchObject({ money: 999 });
  });

  it('no identity -> no save, money 0, but still issues a token', async () => {
    const j = (await open({}))._json as { save: unknown; money: number; token: string };
    expect(j.save).toBeNull();
    expect(j.money).toBe(0);
    expect(typeof j.token).toBe('string');
  });

  it('stores the session with base = restored money + the identity', async () => {
    await redis.set(C.saveKey(PID), { money: 4242, name: 'JOE' });
    const token = ((await open({ pid: PID, name: 'JOE' }))._json as { token: string }).token;
    expect(C.parseSession(await redis.get(C.SESSION_PREFIX + token)))
      .toMatchObject({ base: 4242, pid: PID, name: 'JOE' });
  });

  it('issues a per-session secret and persists it in the session', async () => {
    const j = (await open({ pid: PID, name: 'JOE' }))._json as { secret: string; token: string };
    expect(typeof j.secret).toBe('string');
    expect(j.secret.length).toBeGreaterThan(0);
    expect(C.parseSession(await redis.get(C.SESSION_PREFIX + j.token))?.secret).toBe(j.secret);
  });
});
