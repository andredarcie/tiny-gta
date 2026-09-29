// VIDEO: the hands-on weed farm, start to finish, cut down to the key actions.
//   npm run video -- weed-farm
import { test } from '@playwright/test';
import { Director } from '../director.ts';

const CX = 620, CZ = -90;                         // compound centre (assets/models/rural/weed-farm.ts)
const W = (x: number, z: number) => ({ x: CX + x, z: CZ + z });

test('video: weed farm', async ({ page }) => {
  const d = await Director.start(page, 'weed-farm', {
    title: 'GROW YOUR OWN',
    subtitle: 'The weed farm - now hands-on',
    outro: 'GROW IT. SELL IT.',
    tod: .42,
  });
  await d.farm('stock');

  // arrive at the hidden gate
  await d.teleport(W(0, 13), W(0, 0));
  await d.wait(800);
  await d.clip('arrive', 'A hidden grow-op', async () => { await d.walkTo(W(0, 8.4)); }, 200);

  // bucket: grab it and fill it at the tap
  await d.walkTo(W(-7.4, 5.5), .35);
  await d.turnTo(W(-9.3, 6.6), 300);
  await d.clip('bucket', 'Grab the bucket', async () => { await d.farmAct(); }, 100);
  await d.clip('fill', 'Fill it at the tap', async () => { await d.farmAct(); }, 150);

  // sow + water the front-left bed
  await d.walkTo(W(-6, 6.4), .3);
  await d.turnTo(W(-6, 4), 300);
  await d.clip('sow', 'Sow the seeds by hand', async () => { await d.farmAct(); }, 100);
  await d.clip('water', 'Water it', async () => { await d.farmAct(); }, 150);

  // timelapse
  await d.clip('grow', 'Watch it grow', async () => {
    for (let i = 0; i < 12; i++) { await d.farm('grow:3.2'); await d.wait(120); }
    await d.wait(300);
    d.cover();                                  // the ripe plant glowing, bucket in hand: the cover
    await d.wait(200);
  }, 100);

  // harvest
  await d.clip('harvest', 'Pull it out, roots and all', async () => { await d.farmAct(); }, 250);

  // dry it on the rack (mandatory) — hang it, it dries and turns golden-brown, take it down
  await d.walkTo(W(-2.5, -5.4), .35);
  await d.turnTo(W(-2.5, -7.3), 300);
  await d.clip('hang', 'Hang it to dry', async () => { await d.farmAct(); }, 150);
  await d.clip('dry', 'Dried and ready', async () => {
    await page.waitForFunction(() => (window as any).__test.farm('state').hung > 0, null, { timeout: 5000 });
    await d.farm('cure');
    await d.wait(700);
    await d.farmAct();
  }, 150);

  // stash it in the crate, then take the stash on a delivery run
  await d.walkTo(W(6.6, 6.3), .35);
  await d.turnTo(W(8.24, 6.84), 300);
  await d.clip('stash', 'One plant at a time', async () => { await d.farmAct(); }, 200);
  await d.clip('deliver', 'Then sell it', async () => { await d.interact(); await d.wait(1400); }, 100);

  await d.finish();
});
