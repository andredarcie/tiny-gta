// The Hospital Regional's front (the two drives, the little square between them, the
// reception porch) seen on foot from the angles of the reference photos — a visual check in
// the running game (HEADED): screenshots to output/visual/frente/ and no runtime error.
import { test, expect } from './support/game.ts';

// [name, x, z, look-at x, look-at z] (town-local, +5000 for world)
const P: [string, number, number, number, number][] = [
  ['recepcao-93', -336.2, 658.1, -347.1, 670.3],      // the porch from the inner drive (photo m093)
  ['recepcao-100', -349.5, 643.8, -346.7, 671.2],     // across the square from the outer drive (m100)
  ['pracinha-99', -326.5, 638.7, -340.3, 666],        // the thujas, hedges and lamp (m099)
  ['ponta-95', -282.2, 624.9, -301.3, 650.2],         // the gate end and the east wing (m095)
  ['rua-dentro', -358.2, 667.7, -330.7, 658.3],       // along the paver strip under the façade
  ['estacionamento-20', -362.2, 623.3, -338.5, 665.2],// from the red-earth car park (m020)
  ['porta', -354.5, 661.6, -347.1, 670.3],            // the porch from across the drive
  ['vagas', -340.8, 660.2, -311, 653.1],          // the nose-in bays under the east wing (m093, m097)
  ['fachada-97', -310, 631.5, -332.2, 664.5],        // the east wing's closed verandas (m097)
  ['pedra', -276, 626, -284, 620],                    // the dome of rock (photo 3)
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
  // from above: as from the hospital's upper floors (photo m013), and straight down
  const CINE: [string, number, number, number, number, number, number][] = [
    ['aereo-13', 4647.8, 5673.7, 13, 4642.2, 5652.1, 0],
    ['topo', 4668.6, 5652, 70, 4667.8, 5650.2, 0],
    ['topo-leste', 4697.3, 5635.4, 55, 4696.5, 5633.6, 0],
    ['torre-84', 4653.3, 5664, 1.6, 4653.3, 5671.2, 14],   // the tower over the porch, looking up (m084)
  ];
  for (const [name, x, z, h, tx, tz, th] of CINE) {
    await game.inPage(([a, b, c, d, e, f]: number[]) => (window as any).__test.cineShot({ a: { x: a, z: b, h: c, tx: d, tz: e, th: f }, ms: 1, fov: 60 }), [x, z, h, tx, tz, th]);
    await game.inPage(() => (window as any).advanceTime(300));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `output/visual/frente/${name}.png` });
  }
  await game.inPage(() => (window as any).__test.cineShot(null));
  expect(errs).toEqual([]);
});
