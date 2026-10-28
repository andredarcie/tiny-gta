// Central color palette — the single source of truth for the game's color
// vocabulary. Art direction: PHOTOREAL, faithful to the real Divinolândia (see
// docs/ART_DIRECTION.md). The world's colours are MEASURED from recent photos of the town
// (Google Street View nov/2024 frames and the Google Maps satellite, kept in
// docs/divinolandia/referencias-*): aged materials, sun-bleached and dusty, low saturation.
//
// Rules:
// - New/edited models take colors from here instead of inventing hex literals.
// - A colour here is the material's ALBEDO (how it looks in plain daylight), not a
//   stylised swatch: when in doubt, sample the reference photos.
// - Saturated colour only where the real thing is saturated (a painted sign, a car's paint,
//   a flowering tree) — never as a style.
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
// people and traffic read as one world. Skin/hair/pants colour the box dolls
// (assets/models/characters/pedestrian.ts).
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
  grass:'#33500f',     // deep forest green — as dark as the forest foliage; also mountain grass (assets/models/terrain/mountain.ts)
  parkGrass:'#6a8445',      // a watered lawn in the sun (Street View: #899e49 lit, #5a7347 verge)
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
  pineLeaf:0x2f6a36, pineLeafDark:0x24532c,
  grass:0x5d8a36, grassDry:0x8a9a4a, clover:0x4f8a3a,
  rock:0x8d8f99, rockDark:0x6c6e78, rockWarm:0x9a8f80,
  mushroomCap:0xb8412f, mushroomStem:0xe8dcc0, shelfFungus:0xd9822c,
  coconut:0x5a3f24,
  petals:[0xd8c24a,0xc05a7a,0xe8e0d0,0x8a6ac0,0xd9743a] as number[],
  sea:0x2e9ec4,
};

// --- DIVINOLÂNDIA — the real interior-paulista town (src/js/world/divinolandia/). ---
// Same muted, sun-faded logic, tuned to a Serra da Mantiqueira coffee town: pastel
// limewash façades, clay-tile roofs, terra-roxa dirt roads, coffee-green slopes.
export const DIVINO={
  // façades measured on Street View: limewashed white and off-white dominate, then cream,
  // pale yellow, light grey and a few faded colours (pink, blue, green) — all dusty
  facades:['#e9e5dc','#e2ddd2','#ddd3bf','#e6dcc4','#d9cfb3','#cfcac0','#d8c4b4','#c6ccd0','#c9d0c2','#e0d4ba','#d4cbbd','#c9b39c'],
  roofTiles:['#7c4c3b','#86523f','#704536','#8d5c48'],   // telha cerâmica, aged and darkened
  slab:'#8a8680',            // laje / platibanda top
  frame:'#34302d',           // doors, window voids
  shutter:'#a9acaf',         // steel roll-up shop doors
  asphalt:'#6c6b68',         // sun-bleached asphalt (Street View: #85878c in the sun)
  sidewalk:'#a39a8c',
  // road paint, measured on the SP highway at the town's edge (Street View): faded yellow
  // centre lines, off-white edge lines and zebras
  paintYellow:'#cba268', paintWhite:'#d0d5ce',
  kerb:'#b9b4aa',             // concrete kerbs and gutters (meio-fio, sarjeta)
  dirtRoad:'#a48f84',        // dry terra roxa: pale rosy beige when trodden (#a99a92)
  pasture:'#52673a', pastureDry:'#727250', forest:'#2c3d27', soil:'#8a5e4a', rock:'#7d786e',
  coffee:0x324a2a, coffeeLight:0x3f5a33,
  tree:[0x3a5130,0x2f4428,0x46603a,0x354a2c] as number[], trunk:0x4a3d32,
  river:0x4f5b4c,            // Rio do Peixe: muddy green-brown
  // Prefeitura Municipal (Rua XV de Novembro), from Street View: royal-blue limewash with
  // white frieze and porch interiors, a thin red stripe under the eaves, clay pavers and
  // red tubular railings on the forecourt
  civicBlue:0x86a0d8, civicWhite:0xf1efe8, civicStripe:0xb3392f, civicRoof:0x9b5a44,
  pavers:0xa98a78, paversDark:0x8c6f60, railing:0xb83a30, stepTread:0xc9c4b8,
  // Hospital Regional (the 1945 Sanatório Adhemar de Barros), from Street View + photos:
  // sun-faded ochre-yellow render, cream slab bands and parapet caps, clay hipped roofs
  // with white hip flashing, grey steel window grids, the dark brick boiler chimney;
  // the modern annex in pale beige with a brown fascia under light-grey metal roofs
  hospWall:'#e6cc80', hospTrim:'#eee8d8', hospBase:'#b8ad95', hospRoof:'#bf6f57', hospHip:'#ebe8e1',
  hospFrame:'#80878a', hospChimney:'#41372f', hospSlab:'#9a958c',
  annexWall:'#dccaa0', annexFascia:'#7b5537', annexRoof:'#f4f6f7', annexWing:'#a9aeb0',
};
