// ============================================================================
// Difficulty tuning — how hard the player is to kill. Pure constants, one place.
// (How fast the police stars climb lives with the other star rules in js/core/wanted.ts
// — WANTED_HEAT_SCALE.)
// ============================================================================

/** Fraction of every hit the player actually takes (gunfire, cars, explosions, fire,
 *  drowning). 0.45 ≈ the player survives ~2.2x as much punishment as before. */
export const PLAYER_DAMAGE_TAKEN = 0.45;

/** Base damage of an explosion at point-blank on foot (falls off to 40% at 5 m), BEFORE
 *  PLAYER_DAMAGE_TAKEN. Used to be an instant death anywhere within 5 m. */
export const EXPLOSION_DAMAGE = 150;

/** Damage per fire-pool tick (every 0.5 s) while standing in flames, BEFORE
 *  PLAYER_DAMAGE_TAKEN. Used to be an instant death. */
export const FIRE_DAMAGE_TICK = 22;
