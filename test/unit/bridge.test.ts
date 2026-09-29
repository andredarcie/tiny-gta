import { describe, it, expect } from 'vitest';
import {
  bridgeDeckH, groundHeight, isLand, RIVER_CX, RIVER_HW, BRIDGE_X0, BRIDGE_X1, BRIDGE_DECK_HW,
} from '@/core/constants.ts';

// The Vesper Bridge sits at STREET LEVEL: no access ramps, the road runs flat across.
describe('Vesper Bridge — street-level deck', () => {
  it('is flat and flush with the street along the whole crossing', () => {
    for (let x = BRIDGE_X0 + 0.1; x < BRIDGE_X1; x += 0.5) {
      expect(bridgeDeckH(x, 0)).toBeGreaterThan(0);  // counts as deck (dry road)
      expect(bridgeDeckH(x, 0)).toBeLessThan(0.1);   // ...at street level
    }
  });
  it('has no step where the road meets the deck', () => {
    for (const x of [BRIDGE_X0 - 0.5, BRIDGE_X0 + 0.5, BRIDGE_X1 - 0.5, BRIDGE_X1 + 0.5])
      expect(Math.abs(groundHeight(x, 0))).toBeLessThan(0.1);
  });
  it('is dry land over the water, and the strait beside it is water', () => {
    expect(isLand(RIVER_CX, 0)).toBe(true);
    expect(isLand(RIVER_CX, BRIDGE_DECK_HW + 5)).toBe(false);
    expect(isLand(RIVER_CX - RIVER_HW + 2, -(BRIDGE_DECK_HW + 5))).toBe(false);
  });
});
