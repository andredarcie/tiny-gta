import { describe, it, expect } from 'vitest';
import {
  DOOM_TICRATE, DOOM_UNIT, DOOM_FRICTION, DOOM_VIEWHEIGHT,
  doomStep, doomThrust, doomTurnRate, doomBob, type DoomMomentum,
} from '../../src/js/actors/doom-physics.ts';

// Reference: the literal per-tic loop from DOOM's P_MovePlayer + P_XYMovement
// (mom += thrust; move by mom; mom *= FRICTION; STOPSPEED snap with no input).
function doomReference(ax: number, tics: number, hasCmd = true) {
  let v = 0, dist = 0;
  for (let i = 0; i < tics; i++) {
    if (hasCmd) v += ax;
    dist += v;
    if (!hasCmd && Math.abs(v) < 0x1000 / 0x10000) v = 0;
    else v *= 0xE800 / 0x10000;
  }
  return { v, dist };
}

// Running `seconds` of forward movement at a given frame rate through doomStep.
function simulate(fwd: number, run: boolean, seconds: number, fps: number) {
  const mom: DoomMomentum = { x: 0, z: 0 };
  const t = doomThrust(fwd, 0, run);
  let dist = 0;
  const dt = 1 / fps, frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) dist += doomStep(mom, 0, t.fwd, dt * DOOM_TICRATE, !!t.fwd).dz;
  return { mom, dist };
}

describe('DOOM player physics (linuxdoom-1.10 constants)', () => {
  it('uses the source constants', () => {
    expect(DOOM_TICRATE).toBe(35);
    expect(DOOM_FRICTION).toBe(0.90625);            // 0xE800 / 0x10000
    expect(DOOM_VIEWHEIGHT * DOOM_UNIT).toBeCloseTo(1.562, 3); // 41 units, 8 units = 1 ft
  });

  it('walk / run top speeds match thrust/(1-friction)', () => {
    const walk = doomThrust(1, 0, false).fwd, run = doomThrust(1, 0, true).fwd;
    expect(walk / (1 - DOOM_FRICTION)).toBeCloseTo(8.333, 3);   // units/tic
    expect(run / (1 - DOOM_FRICTION)).toBeCloseTo(16.667, 3);
    // after 3 s the displacement per tic has converged to top speed
    const m = simulate(1, true, 3, 60).mom;
    expect((m.z + run)).toBeCloseTo(16.667, 2); // v + thrust = distance moved per tic
    expect(16.667 * DOOM_TICRATE * DOOM_UNIT).toBeCloseTo(22.2, 1); // m/s
  });

  it('strafe speeds and straferunning (no normalisation)', () => {
    const t = doomThrust(1, 1, true);
    expect(t.side / (1 - DOOM_FRICTION)).toBeCloseTo(13.333, 3);
    expect(Math.hypot(t.fwd, t.side) / (1 - DOOM_FRICTION)).toBeCloseTo(21.34, 2);
  });

  it('matches the literal per-tic DOOM loop exactly at tic boundaries', () => {
    const ax = doomThrust(1, 0, true).fwd;
    for (const tics of [1, 5, 23, 70]) {
      const ref = doomReference(ax, tics);
      const mom: DoomMomentum = { x: 0, z: 0 };
      const d = doomStep(mom, 0, ax, tics, true);
      expect(d.dz).toBeCloseTo(ref.dist, 9);
      expect(mom.z).toBeCloseTo(ref.v, 9);
    }
  });

  it('is frame-rate independent (30/60/144 fps agree)', () => {
    const a = simulate(1, true, 1, 30).dist, b = simulate(1, true, 1, 60).dist, c = simulate(1, true, 1, 144).dist;
    expect(b).toBeCloseTo(a, 6);
    expect(c).toBeCloseTo(a, 6);
  });

  it('glides to a stop and snaps below STOPSPEED', () => {
    const mom: DoomMomentum = { x: 0, z: 16.667 };
    for (let i = 0; i < 200; i++) doomStep(mom, 0, 0, 1, false);
    expect(mom.z).toBe(0);
  });

  it('keyboard turn: slow for 6 tics, then 640 / 1280 angleturn', () => {
    const deg = (r: number) => r * 180 / Math.PI;
    expect(deg(doomTurnRate(0, false))).toBeCloseTo(61.52, 1);
    expect(deg(doomTurnRate(10, false))).toBeCloseTo(123.05, 1);
    expect(deg(doomTurnRate(10, true))).toBeCloseTo(246.09, 1);
  });

  it('view bob is capped at MAXBOB/2 units', () => {
    let max = 0;
    for (let t = 0; t < 40; t++) max = Math.max(max, Math.abs(doomBob({ x: 0, z: 16.667 }, t)));
    expect(max).toBeLessThanOrEqual(8);
    expect(max).toBeGreaterThan(7.5);
  });
});
