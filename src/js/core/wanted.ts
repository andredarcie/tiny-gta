// ============================================================================
// Wanted-star rules — the SINGLE SOURCE OF TRUTH for the police star system.
//
// Pure and dependency-free (no Three.js / DOM / audio), so it runs in Node and is
// unit-tested to 100% (test/unit/wanted.test.ts). The runtime consumes it from
// js/core/physics.ts (addWanted) and js/actors/police.ts (response + cooldown), so the
// HUD, the police AI and the tests can never drift on what a given star level means.
// ============================================================================

/** Highest wanted level. The HUD shows 6 stars; reaching ★6 summons the army. */
export const MAX_STARS = 6;

// The star (compared against floor(wanted)) at which each escalation kicks in.
export const LETHAL_AT = 2; // ★2+: officers shoot on sight (★1 = surrender chance)
export const HELI_AT = 4;   // ★4+: a police helicopter joins the chase
export const ROCKET_AT = 5; // ★5+: foot officers carry rocket launchers
export const ARMY_AT = 6;   // ★6:  the army responds (and cruisers stop chasing)

// Cooldown tuning (seconds / metres).
export const WANTED_GRACE = 24;    // out of sight this long before the star starts cooling
export const WANTED_COOL = 10;     // seconds to shed ONE star once it is cooling
export const SIX_STAR_HOLD = 30;   // ★6 is held at least this long before it can cool
export const ARMY_BLOCK_DIST = 90; // stars won't cool while the army is within this many metres

// How much each crime adds to the wanted meter. Canonical mirror of every addWanted()
// call site across the game (weapons, vehicles, hit-and-run, cop kills, …).
export const CRIME_HEAT = {
  pursuit: 0.25,          // a car bump / ram during a chase
  vehicle_shot: 0.35,     // shooting a vehicle
  gunfire: 0.4,           // firing a gun in public (per shot)
  melee: 0.4,             // a melee hit
  hit_run: 1,             // running someone over
  ped_shot: 1,            // killing a pedestrian
  rural_shot: 1,          // killing a country dweller
  explosion: 1,           // setting off an explosion
  vehicle_destroyed: 1.5, // blowing up a vehicle
  cop_killed: 1.5,        // killing an officer
} as const;

export type Crime = keyof typeof CRIME_HEAT;

/** Clamp a raw wanted value into the legal 0..MAX_STARS range. */
export function clampStars(wanted: number): number {
  if (wanted < 0) return 0;
  if (wanted > MAX_STARS) return MAX_STARS;
  return wanted;
}

/** Add a heat delta to the current wanted meter, clamped to 0..MAX_STARS. */
export function addStars(current: number, delta: number): number {
  return clampStars(current + delta);
}

/** The visible star count (0..MAX_STARS) for a raw wanted value. */
export function starLevel(wanted: number): number {
  return Math.floor(clampStars(wanted));
}

/** The police response a given wanted level triggers. */
export interface StarResponse {
  star: number;       // floor(wanted), 0..MAX_STARS
  surrender: boolean; // ★1 only: officers offer a surrender (hold fire unless resisted)
  lethal: boolean;    // ★2+: officers shoot on sight
  heli: boolean;      // ★4+: a police helicopter
  rocket: boolean;    // ★5+: rocket-armed officers
  army: boolean;      // ★6: the army
  chasers: number;    // cruisers actively chasing (0 when clean, 0 at ★6 — army takes over)
}

/**
 * Resolve the full police response for a wanted value. `pool` is how many cruisers
 * exist; the number that actively chase grows with the stars up to that pool, then
 * drops to zero at ★6 when the army takes over.
 */
export function starResponse(wanted: number, pool = 5): StarResponse {
  const star = starLevel(wanted);
  return {
    star,
    surrender: star >= 1 && star < LETHAL_AT,
    lethal: star >= LETHAL_AT,
    heli: star >= HELI_AT,
    rocket: star >= ROCKET_AT,
    army: star >= ARMY_AT,
    chasers: star > 0 && star < ARMY_AT ? Math.min(pool, star) : 0,
  };
}

/** Context for one cooldown step (everything coolWanted needs, with no engine coupling). */
export interface CoolContext {
  seen: boolean;        // a unit currently has the player in view → the star never cools
  sinceCrime: number;   // seconds since the last crime / last time seen
  sinceSixStar: number; // seconds since ★6 was (re)armed
  armyDist: number;     // metres to the nearest soldier (1e9 when no army)
}

/**
 * One frame of star cooldown. Returns the new wanted value after `dt` seconds.
 * Stars hold (never cool) while the police can see you, until the grace window after you
 * break contact has elapsed; ★6 holds for SIX_STAR_HOLD first, and nothing cools while the
 * army is right on top of you. Mirrors the decay in js/actors/police.ts updateCops().
 */
export function coolWanted(wanted: number, dt: number, ctx: CoolContext): number {
  if (wanted <= 0) return Math.max(0, wanted);
  const sixHold = wanted >= MAX_STARS && ctx.sinceSixStar < SIX_STAR_HOLD;
  if (!sixHold && !ctx.seen && ctx.sinceCrime > WANTED_GRACE && ctx.armyDist > ARMY_BLOCK_DIST) {
    return Math.max(0, wanted - dt / WANTED_COOL);
  }
  return wanted;
}
