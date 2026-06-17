// Cannabis strains for the grow-op. The three "species"/types the real market is
// built on — INDICA, SATIVA and HYBRID — each with its own price and grow-op
// mechanics. Bought at the rural General Store (js/general-store.js, pick which one
// like the gun-shop counter) and planted at the weed farm (js/weed-farm.js).
//
// PURE DATA, no imports — so the shop MODEL can read it for the counter display and
// gameplay can read it for the mechanics, with no circular deps.
//
// Per-strain multipliers (1.0 = the farm's baseline tuning in js/weed-farm.js):
//   grow     growth time to ripe   (indica quicker, sativa slower)
//   drain    hydration used / sec  (sativa drinks more)
//   hardy    seconds bone-dry before it dies (indica tougher, sativa fragile)
//   yieldMul buds harvested
//   value    cash per bud
//   color    leaf tint so each strain looks different on the bed
export const STRAINS=[
  { id:'indica', name:'INDICA', full:'Northern Indica', price:20, pack:3,
    grow:0.78, drain:0.85, hardy:1.7, yieldMul:0.85, value:0.9,  color:0x6f8f46,
    blurb:'HARDY-FAST-FORGIVING' },
  { id:'hybrid', name:'HYBRID', full:'Blue Dream Hybrid', price:35, pack:3,
    grow:1.0,  drain:1.0,  hardy:1.0, yieldMul:1.05, value:1.15, color:0x4f9a6d,
    blurb:'BALANCED ALL-ROUNDER' },
  { id:'sativa', name:'SATIVA', full:'Sour Diesel Sativa', price:55, pack:3,
    grow:1.35, drain:1.25, hardy:0.7, yieldMul:1.25, value:1.5,  color:0xa6d36a,
    blurb:'SLOW-THIRSTY-TOP DOLLAR' },
];
export const STRAIN_BY_ID=Object.fromEntries(STRAINS.map(s=>[s.id,s]));
export const DEFAULT_STRAIN='hybrid';

// Plant food sold at the store (the corner feed-sacks), fed to a growing plant once
// to boost its harvest. yieldMul stacks on the strain; qualBoost speeds quality gain.
export const FERTILIZER={ id:'fertilizer', name:'PLANT FOOD', price:25, pack:2,
  yieldMul:1.3, qualBoost:1.8, blurb:'BIGGER, BETTER BUDS' };

// Curing: hang a harvest on the drying rack, wait, collect for a value bonus.
export const CURE_TIME=18;   // seconds on the rack to fully cure
export const CURE_BONUS=1.45; // cash multiplier for selling cured (vs wet) buds
