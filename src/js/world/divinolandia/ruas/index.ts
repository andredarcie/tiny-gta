// Every SURVEYED street (lot by lot from Street View). One line per street: the bake
// keeps generated houses off them and paves them as surveyed; build.ts builds them.
// Pure data (imported by tools/bake-divinolandia.ts in Node).
import type {StreetSpec} from './spec.ts';
import {SPEC as JOSE_AUGUSTO_MACHADO} from './jose-augusto-machado.ts';
import {SPEC as XV_DE_NOVEMBRO} from './xv-de-novembro.ts';
import {SPEC as SETE_DE_SETEMBRO} from './sete-de-setembro.ts';
import {SPEC as BARAO_DO_RIO_BRANCO} from './barao-do-rio-branco.ts';
import {SPEC as TREZE_DE_MAIO} from './treze-de-maio.ts';

export const STREETS:StreetSpec[]=[
  JOSE_AUGUSTO_MACHADO,
  XV_DE_NOVEMBRO,
  SETE_DE_SETEMBRO,
  BARAO_DO_RIO_BRANCO,
  TREZE_DE_MAIO,
];
