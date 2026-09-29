// ============================================================================
// Difficulty tuning — how hard the player is to kill. Pure constants, one place.
// (How fast the police stars climb lives with the other star rules in js/core/wanted.ts
// — WANTED_HEAT_SCALE, STAR_CLIMB_DAMP, GUNFIRE_HEAT_GAP.)
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

// ---- how hard PEOPLE are to kill (NPC hit points; weapon damage per hit) ----
// A HEADSHOT always kills (decapitation, js/combat/gore.ts). Body shots only wear the
// target down and tear limbs off; a maimed person bleeds out slowly.
export const NPC_HP_CIVILIAN = 6;   // city pedestrians, country folk, party-arena fighters
export const NPC_HP_TOUGH = 8;      // gang members, police officers
/** Damage multiplier for a bullet that hits an arm or a leg (it tears the limb off instead). */
export const LIMB_HIT_DAMAGE = 0.5;
/** Damage of one lethal-melee (bat) hit — two swings down a civilian. */
export const MELEE_DAMAGE = 3;
/** A maimed NPC loses 1 HP every BLEED_INTERVAL seconds per missing limb, until it dies. */
export const BLEED_INTERVAL = 2.5;
