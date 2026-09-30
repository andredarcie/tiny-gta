// The story's pay-phone mission chain, played on the real game (headed):
//   1) the phone rings at the booth by the start — walk up, answer it (first-person pick-up,
//      then the cinematic call), 2) the redneck camp appears in the countryside — wipe it
//      out, 3) back to the booth for the second call (mission 1 done), 4) take the shovel
//      and bury three bodies in first person, then the time skip, 5) the third call (mission 2 done).
// Frames of every beat are saved to output/visual/story/ for review.
//   npx playwright test test/story.spec.ts
import { test, expect } from './support/game.ts';

test('story: pay phone → camp → second call → burial → third call', async ({ game }) => {
  test.setTimeout(300_000);
  const page = game.page;
  const story = (cmd: string) => page.evaluate((c) => (window as any).__test.story(c), cmd) as Promise<any>;
  const tp = (x: number, z: number, fx: number, fz: number) =>
    page.evaluate(([a, b, c, d]) => (window as any).__test.teleport(a, b, c, d), [x, z, fx, fz]);
  let shot = 0;
  const snap = (name: string) => page.screenshot({ path: `output/visual/story/${String(++shot).padStart(2, '0')}-${name}.png` });
  const interact = () => page.evaluate(() => (window as any).__test.interact());
  const waitIdle = () => page.waitForFunction(() => { const s = (window as any).__test.story('state'); return !s.busy && !s.cine && !s.burial.busy; }, null, { timeout: 20_000 });

  // A fresh run starts at the first call, with the booth as the big objective.
  let s = await story('state');
  expect(s.stage).toBe('call1');
  expect(s.ringing).toBe(true);
  const snapBlips = (await game.snapshot()).storyBlips;
  expect(snapBlips[0]).toMatchObject({ icon: 'phone', big: true });

  // 1) answer the phone
  await story('toBooth');
  await page.waitForTimeout(1500);
  await snap('booth-ringing');
  await interact();
  await page.waitForTimeout(700); await snap('fp-pickup');
  await page.waitForFunction(() => (window as any).__test.story('state').cine, null, { timeout: 5000 });
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(1600); await snap(`call1-shot${i}`);
    await page.keyboard.press('Space'); await page.keyboard.press('Space');
  }
  await story('skipCine');
  await page.waitForTimeout(500); await snap('fp-hangup');
  await waitIdle();
  s = await story('state');
  expect(s.stage).toBe('camp');
  expect(s.camp.alive).toBe(6);

  // 2) the camp: take a look, then clear it
  await story('toCamp');
  await page.waitForTimeout(2000); await snap('camp');
  await story('killCamp');
  await page.waitForFunction(() => (window as any).__test.story('state').stage === 'call2', null, { timeout: 5000 });
  await page.waitForTimeout(2500); await snap('camp-cleared');

  // 3) the second call
  await story('toBooth');
  await page.waitForTimeout(1200);
  await interact();
  await page.waitForFunction(() => (window as any).__test.story('state').cine, null, { timeout: 5000 });
  await page.waitForTimeout(1500); await snap('call2');
  await story('skipCine');
  await waitIdle();
  await page.waitForTimeout(800); await snap('mission-passed');
  s = await story('state');
  expect(s.stage).toBe('burial');
  expect(s.burial.left).toBe(6);

  // 4) the burial: take the shovel (it stays wherever it is left — after each grave it is
  //    stuck in the ground beside it), bury three bodies by hand, then the time skip
  const takeShovel = async (name: string) => {
    const sh = (await story('state')).burial.shovel;
    await tp(sh.x - 1.6, sh.z - 1.2, sh.x, sh.z);
    await page.waitForTimeout(600);
    await interact(); await page.waitForTimeout(600); await snap(name);
    await waitIdle();
    expect((await story('state')).burial.holding).toBe(true);
  };
  for (let n = 0; n < 3; n++) {
    await takeShovel(`take-shovel-${n}`);
    s = await story('state');
    const b = s.burial.bodies[0];
    await tp(b.x - 1.2, b.z - 1.2, b.x, b.z);
    await page.waitForTimeout(500);
    await interact();
    if (n === 0) {                     // film the first burial: dig, drag, fill, pat, plant
      let last = 0;
      for (const t of [900, 1800, 3000, 4200, 5600, 7000, 8000]) {
        await page.waitForTimeout(t - last); last = t;
        await snap(`bury-${t}`);
      }
    }
    if (n < 2) {
      await waitIdle();
      s = await story('state');
      expect(s.burial.buried).toBe(n + 1);
      expect(s.burial.holding).toBe(false);        // planted beside the grave
    }
  }
  // the time skip: fade to black, all six buried, the player's monologue
  await page.waitForFunction(() => (window as any).__test.story('state').cine, null, { timeout: 15_000 });
  await page.waitForTimeout(1500); await snap('time-skip-monologue');
  await story('skipCine');
  await page.waitForFunction(() => (window as any).__test.story('state').stage === 'call3', null, { timeout: 5000 });
  s = await story('state');
  expect(s.burial.graves).toBe(6);

  // 5) the third call: report back to the boss
  await story('toBooth');
  await page.waitForTimeout(1200);
  await interact();
  await page.waitForFunction(() => (window as any).__test.story('state').cine, null, { timeout: 5000 });
  await page.waitForTimeout(1500); await snap('call3');
  await story('skipCine');
  await waitIdle();
  await page.waitForTimeout(800); await snap('mission2-passed');
  s = await story('state');
  expect(s.stage).toBe('done');
});
