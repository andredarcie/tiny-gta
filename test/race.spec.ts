// Race-mode end-to-end test: the AI actually plays a race in a real browser and
// must finish it. Demonstrates the GameDriver harness (test/support/game.js).
//
// We use the OFF-ROAD race because its circuit is on open terrain, so a simple
// "steer toward the next checkpoint" autopilot can drive it reliably. The same
// GameDriver also drives the street and boat races (street has buildings between
// checkpoints, so an autopilot there needs road-following — out of scope here).
import { test, expect } from './support/game.ts';

// Fixed off-road circuit from js/activities/offroad.ts: an oval on the pasture south of
// Divinolândia (centre = town (0,1300) + the world offset), start gate on its west point
// and 12 ordered checkpoints; the last one, back by the gate, is the finish line.
const C = { x: 5000, z: 6300 }, RX = 110, RZ = 76;
const OFFROAD_START = { x: C.x - RX, z: C.z };
const OFFROAD_CPS = [.17, .33, .5, .67, .83, 1, 1.17, 1.33, 1.5, 1.67, 1.83, 1.97].map(k => {
  const a = Math.PI + k * Math.PI;
  return { x: C.x + Math.cos(a) * RX, z: C.z - Math.sin(a) * RZ };
});

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
