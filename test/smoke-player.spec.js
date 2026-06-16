// Smoke test for the skinned player: boots the REAL game (on our dedicated port
// 5273), walks for ~1s so animatePed rotates the player's bones, and asserts no
// runtime error and the player is still on foot. Proves the SkinnedMesh deforms
// in-game without breaking.
import {test, expect} from '@playwright/test';

test('skinned player boots and walks without errors', async ({page}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5273/', {waitUntil: 'load'});
  await page.waitForSelector('#play', {timeout: 30_000});
  await page.evaluate(() => document.getElementById('play').click());
  await page.waitForSelector('#nick-input', {state: 'visible', timeout: 10_000});
  await page.evaluate(() => { document.getElementById('nick-input').value = 'SMOKE'; });
  await page.evaluate(() => document.getElementById('nick-play').click());
  await page.waitForFunction(
    () => !!window.render_game_to_text && JSON.parse(window.render_game_to_text()).started === true,
    null, {timeout: 20_000});
  await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
  await page.locator('#game').click({position: {x: 8, y: 8}, force: true}).catch(() => {});
  // walk for ~1.2s — drives animatePed on the player's bones
  await page.keyboard.down('w');
  await page.waitForTimeout(1200);
  await page.keyboard.up('w');
  const snap = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(errors, 'no runtime errors while walking: ' + errors.join(' | ')).toEqual([]);
  expect(snap.mode).toBe('foot');
});
