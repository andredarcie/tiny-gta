// Driving Divinolândia's hills for real: an autopilot takes the player's car along a long
// street route (the hospital hill down to the river and back up), steering with the real
// keyboard input at town speeds, and every frame it checks that the car sits on its wheels
// — never below its resting height on the ground (`sink`, from the ray-cast vehicle model,
// src/js/actors/vehicle-ground.ts) — and that it gets through without exploding.
//   npx playwright test test/hill-drive.spec.ts
import { test, expect } from './support/game.ts';

test('the car drives the hills without sinking into them or blowing up', async ({ game }) => {
  test.setTimeout(240_000);
  const page = game.page;
  // the route, from the street graph (a pure module: importing it in the page is fine)
  const route: [number, number][] = await page.evaluate(async () => {
    const nav = await import('/src/js/world/divinolandia/nav.ts' as any);
    const W = (x: number, z: number) => [x + 5000, z + 5000];
    const a = nav.nearestNode(...W(-330, 600)), b = nav.nearestNode(...W(560, -330)), c = nav.nearestNode(...W(0, 40));
    const pts = [...nav.pathPoints(nav.findPath(a, b)), ...nav.pathPoints(nav.findPath(b, c)).slice(1)];
    // densify to ~3 m so the pursuit point moves smoothly
    const out: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3));
      for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
    }
    return out;
  });
  expect(route.length).toBeGreaterThan(100);
  // get into a car (whichever is nearest — the hero car or the plaza's taxi) and put it at the start
  await game.inPage(() => (window as any).__test.enterPrimaryCar());
  await game.waitForState((st: any) => st.mode === 'car' && !!st.vehicle, { timeout: 15_000 });
  await game.inPage((r: number[][]) => (window as any).__test.placeVehicle(r[0][0], r[0][1], r[3][0], r[3][1]), route);
  await page.waitForTimeout(400);

  let idx = 0, maxSink = 0, airFrames = 0, frames = 0, exploded = false, lastCrashes = 0;
  const t0 = Date.now();
  const keys = { w: false, s: false, a: false, d: false };
  // the game's key state directly (__test.setKey: the same path a real keydown takes, but
  // independent of which window has the OS focus)
  const CODE = { w: 'KeyW', s: 'KeyS', a: 'KeyA', d: 'KeyD' } as const;
  const press = async (k: 'w' | 's' | 'a' | 'd', on: boolean) => {
    if (keys[k] === on) return; keys[k] = on;
    await game.inPage(([c, d]: [string, boolean]) => (window as any).__test.setKey(c, d), [CODE[k], on]);
  };
  while (idx < route.length - 8 && Date.now() - t0 < 200_000) {
    const s = await game.snapshot();
    if (s.mode !== 'car' || !s.vehicle) { exploded = true; break; }
    const v = s.vehicle;
    frames++;
    maxSink = Math.max(maxSink, v.sink);
    if (v.air > 0) airFrames++;
    lastCrashes = v.crashes;
    if (frames % 300 === 0) console.log(`[hill drive] t=${((Date.now() - t0) / 1000).toFixed(0)}s at (${(v.x - 5000).toFixed(0)},${(v.z - 5000).toFixed(0)}) speed ${v.speed.toFixed(1)} route ${idx} crashes ${v.crashes} sink ${v.sink.toFixed(3)}`);
    // advance along the route past the car, then aim 10 m ahead (pure pursuit)
    while (idx < route.length - 1 && Math.hypot(route[idx][0] - v.x, route[idx][1] - v.z) < 7) idx++;
    const [tx, tz] = route[Math.min(route.length - 1, idx + 1)];
    let diff = Math.atan2(tx - v.x, tz - v.z) - v.heading;
    while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
    await press('a', diff > .06); await press('d', diff < -.06);           // yaw grows to the LEFT
    // town speeds, slower into the bends coming up (look at the turn over the next ~15 m)
    const [fx2, fz2] = route[Math.min(route.length - 1, idx + 5)];
    let turn = Math.atan2(fx2 - tx, fz2 - tz) - Math.atan2(tx - v.x, tz - v.z);
    while (turn > Math.PI) turn -= 2 * Math.PI; while (turn < -Math.PI) turn += 2 * Math.PI;
    const sharp = Math.max(Math.abs(diff), Math.abs(turn));
    const want = sharp > .6 ? 6 : sharp > .3 ? 10 : 16;
    await press('w', v.speed < want); await press('s', v.speed > want + 4);
  }
  for (const k of ['w', 's', 'a', 'd'] as const) await press(k, false);
  console.log(`[hill drive] ${frames} samples, route ${idx}/${route.length}, max sink ${maxSink.toFixed(3)} m, ` +
    `airborne samples ${airFrames}, crashes ${lastCrashes}, exploded ${exploded}`);
  expect(exploded).toBe(false);
  expect(maxSink).toBeLessThan(.03);                  // never inside the ground (a few cm of sampling slack)
  expect(idx).toBeGreaterThan(route.length * .6);     // and it really drove the route
});
