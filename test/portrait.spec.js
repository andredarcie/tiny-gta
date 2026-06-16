// Renders the new Schedule I-style player ped beside real Schedule I reference
// screenshots and saves the comparison to test/out/compare.png (read by the dev
// to judge the match). Not a gameplay test — uses the raw page, not the game.
import {test} from '@playwright/test';

test('player toon vs Schedule I', async ({page}) => {
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto('/portrait.html', {waitUntil: 'load'});
  await page.waitForFunction(() => window.__ready === true, null, {timeout: 30_000});
  await page.waitForTimeout(200);
  await page.locator('#cmp').screenshot({path: 'test/out/compare.png'});
});
