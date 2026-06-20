import { describe, it, expect } from 'vitest';
import { generateWorldSpec } from '@/world/world-gen.ts';

describe('generateWorldSpec (baked world generator)', () => {
  it('is fully deterministic for a given seed', () => {
    expect(JSON.stringify(generateWorldSpec(1337))).toBe(JSON.stringify(generateWorldSpec(1337)));
  });

  it('different seeds yield different layouts', () => {
    expect(JSON.stringify(generateWorldSpec(1))).not.toBe(JSON.stringify(generateWorldSpec(2)));
  });

  it('produces the expected world structure', () => {
    const w = generateWorldSpec(1337);
    expect(w.version).toBe(1);
    expect(w.seed).toBe(1337);
    expect(w.parks.length).toBe(6);                  // exactly 6 park blocks
    expect(w.cityLots.length).toBeGreaterThan(0);
    expect(w.beachPalms.length).toBeGreaterThan(0);
    expect(w.forest.trees.length).toBeGreaterThan(0);
    expect(w.mountainRocks.length).toBeGreaterThan(0);
  });
});
