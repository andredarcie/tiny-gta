// PROMO CAPTURE — films the first-person weed farm loop start to finish for a feature
// video: arrive at the hidden compound, grab + fill the bucket, sow, water, a growth
// timelapse, harvest by hand, lay the plant in the crate and take the stash out for a
// delivery run. Frames come from Chrome's screencast (high-quality JPEGs with
// timestamps) into output/promo/frames/, and the phase timings into
// output/promo/timeline.json; `node test/promo/make-video.mjs` then assembles the MP4.
// Not a regression test — run it on purpose (headed, like every game run):
//   npx playwright test test/promo-weed-farm.spec.ts
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const CX = 620, CZ = -90;                               // compound centre
const W = (x: number, z: number) => ({ x: CX + x, z: CZ + z });
const OUT = 'output/promo';

test('promo: weed farm first-person loop', async ({ page }) => {
  test.setTimeout(240_000);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

  // clean HUD for the video: no FPS counter
  await page.addInitScript(() => {
    try { localStorage.setItem('tinygta_settings', JSON.stringify({ fps: false })); } catch { /* ignore */ }
  });
  await page.goto('/?tod=0.42', { waitUntil: 'load' });
  await page.waitForFunction(() => !!(window as any).render_game_to_text
    && JSON.parse((window as any).render_game_to_text()).started === true, null, { timeout: 60_000 });

  const T = () => (window as any).__test;
  const ev = <R>(fn: (...a: any[]) => R, ...args: any[]) => page.evaluate(fn as any, ...args) as Promise<R>;
  const farm = (cmd: string) => ev((c: string) => (window as any).__test.farm(c), cmd) as Promise<any>;
  const snap = async () => JSON.parse(await ev(() => (window as any).render_game_to_text()));
  const pos = async () => { const s = await snap(); return { x: s.player.x, z: s.player.z }; };
  const tp = (p: { x: number; z: number }, f: { x: number; z: number }) =>
    ev(([a, b]: any) => (window as any).__test.teleport(a.x, a.z, b.x, b.z), [p, f]);
  // smooth pan: re-aim the view in small steps (the teleport keeps the position)
  const turnTo = async (f: { x: number; z: number }, ms = 700) => {
    const p = await pos(); const s = await snap();
    const y0 = s.player.heading ?? 0, y1 = Math.atan2(f.x - p.x, f.z - p.z);
    let d = y1 - y0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const n = Math.max(1, Math.round(ms / 33));
    for (let i = 1; i <= n; i++) {
      const k = i / n, e = k * k * (3 - 2 * k), y = y0 + d * e;
      await tp(p, { x: p.x + Math.sin(y), z: p.z + Math.cos(y) });
      await page.waitForTimeout(33);
    }
  };
  // walk (real movement input) toward `to`: let go of W early (DOOM speed + friction
  // glide), stop if we start moving away, then a tiny invisible nudge onto the mark
  const walkTo = async (to: { x: number; z: number }, stop = .3) => {
    await turnTo(to, 450);
    await ev(() => (window as any).__test.setKey('KeyW', true));
    let last = 1e9;
    for (let i = 0; i < 200; i++) {
      const p = await pos();
      const d = Math.hypot(p.x - to.x, p.z - to.z);
      if (d < stop + 1.1 || d > last + .02) break;
      last = d;
      await page.waitForTimeout(10);
    }
    await ev(() => (window as any).__test.setKey('KeyW', false));
    await page.waitForTimeout(450);                        // friction glide
    const p = await pos(), s = await snap();
    if (Math.hypot(p.x - to.x, p.z - to.z) > stop) {
      const h = s.player.heading ?? 0;
      await tp(to, { x: to.x + Math.sin(h), z: to.z + Math.cos(h) });
    }
  };
  const act = async () => {
    await ev(() => (window as any).__test.interact());
    await page.waitForFunction(() => !(window as any).__test.farm('state').busy, null, { timeout: 10_000 });
  };

  await farm('stock');
  await tp(W(0, 15), W(0, 0));                            // outside the gate, looking in
  await page.waitForTimeout(2500);                        // let the world settle before filming

  // ---- start filming ----
  const cdp = await page.context().newCDPSession(page);
  const frames: { file: string; t: number }[] = [];
  let n = 0;
  cdp.on('Page.screencastFrame', async (f: any) => {
    const file = `f${String(n++).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(OUT, 'frames', file), Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
  const t0 = Date.now();
  const marks: { label: string; at: number }[] = [];
  const mark = (label: string) => marks.push({ label, at: (Date.now() - t0) / 1000 });

  mark('intro');
  await page.waitForTimeout(1200);
  await walkTo(W(0, 8.2));                                 // through the gate into the yard
  mark('bucket');
  await walkTo(W(-7.4, 5.5), .35);                         // to the standpipe
  await turnTo(W(-9.3, 6.6), 400);
  await act();                                             // pick up the bucket
  mark('fill');
  await act();                                             // fill it at the faucet
  await page.waitForTimeout(500);
  mark('sow');
  await walkTo(W(-6, 6.4), .3);                            // to the front-left bed
  await turnTo(W(-6, 4), 400);
  await act();                                             // sow (left hand; bucket in the right)
  mark('water');
  await act();                                             // pour the bucket over the bed
  await page.waitForTimeout(400);
  mark('grow');
  await turnTo(W(-6, 4), 300);
  for (let i = 0; i < 16; i++) { await farm('grow:2.4'); await page.waitForTimeout(170); }
  await page.waitForTimeout(900);                          // the ripe cola glistens
  mark('harvest');
  await act();                                             // bucket down + pull the plant
  await page.waitForTimeout(600);
  mark('stash');
  await walkTo(W(6.6, 6.3), .35);                          // carry it across the yard to the crate
  await turnTo(W(8.24, 6.84), 400);
  await act();                                             // lay it in the crate
  await page.waitForTimeout(700);
  mark('deliver');
  await act();                                             // take the stash: DELIVERY RUN
  await page.waitForTimeout(2600);
  mark('end');

  await cdp.send('Page.stopScreencast');
  await page.waitForTimeout(300);
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ frames, marks, wallStart: t0 }, null, 1));
  console.log(`[promo] ${frames.length} frames, ${((Date.now() - t0) / 1000).toFixed(1)} s, marks ${JSON.stringify(marks)}`);
  console.log('[promo] final', JSON.stringify(await farm('state')));
});
