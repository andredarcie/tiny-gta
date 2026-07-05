// Deterministic, seedable PRNG (mulberry32). The world used to scatter buildings,
// trees and beach props with Math.random(), so every page-load produced a slightly
// different map. The world is now BAKED to a fixed file (world.json, see
// js/world/world-gen.ts + tools/bake-world.mjs) using this generator, so the layout is
// the same every time and can be hand-edited / opened by a future map editor.
//
// makeRng(seed) returns { random, rand, irand, pick } whose helpers mirror the
// Math.random-based ones in constants.js exactly (so ranges/counts are unchanged),
// only the underlying stream is deterministic.
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const random = (): number => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const rand = (lo: number, hi: number): number => lo + random() * (hi - lo);          // mirrors constants.rand
  const irand = (lo: number, hi: number): number => Math.floor(rand(lo, hi + 1));      // mirrors constants.irand (inclusive)
  const pick = <T>(arr: T[]): T => arr[Math.floor(random() * arr.length)];
  return { random, rand, irand, pick };
}
