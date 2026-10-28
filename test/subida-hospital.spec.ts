// The upper Rua Leonor Mendes de Barros, from the E.E. Vicente Nasser up to the Hospital
// Regional's gate (ruas/leonor-mendes-de-barros-alta.ts) — a visual check in the running game
// (HEADED, for the human to watch): the car is set down at points along it, looking up the
// street or at one side, a screenshot each to output/visual/subida/, the street name the HUD
// shows there, the car's height over the ground, and no runtime error.
import { test, expect } from './support/game.ts';

// [name, x, z, look-at x, look-at z] (world), from output/pesquisa/lh-pontos.ts
const P: [string, number, number, number, number][] = [
  ['subida-00', 4980.5, 5341.8, 4978.6, 5351.7],
  ['subida-60', 4942, 5395.1, 4949.6, 5401.5],
  ['subida-110', 4911.5, 5434.7, 4904.8, 5442.2],
  ['subida-130', 4893.9, 5445.6, 4895.7, 5455.4],
  ['subida-170', 4866.3, 5472, 4859.6, 5479.4],
  ['subida-215', 4840.2, 5508.3, 4832, 5502.6],
  ['subida-250', 4819.3, 5536.6, 4828.6, 5540.4],
  ['subida-285', 4808.3, 5569.9, 4804.5, 5579.1],
  ['subida-300', 4804.9, 5584.7, 4795.6, 5580.9],
  ['subida-310', 4797.2, 5590.2, 4806.4, 5594],
];

test('from the Nasser school up to the hospital', async ({ game, page }) => {
  test.setTimeout(300_000);
  const errs: string[] = [];
  page.on('pageerror', e => { if (!/Pointer Lock/i.test(e.message)) errs.push(e.message); });
  await game.enterCar();
  await game.inPage(() => (window as any).advanceTime(1500));        // flush the enter animation
  const rows: string[] = [];
  for (const [name, x, z, tx, tz] of P) {
    await game.placeVehicle(x, z, tx, tz);
    await game.inPage(() => (window as any).advanceTime(800));       // settle the car and the camera
    await page.waitForTimeout(1200);                                 // let the chunks around draw
    await page.screenshot({ path: `output/visual/subida/${name}.png` });
    const s = await game.snapshot();
    const place = await page.evaluate(() => document.getElementById('location')?.textContent ?? '');
    rows.push(`${name}: hud "${place}" car y ${s.player?.y?.toFixed?.(2)} mode ${s.mode}`);
    expect(place).not.toContain('#');
  }
  console.log(rows.join('\n'));
  expect(errs).toEqual([]);
});
