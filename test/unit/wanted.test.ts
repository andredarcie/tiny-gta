import { describe, it, expect } from 'vitest';
import {
  MAX_STARS, LETHAL_AT, HELI_AT, ROCKET_AT, ARMY_AT,
  WANTED_GRACE, WANTED_COOL, SIX_STAR_HOLD, ARMY_BLOCK_DIST,
  CRIME_HEAT,
  clampStars, addStars, starLevel, starResponse, coolWanted,
} from '@/core/wanted.ts';

// The police WANTED-STAR system, validated end to end against js/core/wanted.ts — the
// single source of truth the runtime (physics.addWanted + police.updateCops) consumes.
// Goal: 100% coverage of every star level and transition.

describe('wanted — escalation constants', () => {
  it('tops out at 6 stars', () => {
    expect(MAX_STARS).toBe(6);
  });

  it('escalates lethal → heli → rocket → army in strictly rising order, army at the cap', () => {
    expect(LETHAL_AT).toBe(2);
    expect(HELI_AT).toBe(4);
    expect(ROCKET_AT).toBe(5);
    expect(ARMY_AT).toBe(6);
    const order = [LETHAL_AT, HELI_AT, ROCKET_AT, ARMY_AT];
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
    expect(ARMY_AT).toBe(MAX_STARS);
  });

  it('exposes the cooldown tuning', () => {
    expect(WANTED_GRACE).toBe(24);
    expect(WANTED_COOL).toBe(10);
    expect(SIX_STAR_HOLD).toBe(30);
    expect(ARMY_BLOCK_DIST).toBe(90);
  });
});

describe('CRIME_HEAT — per-crime star cost', () => {
  it('matches the canonical heat each crime adds', () => {
    expect(CRIME_HEAT.pursuit).toBe(0.25);
    expect(CRIME_HEAT.vehicle_shot).toBe(0.35);
    expect(CRIME_HEAT.gunfire).toBe(0.4);
    expect(CRIME_HEAT.melee).toBe(0.4);
    expect(CRIME_HEAT.hit_run).toBe(1);
    expect(CRIME_HEAT.ped_shot).toBe(1);
    expect(CRIME_HEAT.rural_shot).toBe(1);
    expect(CRIME_HEAT.explosion).toBe(1);
    expect(CRIME_HEAT.vehicle_destroyed).toBe(1.5);
    expect(CRIME_HEAT.cop_killed).toBe(1.5);
  });

  it('every crime adds a positive amount no bigger than one full meter', () => {
    for (const v of Object.values(CRIME_HEAT)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(MAX_STARS);
    }
  });
});

describe('clampStars — legal 0..6 range', () => {
  it('floors negatives to 0', () => {
    expect(clampStars(-1)).toBe(0);
    expect(clampStars(-0.0001)).toBe(0);
  });
  it('caps anything over the max at the max', () => {
    expect(clampStars(7)).toBe(6);
    expect(clampStars(6.0001)).toBe(6);
  });
  it('passes in-range values through, boundaries included', () => {
    expect(clampStars(0)).toBe(0);
    expect(clampStars(6)).toBe(6);
    expect(clampStars(3.4)).toBe(3.4);
  });
});

describe('addStars — heat accumulation', () => {
  it('adds the delta', () => {
    expect(addStars(0, 0.4)).toBeCloseTo(0.4);
    expect(addStars(2, 1.5)).toBeCloseTo(3.5);
  });
  it('never exceeds the 6-star cap', () => {
    expect(addStars(5.5, 1)).toBe(6);
    expect(addStars(6, 1.5)).toBe(6);
  });
  it('never drops below 0 (defensive against a negative delta)', () => {
    expect(addStars(0.2, -1)).toBe(0);
  });
  it('builds the first star from repeated gunshots (heat is sub-star per shot)', () => {
    let w = 0;
    w = addStars(w, CRIME_HEAT.gunfire);            // 0.4
    expect(starLevel(w)).toBe(0);
    w = addStars(w, CRIME_HEAT.gunfire);            // 0.8
    w = addStars(w, CRIME_HEAT.gunfire);            // 1.2
    expect(starLevel(w)).toBe(1);
  });
  it('a single serious crime (cop kill) jumps past the first star', () => {
    expect(starLevel(addStars(0, CRIME_HEAT.cop_killed))).toBe(1); // 1.5 → ★1
    expect(starLevel(addStars(4.6, CRIME_HEAT.cop_killed))).toBe(6); // clamps at the cap
  });
});

describe('starLevel — the visible star count', () => {
  it('floors the clamped wanted value', () => {
    expect(starLevel(0)).toBe(0);
    expect(starLevel(0.9)).toBe(0);
    expect(starLevel(1)).toBe(1);
    expect(starLevel(3.99)).toBe(3);
    expect(starLevel(6)).toBe(6);
  });
  it('clamps out-of-range inputs first', () => {
    expect(starLevel(-5)).toBe(0);
    expect(starLevel(99)).toBe(6);
  });
});

