// Weed farm in FIRST PERSON: plays the whole hand loop on the real game — pick up the
// bucket, fill it at the faucet, sow a bed, water it, harvest the (fast-ripened) plant
// and lay it in the crate — asserting the state after each clip and saving frames of
// every animation to output/visual/farm/ for review. Drying on the rack is mandatory.
//   npx playwright test test/weed-farm.spec.ts
import { test, expect } from './support/game.ts';

const CX = 620, CZ = -90;                       // compound centre (assets/models/rural/weed-farm.ts)
const W = (x: number, z: number) => ({ x: CX + x, z: CZ + z });

test('weed farm first-person hand loop', async ({ game }) => {
  test.setTimeout(180_000);
  const page = game.page;
  const farm = (cmd: string) => page.evaluate((c) => (window as any).__test.farm(c), cmd) as Promise<any>;
  const tp = (p: { x: number; z: number }, f: { x: number; z: number }) =>
    page.evaluate(([a, b]) => (window as any).__test.teleport(a.x, a.z, b.x, b.z), [p, f]);
  let shot = 0;
  const frames = async (name: string, times: number[]) => {
    let last = 0;
    for (const t of times) {
      await page.waitForTimeout(Math.max(0, t - last)); last = t;
      await page.screenshot({ path: `output/visual/farm/${String(++shot).padStart(2, '0')}-${name}-${t}.png` });
    }
  };
  const act = async (name: string, times: number[], settle = 600) => {
    await page.evaluate(() => (window as any).__test.interact());
    await frames(name, times);
    await page.waitForFunction(() => !(window as any).__test.farm('state').busy, null, { timeout: 8000 });
    await page.waitForTimeout(settle);
    await page.screenshot({ path: `output/visual/farm/${String(++shot).padStart(2, '0')}-${name}-after.png` });
    return farm('state');
  };

  await farm('stock');
  // 1) pick up the bucket at the standpipe
  await tp(W(-7.6, 5.4), W(-9.3, 6.6));
  await page.waitForTimeout(900);
  let s = await act('pickup', [250, 600, 950]);
  expect(s.held).toBe('bucket');
  // 2) fill it under the faucet
  s = await act('fill', [400, 1100, 1700, 2200]);
  expect(s.bucketWater).toBeGreaterThan(.95);
  // 3) sow the front-left bed (left hand; the bucket stays in the right)
  const bed = W(-6, 4);
  await tp(W(-6, 6.2), bed);
  await page.waitForTimeout(700);
  s = await act('sow', [300, 650, 1000, 1300]);
  expect(s.planted).toBe(1);
  // 4) water it
  await farm('thirsty');
  s = await act('water', [350, 800, 1200, 1600]);
  expect(s.bucketWater).toBeLessThan(.05);
  // 5) harvest (sets the bucket down, then pulls the plant)
  await farm('ripen');
  await page.waitForTimeout(300);
  s = await act('harvest', [500, 1300, 1900, 2500, 3200, 3700]);
  expect(s.held).toBe('plant');
  expect(s.heldPlant?.buds).toBeGreaterThan(0);
  // 6) the crate REFUSES a fresh plant: drying is mandatory
  await tp(W(6.8, 6.4), W(8.24, 6.84));        // the crate sits on the ground, yard side of the sale table
  await page.waitForTimeout(700);
  s = await act('crate-wet', []);
  expect(s.held).toBe('plant');
  expect(s.crate).toBe(0);
  // 7) hang it on the rack and let it dry for real (8 s), take it down, THEN the crate
  await tp(W(-2.5, -5.6), W(-2.5, -7.3)); await page.waitForTimeout(700);
  s = await act('hang', [500, 1000]);
  expect(s.hung).toBe(1);
  await page.waitForTimeout(8600);
  await page.screenshot({ path: `output/visual/farm/${String(++shot).padStart(2, '0')}-dried.png` });
  s = await act('takedry', [500]);
  expect(s.heldPlant?.cured).toBe(true);
  await tp(W(6.8, 6.4), W(8.24, 6.84)); await page.waitForTimeout(700);
  s = await act('crate', [400, 900, 1250]);
  expect(s.held).toBe('none');
  expect(s.crate).toBe(1);
  console.log('[farm] final', JSON.stringify(s));
});

// The side clips: hang a harvested plant on the drying rack, take it back cured and lay
// it in the crate; pull out a dead plant and toss it.
test('weed farm first-person rack + dead plant', async ({ game }) => {
  test.setTimeout(180_000);
  const page = game.page;
  const farm = (cmd: string) => page.evaluate((c) => (window as any).__test.farm(c), cmd) as Promise<any>;
  const tp = (p: { x: number; z: number }, f: { x: number; z: number }) =>
    page.evaluate(([a, b]) => (window as any).__test.teleport(a.x, a.z, b.x, b.z), [p, f]);
  let shot = 40;
  const act = async (name: string, times: number[]) => {
    await page.evaluate(() => (window as any).__test.interact());
    let last = 0;
    for (const t of times) {
      await page.waitForTimeout(Math.max(0, t - last)); last = t;
      await page.screenshot({ path: `output/visual/farm/${++shot}-${name}-${t}.png` });
    }
    await page.waitForFunction(() => !(window as any).__test.farm('state').busy, null, { timeout: 8000 });
    await page.waitForTimeout(500);
    return farm('state');
  };
  await farm('stock');
  // a plant that died: pull it out and toss it
  const bedA = W(0, 4), bedB = W(6, 4);
  await tp(W(6, 6.2), bedB); await page.waitForTimeout(600);
  await act('sowB', []);
  await farm('kill');
  let s = await act('clear', [700, 1300, 1700]);
  expect(s.planted).toBe(0);                       // the dead one is gone
  // a healthy one: sow, ripen, harvest, then hang it on the rack
  await tp(W(0, 6.2), bedA); await page.waitForTimeout(600);
  await act('sowA', []);
  await farm('ripen');
  s = await act('harvest2', []);
  expect(s.held).toBe('plant');
  await tp(W(-2.5, -5.6), W(-2.5, -7.3)); await page.waitForTimeout(700);
  s = await act('hang', [500, 1000, 1400]);
  expect(s.hung).toBe(1);
  await farm('cure');
  s = await act('takecured', [400, 900]);
  expect(s.held).toBe('plant');
  expect(s.heldPlant?.cured).toBe(true);
  await tp(W(6.8, 6.4), W(8.24, 6.84)); await page.waitForTimeout(700);
  s = await act('crate2', []);
  expect(s.crate).toBe(1);
  console.log('[farm rack] final', JSON.stringify(s));
});
