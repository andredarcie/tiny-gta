// "Where is the ground" — the game's single source of truth, re-exported by
// js/core/constants.ts so every `@/core/constants.ts` import keeps working. Pure
// TypeScript, zero imports, no THREE.
//
// The world is Divinolândia (SP): the real town's baked heightfield lives in
// js/world/divinolandia/data.ts, which registers it here (setDivinoTerrain) as soon as it
// is decoded, so this file stays import-free. Everything west of DIVINO_X_MIN is the
// off-map rooms (club, shops, hospital, jail, house, escape tunnel) at x ≈ -700…-1000:
// flat floors at y = 0.

// Anything east of this x is the town (shifted to world +5000,+5000 — see data.ts).
export const DIVINO_X_MIN=3000;
let divinoH: ((x: number, z: number) => number) | null = null;
export function setDivinoTerrain(fn: (x: number, z: number) => number): void { divinoH=fn; }
// The paving drawn OVER the terrain (streets, kerbed sidewalks, squares): js/world/surface-lift.ts
// registers it here, so whatever stands or drives on the ground stands on what is drawn.
let overlay: ((x: number, z: number) => number) | null = null;
export function setGroundOverlay(fn: (x: number, z: number) => number): void { overlay=fn; }
export function groundHeight(x: number, z: number): number {
  return x>DIVINO_X_MIN&&divinoH?divinoH(x,z)+(overlay?overlay(x,z):0):0;
}
// The bare terrain, without the paving (what the paving itself is draped on).
export function terrainHeight(x: number, z: number): number {
  return x>DIVINO_X_MIN&&divinoH?divinoH(x,z):0;
}

export const clamp=(v: number, a: number, b: number): number=>Math.max(a,Math.min(b,v));
export const wrapA=(a: number): number=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
