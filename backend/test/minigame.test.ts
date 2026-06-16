import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../lib/redis.js', () => import('./helpers/fakeRedis.js'));

import { redis, resetRedis } from './helpers/fakeRedis.js';
import handler from '../api/minigame.js';
import { makeReq, makeRes } from './helpers/http.js';
import { mgSig } from '../lib/auth.js';
import * as C from '../lib/scores.js';

const PID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => resetRedis());

async function seedSession(name: string | null = 'JOE') {
  const token = 'tok';
  await redis.set(C.SESSION_PREFIX + token, { at: Date.now(), base: 0, pid: PID, name });
  return token;
}
async function post(body: unknown) {
  const res = makeRes();
  await handler(makeReq({ method: 'POST', body }), res);
  return res;
}

describe('minigame submit', () => {
  it('accumulates raw stats and computes a rating into the board', async () => {
    const token = await seedSession();
    const res = await post({ game: 'taxi', name: 'JOE', won: true, score: 100, token });
    expect(res._status).toBe(200);
    const j = res._json as { stats: C.MiniGameStats; rating: number };
    expect(j.stats).toMatchObject({ plays: 1, wins: 1, earned: 100, best: 100 });
    expect(j.rating).toBeGreaterThan(0);
    expect(await redis.zscore(C.mgBoardKey('taxi'), 'JOE')).toBe(j.rating);
  });

  it('accumulates across sessions', async () => {
    const token = await seedSession();
    await post({ game: 'taxi', name: 'JOE', won: true, score: 100, token });
    const res = await post({ game: 'taxi', name: 'JOE', won: false, score: 50, token });
    expect((res._json as { stats: C.MiniGameStats }).stats)
      .toMatchObject({ plays: 2, wins: 1, losses: 1, earned: 150, best: 100 });
  });

  it('validates game / score / session', async () => {
    const token = await seedSession();
    expect((await post({ game: 'nope', name: 'JOE', score: 1, token }))._status).toBe(400);
    expect((await post({ game: 'taxi', name: 'JOE', score: -1, token }))._status).toBe(400);
    expect((await post({ game: 'taxi', name: 'JOE', score: 1, token: 'bad' }))._status).toBe(403);
  });

  it('403 session_mismatch when the name differs', async () => {
    const token = await seedSession('ALICE');
    expect((await post({ game: 'taxi', name: 'BOB', score: 1, token }))._status).toBe(403);
  });
});

describe('minigame submit — anti-tamper signature', () => {
  const SECRET = 'a'.repeat(32);
  async function seedSigned() {
    const token = 'tok';
    await redis.set(C.SESSION_PREFIX + token, { at: Date.now(), base: 0, pid: PID, name: 'JOE', secret: SECRET });
    return token;
  }

  it('accepts a correctly signed result', async () => {
    const token = await seedSigned();
    const t = Date.now();
    const sig = mgSig(SECRET, 'taxi', 100, 1, t);
    const res = await post({ game: 'taxi', name: 'JOE', won: true, score: 100, token, t, sig });
    expect(res._status).toBe(200);
  });

  it('rejects a missing or tampered signature (403 bad_signature)', async () => {
    const token = await seedSigned();
    const t = Date.now();
    const good = mgSig(SECRET, 'taxi', 100, 1, t); // assinado para score 100
    expect((await post({ game: 'taxi', name: 'JOE', won: true, score: 100, token, t }))._status).toBe(403);
    const res = await post({ game: 'taxi', name: 'JOE', won: true, score: 999, token, t, sig: good });
    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toBe('bad_signature');
  });
});
