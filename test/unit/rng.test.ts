import { describe, it, expect } from 'vitest';
import { makeRng } from '@/core/rng.ts';

describe('makeRng (deterministic PRNG)', () => {
  it('produces the same stream for the same seed', () => {
    const a = makeRng(1337), b = makeRng(1337);
    const seqA = Array.from({ length: 8 }, () => a.random());
    const seqB = Array.from({ length: 8 }, () => b.random());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds diverge', () => {
    expect(makeRng(1).random()).not.toBe(makeRng(2).random());
  });

  it('random() stays in [0, 1)', () => {
    const r = makeRng(42);
    for (let i = 0; i < 200; i++) {
      const v = r.random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('irand(lo, hi) is an inclusive integer range', () => {
    const r = makeRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const v = r.irand(3, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5]); // hits every value
  });

  it('pick returns a member of the array', () => {
    const r = makeRng(9), arr = ['a', 'b', 'c'];
    for (let i = 0; i < 30; i++) expect(arr).toContain(r.pick(arr));
  });
});
