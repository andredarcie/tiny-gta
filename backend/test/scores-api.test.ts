import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../lib/redis.js', () => import('./helpers/fakeRedis.js'));

import { redis, resetRedis } from './helpers/fakeRedis.js';
import handler from '../api/scores.js';
import { makeReq, makeRes } from './helpers/http.js';
import { scoreSig } from '../lib/auth.js';
import * as C from '../lib/scores.js';

const PID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => resetRedis());

async function seedSession(opts: { at: number; base?: number; name?: string | null; pid?: string | null }) {
  const token = 'tok-' + Math.random().toString(16).slice(2);
  await redis.set(C.SESSION_PREFIX + token, {
    at: opts.at, base: opts.base ?? 0, pid: opts.pid ?? PID, name: opts.name ?? 'JOE',
  });
  return token;
}
async function post(body: unknown) {
  const res = makeRes();
  await handler(makeReq({ method: 'POST', body }), res);
  return res;
}

describe('submit — the save persists BEFORE the ranking gates', () => {
  it('writes the save in a <20s session, then returns 403 run_too_short', async () => {
    const token = await seedSession({ at: Date.now() - 5000 });
    const res = await post({ name: 'JOE', money: 300, token, pid: PID, save: { money: 300 } });
    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toBe('run_too_short');
    const saved = await redis.get<C.SaveBlob>(C.saveKey(PID));
    expect(saved?.money).toBe(300);
    expect(saved?.name).toBe('JOE'); // nick autoritativo carimbado
  });

  it('clamps the saved money to the time+base plausibility ceiling', async () => {
    const token = await seedSession({ at: Date.now() - 5000, base: 0 }); // max = 250 + 200*5 = 1250
    await post({ name: 'JOE', money: 99999, token, pid: PID, save: { money: 99999 } });
    expect((await redis.get<C.SaveBlob>(C.saveKey(PID)))?.money).toBe(1250);
  });
});

describe('submit — leaderboard gates', () => {
  it('publishes the score for a long-enough session', async () => {
    const token = await seedSession({ at: Date.now() - 60000 });
    const res = await post({ name: 'JOE', money: 500, token, pid: PID, save: { money: 500 } });
    expect(res._status).toBe(200);
    expect(await redis.zscore(C.LEADERBOARD_KEY, 'JOE')).toBe(500);
  });

  it('clamps the leaderboard value to the hard cap (save keeps the real value)', async () => {
    const token = await seedSession({ at: Date.now() - 60000, base: 50_000_000 });
    const res = await post({ name: 'JOE', money: 20_000_000, token, pid: PID, save: { money: 20_000_000 } });
    expect(res._status).toBe(200);
    expect(await redis.zscore(C.LEADERBOARD_KEY, 'JOE')).toBe(C.MONEY_HARD_CAP);
    expect((await redis.get<C.SaveBlob>(C.saveKey(PID)))?.money).toBe(20_000_000);
  });

  it('422 implausible when money exceeds the time+base ceiling', async () => {
    const token = await seedSession({ at: Date.now() - 30000, base: 0 }); // max ~6250
    expect((await post({ name: 'JOE', money: 1_000_000, token, pid: PID, save: { money: 1_000_000 } }))._status).toBe(422);
  });

  it('403 session_mismatch when the name differs from the session', async () => {
    const token = await seedSession({ at: Date.now() - 60000, name: 'ALICE' });
    const res = await post({ name: 'BOB', money: 300, token, pid: PID, save: { money: 300 } });
    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toBe('session_mismatch');
  });

  it('403 invalid_session for an unknown token', async () => {
    expect((await post({ name: 'JOE', money: 300, token: 'nope', pid: PID }))._status).toBe(403);
  });

  it('400 on invalid payload (name / money / token)', async () => {
    expect((await post({ name: '', money: 1, token: 't' }))._status).toBe(400);
    expect((await post({ name: 'JOE', money: -5, token: 't' }))._status).toBe(400);
    expect((await post({ name: 'JOE', money: 5 }))._status).toBe(400);
  });
});

describe('submit — anti-tamper signature', () => {
  const SECRET = 'a'.repeat(32);
  async function seedSigned(at: number) {
    const token = 'tok-' + Math.random().toString(16).slice(2);
    await redis.set(C.SESSION_PREFIX + token, { at, base: 0, pid: PID, name: 'JOE', secret: SECRET });
    return token;
  }

  it('accepts a correctly signed payload', async () => {
    const token = await seedSigned(Date.now() - 60000);
    const t = Date.now();
    const sig = scoreSig(SECRET, 500, t);
    const res = await post({ name: 'JOE', money: 500, token, pid: PID, save: { money: 500, t }, t, sig });
    expect(res._status).toBe(200);
  });

  it('rejects a missing signature (403 bad_signature)', async () => {
    const token = await seedSigned(Date.now() - 60000);
    const res = await post({ name: 'JOE', money: 500, token, pid: PID, save: { money: 500 } });
    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toBe('bad_signature');
  });

  it('rejects tampered money carrying the old signature', async () => {
    const token = await seedSigned(Date.now() - 60000);
    const t = Date.now();
    const sig = scoreSig(SECRET, 500, t); // signed for 500
    const res = await post({ name: 'JOE', money: 999999, token, pid: PID, save: { money: 999999, t }, t, sig });
    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toBe('bad_signature');
  });
});

describe('GET board', () => {
  it('returns sorted entries + total', async () => {
    await redis.zadd(C.LEADERBOARD_KEY, { score: 100, member: 'A' });
    await redis.zadd(C.LEADERBOARD_KEY, { score: 300, member: 'B' });
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { limit: '5' } }), res);
    expect(res._status).toBe(200);
    const j = res._json as { total: number; entries: Array<{ rank: number; name: string; money: number }> };
    expect(j.total).toBe(2);
    expect(j.entries[0]).toMatchObject({ rank: 1, name: 'B', money: 300 });
  });
});
