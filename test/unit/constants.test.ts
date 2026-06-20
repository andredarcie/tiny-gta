import { describe, it, expect } from 'vitest';
import {
  clamp, wrapA, diminishPrize, rubberSpeed, smoothPace,
  isLand, groundHeight, separateRacers, MOUNT_X,
} from '@/core/constants.ts';
import type { Racer, PrizeStreak } from '@/core/types.ts';

describe('math helpers', () => {
  it('clamp bounds a value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('wrapA normalizes an angle into [-PI, PI]', () => {
    expect(wrapA(0)).toBeCloseTo(0);
    expect(wrapA(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(wrapA(-Math.PI * 3)).toBeCloseTo(-Math.PI);
    for (let a = -20; a <= 20; a += 0.5) expect(Math.abs(wrapA(a))).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});

describe('race rubber-banding', () => {
  it('a trailing rival surges, a leading rival eases off', () => {
    const base = 10, player = 20;
    const behind = rubberSpeed(base, 1, player, 1);   // gap>0 → behind → catch up
    const even = rubberSpeed(base, 0, player, 1);
    const ahead = rubberSpeed(base, -1, player, 1);   // gap<0 → ahead → ease
    expect(behind).toBeGreaterThan(even);
    expect(even).toBeGreaterThan(ahead);
  });

  it('smoothPace rises fast and falls slowly (asymmetric)', () => {
    const up = smoothPace(0, 10, 0.1);     // accelerating
    const down = smoothPace(10, 0, 0.1);   // lifting off
    expect(up).toBeGreaterThan(0);
    expect(up).toBeGreaterThan(10 - down); // same dt covers more ground rising than falling
  });
});

describe('diminishPrize (anti-farm)', () => {
  it('pays full first, less on an immediate repeat, and nothing without a podium', () => {
    const s: PrizeStreak = { streak: 0, last: NaN };
    const p1 = diminishPrize(s, 700, 0);
    const p2 = diminishPrize(s, 700, 1);
    expect(p1).toBe(700);
    expect(p2).toBeLessThan(p1);
    expect(diminishPrize(s, 0, 2)).toBe(0); // base<=0 → no pay, no streak tick
  });
});

describe('world geometry', () => {
  it('the city centre is land, deep ocean is not', () => {
    expect(isLand(0, 0)).toBe(true);
    expect(isLand(1000, 1000)).toBe(false);
  });

  it('groundHeight is flat in the city and rises on the mountain summit', () => {
    expect(groundHeight(0, 0)).toBe(0);
    expect(groundHeight(MOUNT_X, 0)).toBeGreaterThan(10);
  });
});

describe('separateRacers', () => {
  it('pushes two overlapping racers apart toward `sep`', () => {
    const a = { g: { position: { x: 0, y: 0, z: 0 } } } as unknown as Racer;
    const b = { g: { position: { x: 0.5, y: 0, z: 0 } } } as unknown as Racer;
    separateRacers([a, b], 4);
    const gap = Math.abs(b.g.position.x - a.g.position.x);
    expect(gap).toBeGreaterThan(0.5); // were 0.5 apart, now pushed out toward 4
  });
});
