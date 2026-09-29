// Drive a car straight across the Vesper Bridge (street level, no ramps): it must reach
// the far bank without ever climbing or dropping — the ride stays flat.
import { test, expect } from './support/game.ts';

test('a car crosses the street-level bridge flat', async ({ game }) => {
  test.setTimeout(90_000);
  await game.enterCar();
  await game.placeVehicle(200, 0, 300, 0);                 // city side, facing east along z=0
  await game.page.waitForTimeout(600);
  await game.down('w');
  const ys: number[] = [];
  let shot = false, s = await game.snapshot();
  for (let i = 0; i < 120 && s.vehicle && s.vehicle.x < 290; i++) {
    await game.page.waitForTimeout(100);
    s = await game.snapshot();
    if (s.vehicle.x > 220 && s.vehicle.x < 280) ys.push(s.vehicle.y);
    if (!shot && s.vehicle.x > 236) {
      await game.page.screenshot({ path: 'output/visual/bridge-crossing.png' });
      shot = true;
    }
  }
  await game.up('w');
  console.log(`[bridge] reached x=${s.vehicle?.x.toFixed(1)}, deck y min ${Math.min(...ys).toFixed(2)} max ${Math.max(...ys).toFixed(2)}`);
  expect(s.vehicle!.x).toBeGreaterThan(280);                // made it to the rural bank
  expect(Math.max(...ys)).toBeLessThan(0.6);                // never climbed a ramp
  expect(Math.min(...ys)).toBeGreaterThan(-0.3);            // never fell in the river
});
