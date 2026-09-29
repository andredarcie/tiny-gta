// First-person + DOOM movement smoke test: on open terrain, run (Shift+W) and walk (W)
// in the real game and check the measured ground speed against DOOM's top speeds
// (run 16.67 map units/tic = 22.2 m/s, walk 8.33 u/tic = 11.1 m/s; see
// src/js/actors/doom-physics.ts). Real-time loop, so the tolerance is loose.
import { test, expect } from './support/game.ts';

const OPEN = { x: 196, z: 4 };   // off-road race start: open prairie, nothing to bump into

async function measureSpeed(game: any, keys: string[]): Promise<number> {
  await game.inPage((p: { x: number; z: number }) => (window as any).__test.teleport(p.x, p.z, p.x, p.z + 100), OPEN);
  for (const k of keys) await game.down(k);
  await game.page.waitForTimeout(1500);                  // reach top speed (~0.66 s to 90%)
  const a = await game.snapshot(); const t0 = Date.now();
  await game.page.waitForTimeout(1000);
  const b = await game.snapshot(); const t1 = Date.now();
  for (const k of keys.slice().reverse()) await game.up(k);
  await game.page.waitForTimeout(800);                   // glide to a stop
  return Math.hypot(b.player.x - a.player.x, b.player.z - a.player.z) / ((t1 - t0) / 1000);
}

test('first person on foot moves at DOOM speeds', async ({ game }) => {
  const errors: string[] = [];
  game.page.on('pageerror', (e: Error) => { if (!/Pointer Lock/i.test(e.message)) errors.push(e.message); });
  const s0 = await game.snapshot();
  expect(s0.firstPerson).toBe(true);
  expect(s0.mode).toBe('foot');

  const run = await measureSpeed(game, ['Shift', 'w']);
  const walk = await measureSpeed(game, ['w']);
  console.log(`[doom speed] run ${run.toFixed(1)} m/s (DOOM 22.2), walk ${walk.toFixed(1)} m/s (DOOM 11.1)`);
  expect(run).toBeGreaterThan(18);
  expect(run).toBeLessThan(26);
  expect(walk).toBeGreaterThan(9);
  expect(walk).toBeLessThan(13);
  expect(errors).toEqual([]);
});

// The first-person arms move with the player: while walking they sway (DOOM-style weapon
// bob), standing still they only breathe. Samples the arms' camera-space offset
// (__test.vmArms) over a second and compares how far they travel.
test('first-person arms sway while walking', async ({ game }) => {
  const page = game.page;
  await page.evaluate(() => (window as any).__test.teleport(196, 4, 196, 104)); // open prairie
  await page.waitForTimeout(1500);
  const travel = async (): Promise<number> => {
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < 20; i++) {
      const a = await page.evaluate(() => (window as any).__test.vmArms());
      xs.push(a.x); ys.push(a.y);
      await page.waitForTimeout(50);
    }
    return (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys));
  };
  const still = await travel();
  await game.down('w');
  await page.waitForTimeout(600);
  const walking = await travel();
  await game.up('w');
  console.log(`[fp arms] travel — still ${still.toFixed(3)}, walking ${walking.toFixed(3)}`);
  expect(walking).toBeGreaterThan(0.04);
  expect(walking).toBeGreaterThan(still * 3);
});

// Firing kicks the arms back with the gun's recoil (not just the weapon).
test('first-person arms recoil when firing', async ({ game }) => {
  const page = game.page;
  await page.evaluate(() => (window as any).__test.teleport(196, 4, 196, 104));
  await page.evaluate(() => (window as any).__test.giveGun());
  await page.waitForTimeout(1200);
  const rest = await page.evaluate(() => (window as any).__test.vmArms().z);
  await page.evaluate(() => (window as any).__test.attack());
  await page.waitForTimeout(40);
  const kicked = await page.evaluate(() => (window as any).__test.vmArms().z);
  console.log(`[fp arms] z rest ${rest.toFixed(3)}, after shot ${kicked.toFixed(3)}`);
  expect(kicked - rest).toBeGreaterThan(0.015);  // pushed back toward the viewer (+z)
});
