// Firing a gun at nothing in the COUNTRYSIDE brings no police (no heat, no radio call);
// the same shooting in the city still raises the wanted level.
import { test, expect } from './support/game.ts';

async function fireShots(game: any, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await game.page.evaluate(() => (window as any).__test.attack());
    await game.page.waitForTimeout(700);            // > GUNFIRE_HEAT_GAP, each shot counts
  }
}

test('random gunfire in the countryside brings no police', async ({ game }) => {
  const page = game.page;
  await page.evaluate(() => (window as any).__test.giveGun());
  // Open prairie, aiming at the empty field. (The harness's boot click can already have
  // left a little heat, so compare against the level before shooting.)
  await page.evaluate(() => (window as any).__test.teleport(196, 4, 196, 104));
  await page.waitForTimeout(800);
  const before = (await game.snapshot()).wanted;
  await fireShots(game, 10);
  const rural = (await game.snapshot()).wanted;
  // Same thing in the city.
  await page.evaluate(() => (window as any).__test.teleport(0, 0, 0, -100));
  await page.waitForTimeout(800);
  await fireShots(game, 4);
  const city = (await game.snapshot()).wanted;
  console.log(`[rural gunfire] wanted ${before.toFixed(2)} -> after 10 rural shots ${rural.toFixed(2)} -> after 4 city shots ${city.toFixed(2)}`);
  expect(rural).toBe(before);
  expect(city).toBeGreaterThan(rural);
});
