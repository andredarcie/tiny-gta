// Every SURVEYED street (lot by lot from Street View). One line per street: the bake
// keeps generated houses off them and paves them as surveyed; build.ts builds them.
// Pure data (imported by tools/bake-divinolandia.ts in Node).
import type {StreetSpec} from './spec.ts';
import {SPEC as JOSE_AUGUSTO_MACHADO} from './jose-augusto-machado.ts';
import {SPEC as XV_DE_NOVEMBRO} from './xv-de-novembro.ts';
import {SPEC as SETE_DE_SETEMBRO} from './sete-de-setembro.ts';
import {SPEC as BARAO_DO_RIO_BRANCO} from './barao-do-rio-branco.ts';
import {SPEC as TREZE_DE_MAIO} from './treze-de-maio.ts';
import {SPEC as ROMEU_ZANETTI} from './romeu-zanetti.ts';
import {SPEC as FRANCISCO_PEREIRA_DE_SOUZA} from './francisco-pereira-de-souza.ts';
import {SPEC as JOAQUIM_GARCIA} from './joaquim-garcia.ts';
import {SPEC as JOAO_DARCIE} from './joao-darcie.ts';
import {SPEC as LEONOR_MENDES_DE_BARROS} from './leonor-mendes-de-barros.ts';

export const STREETS:StreetSpec[]=[
  JOSE_AUGUSTO_MACHADO,
  XV_DE_NOVEMBRO,
  SETE_DE_SETEMBRO,
  BARAO_DO_RIO_BRANCO,
  TREZE_DE_MAIO,
  ROMEU_ZANETTI,
  FRANCISCO_PEREIRA_DE_SOUZA,
  JOAQUIM_GARCIA,
  JOAO_DARCIE,
  LEONOR_MENDES_DE_BARROS,
];
