// Race-mode end-to-end test: the AI actually plays a race in a real browser and
// must finish it. Demonstrates the GameDriver harness (test/support/game.js).
//
// We use the OFF-ROAD race because its circuit is on open terrain, so a simple
// "steer toward the next checkpoint" autopilot can drive it reliably. The same
// GameDriver also drives the street and boat races (street has buildings between
// checkpoints, so an autopilot there needs road-following — out of scope here).
import { test, expect } from './support/game.ts';

// Fixed off-road circuit from js/activities/offroad.ts (start gate + the 8 ordered
// checkpoints; the last one, back by the gate, is the finish line).
const OFFROAD_START = { x: 196, z: 4 };
const OFFROAD_CPS = [
  { x: 230, z: -54 }, { x: 280, z: -80 }, { x: 318, z: -46 }, { x: 320, z: 24 },
  { x: 286, z: 72 }, { x: 238, z: 84 }, { x: 208, z: 48 }, { x: 198, z: 8 },
];

test('AI drives and finishes the off-road race', async ({ game }) => {
  // get in the pink car, then set up at the off-road start gate
  await game.enterCar();
  await game.placeVehicle(OFFROAD_START.x, OFFROAD_START.z, OFFROAD_CPS[0].x, OFFROAD_CPS[0].z);

  // press E to start the race, then drive it to the finish with real W/A/D,
  // steering toward each live checkpoint — runs in real time so you can watch it
  await game.startRaceByKey('offroad');
  const result = await game.driveRace('offroad', { maxMs: 120_000 });

  console.log('[off-road race result]', JSON.stringify(result, (k, v) => (k === 'snapshot' ? undefined : v)));

  // the race ended and we crossed the finish (a podium prize was paid; if all
  // rivals had finished first it would have been a $0 loss)
  expect(result.finished).toBeTruthy();
  expect(result.lostByRivals).toBeFalsy();
  expect(result.cpReached).toBeGreaterThanOrEqual(OFFROAD_CPS.length - 1);
  expect(result.moneyGain).toBeGreaterThan(0);
});
