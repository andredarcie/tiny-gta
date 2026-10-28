// The Hospital Regional's front (the two drives, the little square between them, the
// reception porch) seen on foot from the angles of the reference photos — a visual check in
// the running game (HEADED): screenshots to output/visual/frente/ and no runtime error.
import { test, expect } from './support/game.ts';

// [name, x, z, look-at x, look-at z] (town-local, +5000 for world)
const P: [string, number, number, number, number][] = [
  ['porta', -332, 645, -343, 668],        // the reception from the outer drive
  ['ao-longo-leste', -300, 632, -360, 660],
  ['estacionamento', -352, 622, -330, 662], // from the red-earth car park (photo 3)
  ['ao-longo-oeste', -378, 662, -310, 640],
  ['pracinha', -345, 650, -320, 645],
  ['pedra', -276, 626, -284, 620],          // the dome of rock (photo 3)
  ['casinha', -372, 636, -384, 647],
];

test('the hospital front', async ({ game, page }) => {
  test.setTimeout(180_000);
  const errs: string[] = [];
  page.on('pageerror', e => { if (!/Pointer Lock/i.test(e.message)) errs.push(e.message); });
  for (const [name, x, z, tx, tz] of P) {
    await game.inPage(([a, b, c, d]: number[]) => (window as any).__test.teleport(a + 5000, b + 5000, c + 5000, d + 5000), [x, z, tx, tz]);
    await game.inPage(() => (window as any).advanceTime(600));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `output/visual/frente/${name}.png` });
  }
  expect(errs).toEqual([]);
});
