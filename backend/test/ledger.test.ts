import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../lib/redis.js', () => import('./helpers/fakeRedis.js'));

import { redis, resetRedis } from './helpers/fakeRedis.js';
import * as L from '../lib/ledger.js';
import * as C from '../lib/scores.js';

const PID = '11111111-1111-4111-8111-111111111111';
const tx = (id: string, amt: number, t = 1): C.Tx => ({ id, amt, why: 't', t });

beforeEach(() => resetRedis());

describe('ledger — append is idempotent (balance = Σ transactions)', () => {
  it('sums signed txs and never double-credits a resent batch', async () => {
    const batch = [tx('a', 100), tx('b', -30)];
    expect(await L.appendTxs(PID, batch)).toBe(70);
    expect(await L.appendTxs(PID, batch)).toBe(70); // resend (retry/unload): no-op
    expect(await L.appendTxs(PID, batch)).toBe(70); // again: still 70
    expect(await L.readBalance(PID)).toBe(70);
  });

  it('applies only the NEW ids when a batch partially overlaps', async () => {
    expect(await L.appendTxs(PID, [tx('a', 100)])).toBe(100);
    // 'a' repeats (skipped), 'c' is new (+50)
    expect(await L.appendTxs(PID, [tx('a', 100), tx('c', 50)])).toBe(150);
  });

  it('clamps a negative balance to 0 on read', async () => {
    await L.appendTxs(PID, [tx('a', 100), tx('b', -500)]);
    expect(await L.readBalance(PID)).toBe(0);
  });
});

describe('ledger — genesis seed', () => {
  it('seeds the starting balance once and dedupes the client genesis', async () => {
    await L.seedLedger(PID, 5000);
    expect(await L.readBalance(PID)).toBe(5000);
    await L.seedLedger(PID, 9999); // genesis already present -> no-op
    expect(await L.readBalance(PID)).toBe(5000);
    // the client's own genesis tx (same stable id) is deduped, not re-added
    await L.appendTxs(PID, [tx('genesis', 250)]);
    expect(await L.readBalance(PID)).toBe(5000);
  });

  it('does not seed a zero genesis (lets a new player keep their client genesis)', async () => {
    await L.seedLedger(PID, 0);
    expect(await L.readLedgerSnapshot(PID)).toBeNull();
    expect(await L.appendTxs(PID, [tx('genesis', 250)])).toBe(250);
  });
});

describe('ledger — compaction keeps the balance while bounding the hash', () => {
  it('drops old tx records past LEDGER_MAX but preserves #bal', async () => {
    const many = Array.from({ length: C.LEDGER_MAX + 30 }, (_, i) => tx('n' + i, 1, i));
    const bal = await L.appendTxs(PID, many);
    expect(bal).toBe(C.LEDGER_MAX + 30);
    expect(await L.readBalance(PID)).toBe(C.LEDGER_MAX + 30);
    const len = await redis.hlen(C.ledgerKey(PID));
    expect(len).toBeLessThanOrEqual(C.LEDGER_KEEP + 2); // recent window (+ #bal/genesis)
  });
});
