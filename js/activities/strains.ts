// Cannabis strains for the grow-op. The three "species"/types the real market is
// built on — INDICA, SATIVA and HYBRID — each with its own price and grow-op
// mechanics. Bought at the rural General Store (js/places/general-store.ts, pick which one
// like the gun-shop counter) and planted at the weed farm (js/activities/weed-farm.ts).
//
// PURE DATA, no imports — so the shop MODEL can read it for the counter display and
// gameplay can read it for the mechanics, with no circular deps.
//
// Per-strain multipliers (1.0 = the farm's baseline tuning in js/activities/weed-farm.ts):
//   grow     growth time to ripe   (indica quicker, sativa slower)
//   drain    hydration used / sec  (sativa drinks more)
//   hardy    seconds bone-dry before it dies (indica tougher, sativa fragile)
//   yieldMul buds harvested
//   color    leaf tint so each strain looks different on the bed
// The per-strain CASH-per-bud multiplier (was `value` here) now lives in the central
// money config — /minigame-rewards.json → weedFarm.strainValues (keyed by strain id).
// NOTE: the money/cost/time values that used to live here (per-strain seed `price`,
// cash-per-bud `value`, `CURE_TIME`, `CURE_BONUS`) now live in the central config
// /minigame-rewards.json → weedFarm.* (read via @/core/minigame-rewards.ts), keyed by
// strain id. This file keeps only the per-strain GROW mechanics + display data.
export interface Strain {
  id: string;
  name: string;
  full: string;
  pack: number;
  grow: number;
  drain: number;
  hardy: number;
  yieldMul: number;
  color: number;
  blurb: string;
}
export const STRAINS: Strain[]=[
  { id:'indica', name:'INDICA', full:'Northern Indica', pack:3,
    grow:0.78, drain:0.85, hardy:1.7, yieldMul:0.85, color:0x6f8f46,
    blurb:'HARDY-FAST-FORGIVING' },
  { id:'hybrid', name:'HYBRID', full:'Blue Dream Hybrid', pack:3,
    grow:1.0,  drain:1.0,  hardy:1.0, yieldMul:1.05, color:0x4f9a6d,
    blurb:'BALANCED ALL-ROUNDER' },
  { id:'sativa', name:'SATIVA', full:'Sour Diesel Sativa', pack:3,
    grow:1.35, drain:1.25, hardy:0.7, yieldMul:1.25, color:0xa6d36a,
    blurb:'SLOW-THIRSTY-TOP DOLLAR' },
];
export const STRAIN_BY_ID: Record<string, Strain>=Object.fromEntries(STRAINS.map(s=>[s.id,s]));
export const DEFAULT_STRAIN='hybrid';

// Plant food sold at the store (the corner feed-sacks), fed to a growing plant once
// to boost its harvest. yieldMul stacks on the strain; qualBoost speeds quality gain.
// (Its price lives in the central config — weedFarm.fertilizerPrice.)
export const FERTILIZER={ id:'fertilizer', name:'PLANT FOOD', pack:2,
  yieldMul:1.3, qualBoost:1.8, blurb:'BIGGER, BETTER BUDS' };
