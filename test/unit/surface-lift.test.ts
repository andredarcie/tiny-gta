// The paving drawn over the terrain (src/js/world/surface-lift.ts): wheels and feet rest on
// the highest surface registered over a point; a band (raised sidewalk) never covers its own
// roadway, not even on the inside of a bend.
import { describe, it, expect, beforeEach } from 'vitest';
import { addSurfaceStrip, addSurfacePolygon, surfaceLift, clearSurfaces } from '../../src/js/world/surface-lift.ts';

beforeEach(() => clearSurfaces());

describe('surface lift', () => {
  it('is 0 on bare ground and the strip lift on a street', () => {
    addSurfaceStrip([[0, 0], [100, 0]], 4, .14);
    expect(surfaceLift(50, 30)).toBe(0);
    expect(surfaceLift(50, 3.9)).toBeCloseTo(.14);
    expect(surfaceLift(50, -3.9)).toBeCloseTo(.14);
  });
  it('a raised sidewalk band covers only outside the roadway', () => {
    addSurfaceStrip([[0, 0], [100, 0]], 4, .14);
    addSurfaceStrip([[0, 0], [100, 0]], 6.2, .32, 4);
    expect(surfaceLift(50, 2)).toBeCloseTo(.14);
    expect(surfaceLift(50, 5)).toBeCloseTo(.32);
    expect(surfaceLift(50, 7)).toBe(0);
  });
  it("a band's roadway stays roadway on the inside of a bend", () => {
    addSurfaceStrip([[0, 0], [50, 0], [50, 50]], 4, .14);
    addSurfaceStrip([[0, 0], [50, 0], [50, 50]], 6.2, .32, 4);
    expect(surfaceLift(47, 3)).toBeCloseTo(.14);         // inside corner: within 4 m of the second leg
  });
  it('the highest surface wins where they overlap (a square over its streets)', () => {
    addSurfaceStrip([[0, 0], [100, 0]], 4, .16);
    addSurfacePolygon([[40, -10], [60, -10], [60, 10], [40, 10]], .21);
    expect(surfaceLift(50, 0)).toBeCloseTo(.21);
    expect(surfaceLift(20, 0)).toBeCloseTo(.16);
  });
});
