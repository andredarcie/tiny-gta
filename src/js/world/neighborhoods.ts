// Neighborhood/district definitions for the persistent NPC system.
// Each city ped is assigned one neighborhood at birth and never leaves it —
// they walk within their district's block range and respawn there after hospital.
//
// The city is an 8×8 block grid (indices 0–7). Splitting it into 4 quadrants
// of 4×4 blocks each gives distinct areas that feel like real districts.
// Rural areas (folk from rural-folk.ts) use separate home-anchor wander logic.

export interface Neighborhood{
  name:string;
  // City block index ranges (0..N-1 = 0..7 for an 8×8 city)
  iMin:number;iMax:number; // x axis blocks
  jMin:number;jMax:number; // z axis blocks
  pedCount:number;         // how many city peds live here
}

// 4 city districts + 1 beach strip. Total city peds = 42 (unchanged pool size).
export const CITY_NEIGHBORHOODS:Neighborhood[]=[
  {name:'North Side', iMin:0,iMax:3,jMin:0,jMax:3,pedCount:11},
  {name:'East End',   iMin:4,iMax:7,jMin:0,jMax:3,pedCount:11},
  {name:'Downtown',   iMin:0,iMax:3,jMin:4,jMax:7,pedCount:10},
  {name:'Seaside',    iMin:4,iMax:7,jMin:4,jMax:7,pedCount:10},
];
// Sanity check: total must equal PED_POOL in pedestrians.ts (42).
// 11+11+10+10 = 42 ✓

// Picks a block [i, j] within the neighborhood bounds. Pass a seeded RNG (rng) for
// the deterministic initial placement; omit it (Math.random) for per-session picks
// like a hospital discharge, where determinism doesn't matter.
export function randomBlockIn(nh:Neighborhood,rng?:{random():number}):[number,number]{
  const r=rng?()=>rng.random():Math.random;
  const i=nh.iMin+Math.floor(r()*(nh.iMax-nh.iMin+1));
  const j=nh.jMin+Math.floor(r()*(nh.jMax-nh.jMin+1));
  return[i,j];
}