describe('starResponse — the police response at EVERY star', () => {
  const POOL = 8; // larger than any star so chasers is not pool-limited here
  // Exhaustive table ★0..★6: this is the contract for "what each star does".
  const TABLE = [
    { star: 0, surrender: false, lethal: false, heli: false, rocket: false, army: false, chasers: 0 },
    { star: 1, surrender: true,  lethal: false, heli: false, rocket: false, army: false, chasers: 1 },
    { star: 2, surrender: false, lethal: true,  heli: false, rocket: false, army: false, chasers: 2 },
    { star: 3, surrender: false, lethal: true,  heli: false, rocket: false, army: false, chasers: 3 },
    { star: 4, surrender: false, lethal: true,  heli: true,  rocket: false, army: false, chasers: 4 },
    { star: 5, surrender: false, lethal: true,  heli: true,  rocket: true,  army: false, chasers: 5 },
    { star: 6, surrender: false, lethal: true,  heli: true,  rocket: true,  army: true,  chasers: 0 },
  ];

  for (const row of TABLE) {
    const tag = row.army ? 'army' : row.rocket ? 'rocket' : row.heli ? 'heli'
      : row.lethal ? 'lethal' : row.surrender ? 'surrender' : 'clean';
    it(`★${row.star} → ${tag}`, () => {
      expect(starResponse(row.star, POOL)).toEqual(row);
    });
  }

  it('★1 is the only surrender level; ★2+ are all lethal', () => {
    expect(starResponse(1).surrender).toBe(true);
    for (const s of [0, 2, 3, 4, 5, 6]) expect(starResponse(s).surrender).toBe(false);
    for (const s of [2, 3, 4, 5, 6]) expect(starResponse(s).lethal).toBe(true);
    for (const s of [0, 1]) expect(starResponse(s).lethal).toBe(false);
  });

  it('floors a fractional wanted value to its star', () => {
    expect(starResponse(2.9).star).toBe(2);
    expect(starResponse(2.9).lethal).toBe(true);
    expect(starResponse(3.999, POOL).chasers).toBe(3);
  });

  it('the chasing squad clamps to the available cruiser pool', () => {
    expect(starResponse(5, 3).chasers).toBe(3); // pool < star
    expect(starResponse(5, 8).chasers).toBe(5); // pool > star
    expect(starResponse(3, 3).chasers).toBe(3); // pool === star
  });

  it('defaults the pool to 5 when omitted', () => {
    expect(starResponse(5).chasers).toBe(5);
    expect(starResponse(4).chasers).toBe(4);
  });

  it('★6 hands the chase to the army: zero cruisers pursue', () => {
    expect(starResponse(6, 8).chasers).toBe(0);
    expect(starResponse(6).army).toBe(true);
  });

  it('clamps an over-cap wanted value to ★6', () => {
    expect(starResponse(99).star).toBe(6);
    expect(starResponse(99).army).toBe(true);
  });
});

describe('coolWanted — star decay after the heat is lost', () => {
  // Baseline: clear of the police, well past the grace window, no army around.
  const clear = { seen: false, sinceCrime: 999, sinceSixStar: 999, armyDist: 1e9 };

  it('leaves a clean (0) wanted at 0', () => {
    expect(coolWanted(0, 1, clear)).toBe(0);
  });
  it('clamps a negative wanted up to 0', () => {
    expect(coolWanted(-2, 1, clear)).toBe(0);
  });

  it('holds the star while a unit still has you in view', () => {
    expect(coolWanted(3, 1, { ...clear, seen: true })).toBe(3);
  });

  it('holds the star until the grace window has fully elapsed', () => {
    expect(coolWanted(3, 1, { ...clear, sinceCrime: WANTED_GRACE - 5 })).toBe(3);
    expect(coolWanted(3, 1, { ...clear, sinceCrime: WANTED_GRACE })).toBe(3); // needs to be strictly past
  });

  it('holds the star while the army is right on top of you', () => {
    expect(coolWanted(3, 1, { ...clear, armyDist: 50 })).toBe(3);
    expect(coolWanted(3, 1, { ...clear, armyDist: ARMY_BLOCK_DIST })).toBe(3); // exactly at the limit still holds
  });

  it('sheds one star over WANTED_COOL seconds once truly clear', () => {
    expect(coolWanted(3, 1, clear)).toBeCloseTo(3 - 1 / WANTED_COOL);
    expect(coolWanted(3, WANTED_COOL, clear)).toBeCloseTo(2); // a full cool window = one star
  });
  it('never cools below 0', () => {
    expect(coolWanted(0.05, 1, clear)).toBe(0);
  });

  it('holds ★6 for SIX_STAR_HOLD before it can start cooling', () => {
    // inside the hold: frozen at 6 even though everything else would let it cool
    expect(coolWanted(6, 1, { ...clear, sinceSixStar: SIX_STAR_HOLD - 1 })).toBe(6);
    // hold elapsed: ★6 cools like any other star
    expect(coolWanted(6, 1, { ...clear, sinceSixStar: SIX_STAR_HOLD })).toBeCloseTo(6 - 1 / WANTED_COOL);
  });
  it('the ★6 hold applies only at the cap (★5 cools regardless of sinceSixStar)', () => {
    expect(coolWanted(5, 1, { ...clear, sinceSixStar: 0 })).toBeCloseTo(5 - 1 / WANTED_COOL);
  });
});
