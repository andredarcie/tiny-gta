// Bakes the fixed world layout to /world.json. Run with: npm run bake
//
// The generator (js/world-gen.js) is pure (constants + seeded RNG, no Three.js/DOM),
// so it runs headlessly here. The game reads world.json at build/boot and never
// re-rolls anything. Re-run this only when you want to regenerate from the seed; to
// hand-tweak the map, edit world.json directly (a future editor will write it too).
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {generateWorldSpec} from '../js/world-gen.js';

const here=dirname(fileURLToPath(import.meta.url));
const SEED=Number(process.argv[2])||1337;
const spec=generateWorldSpec(SEED);
const out=join(here,'..','world.json');
writeFileSync(out,JSON.stringify(spec)+'\n');

const f=spec.forest;
console.log(`Wrote ${out} (seed ${SEED})`);
console.log(
  `  lots=${spec.cityLots.length} parkVeg=${spec.cityParkVeg.length} `+
  `palms=${spec.beachPalms.length} umbrellas=${spec.beachUmbrellas.length} `+
  `chairs=${spec.beachChairs.length} beachRocks=${spec.beachRocks.length}`);
console.log(
  `  forest: trees=${f.trees.length} bushes=${f.bushes.length} `+
  `ferns=${f.ferns.length} details=${f.details.length} mountainRocks=${spec.mountainRocks.length}`);
