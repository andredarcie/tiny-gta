// The ray-cast vehicle on uneven ground (src/js/actors/vehicle-ground.ts): the body never
// ends a step inside the ground, it follows slopes, rolls on side slopes, and flies over a
// crest taken fast instead of sticking to it.
import { describe, it, expect } from 'vitest';
import { poseOnGround, stepBody, newBody, CAR, type GroundFn } from '../../src/js/actors/vehicle-ground.ts';

const flat: GroundFn = () => 10;
const ramp: GroundFn = (_x, z) => 10 + z * .15;                         // 15% climb toward +z
const side: GroundFn = (x) => 10 + x * .12;                             // 12% side slope (higher at +x)
// a sharp crest across the road at z = 0 (+20% then -20%)
const crest: GroundFn = (_x, z) => 10 + (z < 0 ? z * .2 : -z * .2);
// a 30 cm step (kerb-like) at z = 0
const step: GroundFn = (_x, z) => (z < 0 ? 10 : 10.3);

function underside(H: GroundFn, x: number, z: number, h: number) { return poseOnGround(H, x, z, h, CAR).penetration; }

describe('resting pose', () => {
  it('sits flat on flat ground', () => {
    const p = poseOnGround(flat, 0, 0, 0);
    expect(p.y).toBeCloseTo(10.03, 6);   // tyres on the drawn asphalt (STREET_LIFT) expect(p.pitch).toBeCloseTo(0, 6); expect(p.roll).toBeCloseTo(0, 6);
  });
  it('pitches up a climb (nose up when facing uphill)', () => {
    expect(poseOnGround(ramp, 0, 0, 0).pitch).toBeCloseTo(Math.atan(.15), 3);
    expect(poseOnGround(ramp, 0, 0, Math.PI).pitch).toBeCloseTo(-Math.atan(.15), 3);
  });
  it('rolls on a side slope (left = +x when facing +z goes up)', () => {
    expect(poseOnGround(side, 0, 0, 0).roll).toBeCloseTo(Math.atan(.12), 3);
  });
  it('never leaves the underside or a wheel inside the ground, on any of these grounds', () => {
    for (const H of [flat, ramp, side, crest, step])
      for (let z = -6; z <= 6; z += .25)
        for (const h of [0, .7, Math.PI / 2, 2.4, Math.PI])
          expect(underside(H, .3, z, h)).toBeLessThanOrEqual(1e-9);
  });
});

describe('driving', () => {
  const drive = (H: GroundFn, speed: number, z0: number, z1: number) => {
    const b = newBody(H(0, z0)); let z = z0, minClear = 1e9, air = 0;
    const dt = 1 / 60;
    while (z < z1) {
      const nz = z + speed * dt;
      stepBody(b, H, 0, z, 0, nz, 0, dt);
      z = nz;
      // the body's resting height is the lowest it may be: it must never be below it
      minClear = Math.min(minClear, b.y - poseOnGround(H, 0, z, 0).y);
      if (b.air > 0) air++;
    }
    return { b, minClear, air };
  };
  it('stays on a constant slope at speed (no false floating)', () => {
    const r = drive(ramp, 25, -20, 20);
    expect(r.air).toBe(0);
    expect(Math.abs(r.minClear)).toBeLessThan(1e-6);
  });
  it('flies over a sharp crest taken fast, and lands without sinking in', () => {
    const r = drive(crest, 28, -15, 90);
    expect(r.air).toBeGreaterThan(5);                // it left the ground for a while
    expect(r.minClear).toBeGreaterThan(-1e-6);       // and never ended a step inside it
    expect(r.b.air).toBe(0);                         // and it is back on the ground
  });
  it('climbs a kerb-height step without going through it', () => {
    expect(drive(step, 8, -5, 5).minClear).toBeGreaterThan(-1e-6);
  });
});
