import { describe, expect, it } from 'vitest';
import { SPEED_CAP, TELEPORT_COOLDOWN_MS, checkMove, clampPoseY } from '../../shared/sim/move-check.ts';
import { BRIDGE_H, RIVER_CX, groundHeight } from '../../shared/sim/terrain.ts';

// The server's movement plausibility layer (server/src/world.ts applies these
// verbatim). Philosophy under test: honest play always passes — including the
// game's own teleports — while SUSTAINED impossible speed degrades to one hop
// per cooldown.

describe('checkMove', () => {
  it('accepts normal walking and driving', () => {
    expect(checkMove(0, 0, 0.6, 0, 100, 0, 999_999)).toBe('ok');   // 6 m/s on foot
    expect(checkMove(0, 0, 4.5, 0, 100, 1, 999_999)).toBe('ok');   // 45 m/s in a car
    expect(checkMove(0, 0, 12, 0, 100, 3, 999_999)).toBe('ok');    // 120 m/s plane
  });
  it('grants ONE teleport, then rejects sustained impossible speed', () => {
    expect(checkMove(0, 0, 300, 0, 100, 0, TELEPORT_COOLDOWN_MS + 1)).toBe('teleport'); // hospital warp
    expect(checkMove(0, 0, 300, 0, 100, 0, 1000)).toBe('reject');   // again within cooldown: no
  });
  it('speed just past the cap (with slack) is rejected inside the cooldown', () => {
    const cap = SPEED_CAP[0];
    const dist = cap * 0.1 * 1.4 + 1.0; // clearly past the 100ms budget + jitter floor
    expect(checkMove(0, 0, dist, 0, 100, 0, 1000)).toBe('reject');
  });
  it('never judges a zero/negative dt', () => {
    expect(checkMove(0, 0, 500, 0, 0, 0, 0)).toBe('ok');
  });
  it('uses the more permissive cap across a mode transition (car -> foot bail-out)', () => {
    expect(checkMove(0, 0, 4, 0, 100, 0, 1000)).toBe('reject');     // 40 m/s on foot: no
    expect(checkMove(0, 0, 4, 0, 100, 0, 1000, 1)).toBe('ok');      // ...but fine when you JUST left a car
  });
});

describe('clampPoseY', () => {
  it('blocks under-the-map (city ground is ~0)', () => {
    expect(clampPoseY(10, -50, 10, 0)).toBe(-3.5);
  });
  it('follows the river bed below sea level', () => {
    const gh = groundHeight(RIVER_CX, 60); // inside the strait, off the bridge deck
    expect(gh).toBeLessThan(0);
    expect(clampPoseY(RIVER_CX, -5, 60, 4)).toBe(-5); // a diver above the bed passes
    expect(clampPoseY(RIVER_CX, -50, 60, 4)).toBeCloseTo(Math.min(gh, 0) - 3.5, 10);
  });
  it('lets a boat pass UNDER the bridge deck (deck is in groundHeight)', () => {
    expect(groundHeight(RIVER_CX, 0)).toBeCloseTo(BRIDGE_H, 5); // deck above the channel
    expect(clampPoseY(RIVER_CX, 0.2, 0, 2)).toBe(0.2);          // boat at the waterline: fine
  });
  it('caps altitude by mode: rooftops fine on foot, orbit only denied', () => {
    expect(clampPoseY(10, 40, 10, 0)).toBe(40);                 // rooftop / falling
    expect(clampPoseY(10, 5000, 10, 0)).toBeCloseTo(groundHeight(10, 10) + 140, 10);
    expect(clampPoseY(10, 130, 10, 0)).toBe(130);           // bailing out of the plane at its ceiling
    expect(clampPoseY(10, 5000, 10, 3)).toBe(780);              // plane ceiling
    expect(clampPoseY(10, 50, 10, 2)).toBe(8);                  // boats stay on the water
  });
});
