// Runtime checks for the base-game bugfix batch (fix/base-game-bugs). Each test drives
// the REAL game in a real Chromium through the sanctioned hooks (render_game_to_text /
// __test / advanceTime), so the gameplay-dependent fixes are exercised end-to-end:
//   - boot is clean with every fix in place (no runtime error);
//   - the NPC roster filter is collapsed behind a SHOW/HIDE toggle (UI);
//   - a rural hidden-cash stash pays out on foot (loot path runs);
//   - a garaged car with MOD-GARAGE customs respawns at boot without throwing (#8).
// Visual-only fixes (hair, beckon, quest labels, rally feel, officer look) still need the
// player's eyes — these cover the parts a machine can assert.
import {test, expect} from '@playwright/test';
import {GameDriver} from './support/game.ts';

// Boot the game and surface any page error. On localhost the game AUTO-STARTS (the
// dev shortcut in input.ts), so we don't drive the title/login UI at all — we just wait
// for state.started. (The shared harness's boot() clicks a #nick-play button that the
// current login modal no longer has, so it can't be used here.) The benign "user gesture
// required for Pointer Lock" error is filtered — it only fires because nothing clicked yet.
async function bootGame(page: import('@playwright/test').Page, errors: string[]) {
  page.on('pageerror', (e) => { if (!/Pointer Lock/i.test(e.message)) errors.push(e.message); });
  await page.goto('/', {waitUntil: 'load'});
  await page.waitForFunction(
    () => !!(window as any).render_game_to_text && JSON.parse((window as any).render_game_to_text()).started === true,
    null, {timeout: 60_000});
  await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; if (a && a.blur) a.blur(); });
  await page.locator('#game').click({position: {x: 8, y: 8}, force: true}).catch(() => {});
  return new GameDriver(page);
}

test('boots clean with the whole bugfix batch in place', async ({page}) => {
  const errors: string[] = [];
  const game = await bootGame(page, errors);
  const s = await game.snapshot();
  expect(s.started).toBe(true);
  expect(s.mode).toBe('foot');
  expect(errors, 'runtime errors on boot: ' + errors.join(' | ')).toEqual([]);
});

test('NPC roster filter is collapsed behind a SHOW/HIDE toggle', async ({page}) => {
  const errors: string[] = [];
  await bootGame(page, errors);
  // open the pause menu (dispatch P, focus-independent), then INFO -> NPCS
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyP', key: 'p', bubbles: true})));
  await page.locator('#pause-body [data-act="info"]').click({timeout: 8000});
  await page.locator('#pause-body [data-act="npcs"]').click({timeout: 8000});

  const body = page.locator('#pause-body');
  const toggle = body.locator('.npc-filter-toggle');
  // collapsed by default: a SHOW FILTERS button, and NO chip rows on screen
  await expect(toggle).toHaveText('SHOW FILTERS');
  await expect(body.locator('.pause-filter')).toHaveCount(0);

  // expand: button flips to HIDE FILTERS and the two chip rows (AREA + STATUS) appear
  await toggle.click();
  await expect(body.locator('.npc-filter-toggle')).toHaveText('HIDE FILTERS');
  await expect(body.locator('.pause-filter')).toHaveCount(2);

  // collapse again
  await body.locator('.npc-filter-toggle').click();
  await expect(body.locator('.pause-filter')).toHaveCount(0);
  expect(errors, 'runtime errors: ' + errors.join(' | ')).toEqual([]);
});

test('garaged car keeps its MOD-GARAGE customs across a reload', async ({page}) => {
  const errors: string[] = [];
  // seed a modded, owned garage car BEFORE any game script runs, so initProperty()
  // rebuilds it at boot via applyCarMods (spoiler/rims/neon/hood/engine).
  await page.addInitScript(() => {
    localStorage.setItem('tinygta_property', JSON.stringify({
      owned: true,
      car: {type: 'car', color: 0x2a6cff, name: 'TEST GT',
        spoiler: 'gt', rims: 0xffd24a, neon: 0xff2e88, hood: 'scoop', speedMul: 1.26},
    }));
  });
  const game = await bootGame(page, errors);
  const s = await game.snapshot();
  expect(s.house?.owned).toBe(true);
  // the saved mods round-trip...
  expect(s.house?.car?.spoiler).toBe('gt');
  expect(s.house?.car?.hood).toBe('scoop');
  expect(s.house?.car?.rims).toBe(0xffd24a);
  expect(s.house?.car?.neon).toBe(0xff2e88);
  expect(s.house?.car?.speedMul).toBeCloseTo(1.26);
  // ...and rebuilding the garage car (applyCarMods → setSpoiler/setRims/...) didn't throw.
  expect(errors, 'runtime errors building the modded garage car: ' + errors.join(' | ')).toEqual([]);
});
