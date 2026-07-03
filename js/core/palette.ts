// Central color palette — the single source of truth for the game's color
// vocabulary. Art direction: "Vice em Miniatura" (see ART_DIRECTION.md) — a
// miniature/diorama city: sun-faded matte world by day, Vice-style neon at
// night, with saturation reserved for things that carry gameplay meaning.
//
// Rules:
// - New/edited models take colors from here instead of inventing hex literals.
// - The environment stays on the muted families (FACADES/GROUND/NATURE).
// - Saturated color (NEON, AWNINGS) is an accent: markers, signs, the hero car,
//   small storefront surfaces — never whole buildings or terrain.
// - Test any new color under the three skies (noon / sunset / night keyframes
//   in js/world/daynight.ts) before settling on it.

// --- NEON — the UI accent family (mirrors :root vars in css/style.css). ---
// Use for HUD-adjacent world elements: neon signs, mission markers, hero car.
export const NEON={
  pink:0xff2e88,   // --pink  (also the hero car's paint)
  cyan:0x19e3ff,   // --cyan
  gold:0xffd24a,   // --gold
  cream:0xffe9c9,  // --cream
  blue:0x3e7bff,   // --blue
  ink:0x14091f,    // --ink (near-black purple ground of the UI)
};

// --- FACADES — sun-faded stucco, the muted base of the city (~60% of what ---
// the camera sees). "Miami pulled realistic": sand, warm off-white, soft
// coral/salmon, faded seafoam, aqua-grey, dusty terracotta.
export const FACADES=['#e7d8c2','#d8c5a6','#e3b6a6','#bcd4cd','#ccd6d0','#e0cbb1','#c7b69e','#d8bdac'];

// --- AWNINGS — saturated storefront accents. Small surfaces only. ---
export const AWNINGS=[0xc85d77,0x3f9a96,0xd7af4f,0xc7783c,0x90699e];

// --- FLEET — vehicle paint, the medium-saturation middle ("~30%"). Indexed ---
// in lockstep with carNames in js/core/state.ts.
export const CAR_COLORS=[0xc23b4e,0x3b7ac2,0xcf9a3a,0x5b5f6b,0x7a4f9e,0x3aa06b,0xd96fae,0xc4c8cf];

// --- WARDROBE — NPC looks. Shirts deliberately share the FLEET family so ---
// people and traffic read as one world. Skin/hair/pants feed the Mixamo
// region-recolor system (assets/models/characters/mixamo-rig.ts).
export const SHIRT_COLORS=[0xc23b4e,0x3b7ac2,0xcf9a3a,0x3aa06b,0xd96fae,0xe8e3d2,0x7a4f9e,0x40c8c0];
export const SKIN_TONES=[0xeec2a0,0xd9a06b,0xb8754c,0x8f5637,0x6f3e2a,0xf0c8a0];
export const HAIR_COLORS=[0x2e2018,0x14100c,0x4a2b18,0x6b5137,0x0d0d12,0x7a5a3a,0x9a9a9a];
export const PANTS_COLORS=[0x202435,0x263454,0x2e2a24,0x3d3f46,0x18191f,0xe7dec9,0x4a3b2a];

// --- GROUND & NATURE — reference values for terrain, roads and vegetation. ---
// Canvas painters (js/world/world.ts paintCityGround etc.) use the string
// forms; mesh materials use the numbers. Neutrals with a warm bias — never
// lime green or pool cyan.
export const GROUND={
  asphalt:'#45454b',
  sidewalk:'#bcb6a8',
  grass:'#69a85e',     // also mountain grass (assets/models/terrain/mountain.ts)
  parkGrass:'#5fae62',
  dirt:'#8a7a52',
  ruralRoad:'#b08a5e', // dirt roads + mountain trail
  soil:'#8a6a3e',      // ploughed fields
  sand:'#e7d29a',
  rock:'#8d8f99',
};
export const NATURE={
  treeLeaf:0x4f9a3e, treeLeafDark:0x3c7d36, trunk:0x6b4a32,
  bush:0x437a32, bushDark:0x356b2c,
  palmLeaf:0x3aa856, palmTrunk:0x96704e,
  sea:0x2e9ec4,
};
