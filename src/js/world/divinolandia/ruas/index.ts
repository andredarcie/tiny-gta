// Every SURVEYED street (lot by lot from Street View). One line per street: the bake
// keeps generated houses off them and paves them as surveyed; build.ts builds them.
// Pure data (imported by tools/bake-divinolandia.ts in Node).
import type {StreetSpec} from './spec.ts';
import {SPEC as JOSE_AUGUSTO_MACHADO} from './jose-augusto-machado.ts';

export const STREETS:StreetSpec[]=[
  JOSE_AUGUSTO_MACHADO,
];
