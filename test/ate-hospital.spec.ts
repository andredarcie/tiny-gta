// From the E.E. Vicente Nasser up to the Hospital Regional's door, for real (HEADED, for the
// human to watch): an autopilot drives the player's car with the real key input along the
// street graph's path — up the upper Rua Leonor Mendes de Barros, past the gatehouse and
// round the entrance road to the porch — checking every sample that the car sits on its
// wheels and gets through, logging the street names the HUD shows on the way and a
// screenshot every few seconds to output/visual/ate-hospital/. At the porch the player
// gets out and walks in through the glass doors: the hospital's room must open.
import { test, expect } from './support/game.ts';

const START: [number, number] = [4980.5, 5341.8];            // the school's corner (world)
const PORCH: [number, number] = [4650.6, 5665.3];            // HOSP_SPAWN_OUT, before the steps
const DOOR: [number, number] = [4652.8, 5670.1];             // HOSP_DOOR

test('drive from the Nasser school to the hospital door and walk in', async ({ game }) => {
  test.setTimeout(300_000);
  const page = game.page;
  const errs: string[] = [];
  page.on('pageerror', e => { if (!/Pointer Lock/i.test(e.message)) errs.push(e.message); });
  const route: [number, number][] = await page.evaluate(async ([a, b]) => {
    const nav = await import('/src/js/world/divinolandia/nav.ts' as any);
    const pts: [number, number][] = nav.pathPoints(nav.findPath(nav.nearestNode(...a), nav.nearestNode(...b)));
    const out: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3));
      for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
    }
    // the graph stops at the service road's nearest node: the last stretch goes straight on
    // over the drive to the porch
    const [lx, lz] = pts[pts.length - 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - lx, b[1] - lz) / 3));
    for (let k = 0; k <= n; k++) out.push([lx + (b[0] - lx) * k / n, lz + (b[1] - lz) * k / n]);
    return out;
  }, [START, PORCH]);
  const end = route[route.length - 1];
  console.log(`[ate-hospital] route ${route.length} points, ends ${Math.hypot(end[0] - PORCH[0], end[1] - PORCH[1]).toFixed(1)} m from the porch`);
  expect(route.length).toBeGreaterThan(50);

  await game.inPage(() => (window as any).__test.enterPrimaryCar());
  await game.waitForState((st: any) => st.mode === 'car' && !!st.vehicle, { timeout: 15_000 });
  await game.inPage((r: number[][]) => (window as any).__test.placeVehicle(r[0][0], r[0][1], r[3][0], r[3][1]), route);
  await page.waitForTimeout(600);

  const keys = { w: false, s: false, a: false, d: false };
  const CODE = { w: 'KeyW', s: 'KeyS', a: 'KeyA', d: 'KeyD' } as const;
  const press = async (k: 'w' | 's' | 'a' | 'd', on: boolean) => {
    if (keys[k] === on) return; keys[k] = on;
    await game.inPage(([c, d]: [string, boolean]) => (window as any).__test.setKey(c, d), [CODE[k], on]);
  };
  const places: string[] = [];
  let idx = 0, maxSink = 0, exploded = false, shot = 0, lastShot = 0, stuckSince = 0, lastIdx = 0, crashes = 0;
  const t0 = Date.now();
  while (idx < route.length - 2 && Date.now() - t0 < 200_000) {
    const s = await game.snapshot();
    if (s.mode !== 'car' || !s.vehicle) { exploded = true; break; }
    const v = s.vehicle;
    maxSink = Math.max(maxSink, v.sink); crashes = v.crashes;
    const place = await page.evaluate(() => document.getElementById('location')?.textContent ?? '');
    if (place && places[places.length - 1] !== place) places.push(place);
    if (Date.now() - lastShot > 5000) {
      lastShot = Date.now();
      await page.screenshot({ path: `output/visual/ate-hospital/${String(shot++).padStart(2, '0')}.png` });
    }
    while (idx < route.length - 1 && Math.hypot(route[idx][0] - v.x, route[idx][1] - v.z) < 6) idx++;
    if (idx !== lastIdx) { lastIdx = idx; stuckSince = Date.now(); }
    else if (Date.now() - stuckSince > 15_000) break;                // no progress: blocked
    // keep to the right of the street (traffic drives its centre line), straight in at the end
    const ia = Math.min(route.length - 1, idx + 1), ib = Math.min(route.length - 1, ia + 1);
    let [tx, tz] = route[ia];
    if (route.length - idx > 10 && ib > ia) {
      const ux = route[ib][0] - route[ia][0], uz = route[ib][1] - route[ia][1], L = Math.hypot(ux, uz) || 1;
      tx += -uz / L * 1.6; tz += ux / L * 1.6;
    }
    let diff = Math.atan2(tx - v.x, tz - v.z) - v.heading;
    while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
    await press('a', diff > .06); await press('d', diff < -.06);
    const [fx2, fz2] = route[Math.min(route.length - 1, idx + 5)];
    let turn = Math.atan2(fx2 - tx, fz2 - tz) - Math.atan2(tx - v.x, tz - v.z);
    while (turn > Math.PI) turn -= 2 * Math.PI; while (turn < -Math.PI) turn += 2 * Math.PI;
    const sharp = Math.max(Math.abs(diff), Math.abs(turn));
    const near = route.length - idx < 8;
    let want = near ? 4 : sharp > .6 ? 6 : sharp > .3 ? 10 : 14;
    // keep a gap behind a traffic car going the same way (bumping one makes it brake, and
    // pushing on keeps it braked)
    const gap: number = await page.evaluate(async ([x, z, h]) => {
      const { traffic } = await import('/src/js/world/traffic.ts' as any);
      let g = 99;
      for (const t of traffic) {
        const rx = t.g.position.x - x, rz = t.g.position.z - z, f = rx * Math.sin(h) + rz * Math.cos(h);
        if (Math.cos(t.heading - h) < .3) continue;                  // oncoming: passes on its side
        if (f > 0 && Math.abs(rx * Math.cos(h) - rz * Math.sin(h)) < 2.5) g = Math.min(g, f);
      }
      return g;
    }, [v.x, v.z, v.heading]);
    if (gap < 12) want = Math.min(want, Math.max(0, (gap - 7) * 1.5));
    await press('w', v.speed < want); await press('s', v.speed > want + 3);
  }
  for (const k of ['w', 'a', 'd'] as const) await press(k, false);
  await page.waitForTimeout(2000);                                    // coast to a stop (S would reverse)
  const s1 = await game.snapshot();
  const left = Math.hypot(s1.vehicle.x - PORCH[0], s1.vehicle.z - PORCH[1]);
  console.log(`[ate-hospital] route ${idx}/${route.length}, ${((Date.now() - t0) / 1000).toFixed(0)} s, max sink ${maxSink.toFixed(3)} m, ` +
    `crashes ${crashes}, exploded ${exploded}, car stops ${left.toFixed(1)} m from the porch`);
  console.log(`[ate-hospital] streets on the way: ${places.join(' → ')}`);
  await page.screenshot({ path: `output/visual/ate-hospital/${String(shot++).padStart(2, '0')}-chegada.png` });

  // out of the car and on foot up the steps through the glass doors
  await game.inPage(() => (window as any).__test.exitCar());
  await game.waitForState((st: any) => st.mode === 'foot', { timeout: 10_000 });
  const s2 = await game.snapshot(), p = s2.player;
  await game.inPage(([x, z, fx, fz]: number[]) => (window as any).__test.teleport(x, z, fx, fz), [p.x, p.z, DOOR[0], DOOR[1]]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `output/visual/ate-hospital/${String(shot++).padStart(2, '0')}-porta.png` });
  let inside: string | null = null;
  const t1 = Date.now();
  while (Date.now() - t1 < 25_000) {
    const s = await game.snapshot();
    if (s.interior) { inside = s.interior; break; }
    const pl = s.player;
    let diff = Math.atan2(DOOR[0] - pl.x, DOOR[1] - pl.z) - (pl.heading ?? 0);
    while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
    // aim by teleporting in place (the on-foot steering is camera-relative), then walk
    if (Math.abs(diff) > .3) await game.inPage(([x, z, fx, fz]: number[]) => (window as any).__test.teleport(x, z, fx, fz), [pl.x, pl.z, DOOR[0], DOOR[1]]);
    await press('w', true);
    await page.waitForTimeout(120);
  }
  await press('w', false);
  const pe = (await game.snapshot()).player;
  console.log(`[ate-hospital] on foot: inside ${inside}, player ${Math.hypot(pe.x - DOOR[0], pe.z - DOOR[1]).toFixed(1)} m from the door`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `output/visual/ate-hospital/${String(shot).padStart(2, '0')}-dentro.png` });

  expect(exploded).toBe(false);
  expect(maxSink).toBeLessThan(.03);
  expect(left).toBeLessThan(15);
  expect(places.join('|')).not.toContain('#');
  expect(inside).toBe('HospitalInterior');
  expect(errs).toEqual([]);
});
