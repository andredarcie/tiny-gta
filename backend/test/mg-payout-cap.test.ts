import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../lib/redis.js', () => import('./helpers/fakeRedis.js'));

import { redis, resetRedis } from './helpers/fakeRedis.js';
import handler from '../api/scores.js';
import { makeReq, makeRes } from './helpers/http.js';
import { scoreSig } from '../lib/auth.js';
import * as C from '../lib/scores.js';
import * as L from '../lib/ledger.js';

// One unit test PER MINI-GAME: try to credit money ABOVE that game's real ceiling
// and prove the API rejects it (the forged payout never lands in the balance). A
// companion test proves a payout AT the ceiling is still accepted (so the cap isn't
// just rejecting everything). The session runs at 60s with base 0, so maxAllowed is
// 12,250 — above every cap here; therefore an over-cap tx that slipped past the
// per-source check WOULD be credited (caught only by this test), isolating the cap.

const PID = '11111111-1111-4111-8111-111111111111';
const SECRET = 'c'.repeat(32);

beforeEach(() => resetRedis());

async function openSession(): Promise<string> {
  const token = 'tok-' + Math.random().toString(16).slice(2);
  await redis.set(C.SESSION_PREFIX + token, { at: Date.now() - 60000, base: 0, pid: PID, name: 'JOE', secret: SECRET });
  return token;
}

async function submit(money: number, txs: C.Tx[], token: string) {
  const t = Date.now();
  const sig = scoreSig(SECRET, money, t, C.txDigest(txs));
  const res = makeRes();
  await handler(makeReq({ method: 'POST', body: { name: 'JOE', money, token, pid: PID, save: { money, t }, txs, t, sig } }), res);
  return res;
}

const games: Array<[string, number]> = Object.entries(C.MG_MAX_PAYOUT);

describe('per-mini-game payout ceiling', () => {
  it('covers every mini-game in MG_MAX_PAYOUT', () => {
    expect(games.length).toBeGreaterThan(0);
  });

  // FAILS as required: adding money above the real max is rejected (not credited).
  it.each(games)('rejects an over-ceiling "%s" payout (cap %i)', async (why, cap) => {
    const token = await openSession();
    const over = cap + 1000; // a payout this mini-game could never legitimately pay
    const res = await submit(over, [{ id: 'x1', amt: over, why, t: 1 }], token);
    expect(res._status).toBe(200);
    expect(await L.readBalance(PID)).toBe(0);                       // forged payout dropped
    expect(await redis.zscore(C.LEADERBOARD_KEY, 'JOE')).toBe(0);   // and never reaches the board
  });

  // Boundary check: a payout exactly at the ceiling is legit and is credited.
  it.each(games)('accepts an at-ceiling "%s" payout (cap %i)', async (why, cap) => {
    const token = await openSession();
    const res = await submit(cap, [{ id: 'x1', amt: cap, why, t: 1 }], token);
    expect(res._status).toBe(200);
    expect(await L.readBalance(PID)).toBe(cap);
  });
});
