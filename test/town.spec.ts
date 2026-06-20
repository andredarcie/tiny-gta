// Verifies the new rural town "Pine Hollow" east of the mountain: the world boots
// with no runtime errors, the town is reachable (the car can be driven there beyond
// the old world edge), its church is solid (the car can't drive through it), and
// captures screenshots of the town and the map so the area can be eyeballed.
//
// NOTE: __test.placeVehicle(x,z,fx,fz) faces the car toward the POINT (fx,fz)
// (heading = atan2(fx-x, fz-z)), and snaps the chase cam to that heading — so pass
// a far-away point in the direction you want to look.
import {test, expect} from './support/game.ts';

test('rural town east of the mountain renders, is solid and reachable', async ({game, page}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await game.enterCar();

  // portrait: the square / town flag / church, looking NORTH from just south of center
  await game.placeVehicle(650, -16, 650, 1000);
  await page.waitForTimeout(1200);
  await page.screenshot({path: 'test-results/town-square.png'});

  // portrait: main street looking EAST from the west entrance (welcome sign + buildings)
  await game.placeVehicle(588, 7, 1000, 7);
  await page.waitForTimeout(1200);
  await page.screenshot({path: 'test-results/town-street.png'});

  // reach + collision: drive due SOUTH into the church and confirm it blocks the car
  await game.placeVehicle(650, 52, 650, -1000);
  const before = await game.snapshot();
  await game.down('w');
  await page.waitForTimeout(1400);
  await game.up('w');
  await page.waitForTimeout(300);
  const after = await game.snapshot();
  await page.screenshot({path: 'test-results/town-close.png'});

  expect(errors, 'no runtime errors in town: ' + errors.join(' | ')).toEqual([]);
  // drove due south staying on the church's column, in the new area beyond the mountain
  expect(after.player.x).toBeGreaterThan(640);
  expect(after.player.x).toBeLessThan(660);
  expect(after.player.z).toBeLessThan(before.player.z); // actually advanced south
  expect(after.player.z).toBeGreaterThan(40);           // the church stopped it (no pass-through)

  // full map (M): the town/road show on the map
  await page.keyboard.press('m');
  await page.waitForTimeout(500);
  await page.screenshot({path: 'test-results/town-map.png'});
  await page.keyboard.press('m');
});
