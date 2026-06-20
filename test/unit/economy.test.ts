import { describe, it, expect } from 'vitest';
import { economy } from '@/core/economy.ts';
import { state } from '@/core/state.ts';

// The economy is a singleton that mutates `state.money`. These tests assert
// BALANCE DELTAS (not absolute values) so they don't depend on run order, and
// use the source 'test' which has no rapid-fire cooldown.
describe('economy ledger', () => {
  it('seeds the genesis starting balance', () => {
    expect(state.money).toBeGreaterThanOrEqual(250);
  });

  it('earn() credits the wallet and returns the amount', () => {
    const before = state.money;
    expect(economy.earn(100, 'test')).toBe(100);
    expect(state.money).toBe(before + 100);
  });

  it('a duplicate tx id credits only once (idempotent)', () => {
    const before = state.money;
    expect(economy.earn(50, 'test', { id: 'unit-dup' })).toBe(50);
    expect(economy.earn(50, 'test', { id: 'unit-dup' })).toBe(0);
    expect(state.money).toBe(before + 50);
  });

  it('rejects NaN / negative / zero earns', () => {
    const before = state.money;
    expect(economy.earn(Number.NaN, 'test')).toBe(0);
    expect(economy.earn(-5, 'test')).toBe(0);
    expect(economy.earn(0, 'test')).toBe(0);
    expect(state.money).toBe(before);
  });

  it('spend() deducts only when affordable', () => {
    const before = state.money;
    expect(economy.spend(before + 1)).toBe(false); // can't afford → untouched
    expect(state.money).toBe(before);
    expect(economy.spend(10)).toBe(true);
    expect(state.money).toBe(before - 10);
  });

  it('canAfford reflects the balance', () => {
    expect(economy.canAfford(state.money)).toBe(true);
    expect(economy.canAfford(state.money + 1)).toBe(false);
  });

  it('serialize() snapshot total equals the live balance', () => {
    const snap = economy.serialize();
    const total = snap.ckpt + snap.txs.reduce((sum, t) => sum + t.amt, 0);
    expect(total).toBe(state.money); // serialize itself is correct (ckpt + Σtxs == balance)
  });

  // Regression test for the genesis-loss bug: importLedger() must be idempotent and
  // balance-preserving even for a YOUNG ledger where serialize() keeps the genesis
  // tx in `txs` (not yet folded into `ckpt`). Previously importLedger pre-seeded
  // `seen` with 'genesis' and skipped it, dropping the starting $250 on restore.
  it('importLedger is idempotent + balance-preserving (incl. a young ledger with genesis in txs)', () => {
    const snap = economy.serialize();
    const balance = state.money;
    economy.importLedger(snap);
    economy.importLedger(snap);
    expect(state.money).toBe(balance);
  });
});
