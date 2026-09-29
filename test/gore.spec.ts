// Gore layer check: in the real game, dismember the nearest NPCs (head, arm, leg, and a
// whole-body blow-apart) through the __test.gore hook, and assert that only the head and a
// full blow-apart kill outright (a lost arm or leg maims and bleeds out), with no errors.
// Screenshots go to output/visual/gore-*.png for a visual look. Headed, like every game run.
import {test, expect} from '@playwright/test';

test('any NPC can be dismembered, with blood, without errors', async ({page}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => { if (!/Pointer Lock/i.test(e.message)) errors.push(e.message); });
  await page.goto('/?tod=0.5', {waitUntil: 'load'});
  await page.waitForFunction(() => !!(window as any).render_game_to_text
    && JSON.parse((window as any).render_game_to_text()).started === true, null, {timeout: 60_000});
  await page.waitForTimeout(2000);

  for (const kind of ['head', 'arm', 'leg', 'gib']) {
    let r: any = null;
    for (let tries = 0; tries < 20 && !r; tries++) {
      r = await page.evaluate((k) => (window as any).__test.gore(k), kind);
      if (!r) await page.waitForTimeout(500); // wait for someone to walk into range
    }
    expect(r, `an NPC in range for ${kind}`).not.toBeNull();
    if (kind === 'head' || kind === 'gib') expect(r.dead, `${kind} is fatal`).toBe(true);
    else expect(r.dead, `${kind} only maims`).toBe(false);
    await page.waitForTimeout(900);
    await page.screenshot({path: `output/visual/gore-${kind}.png`});
  }
  await page.waitForTimeout(2500); // let pools spread and gibs land
  await page.screenshot({path: 'output/visual/gore-aftermath.png'});
  expect(errors).toEqual([]);
});
