// Boot timeline: loads the real game and prints how long each boot stage takes, from the
// performance marks set in boot.ts / main.ts / warmup.ts (tg:*), plus when the game reports
// `started`. The warmup (tg:warm-*) runs in the background after the game is already up.
// Asserts only that it booted. Headed, like every game run:
//   npx playwright test test/boot-time.spec.ts
import {test} from '@playwright/test';

test('boot timeline', async ({page}) => {
  test.setTimeout(120_000);
  // Optional graphics settings, e.g. BOOT_SETTINGS='{"shadows":false}', to attribute boot cost.
  if (process.env.BOOT_SETTINGS) {
    await page.addInitScript((json) => { try { localStorage.setItem('tinygta_settings', json); } catch { /* ignore */ } }, process.env.BOOT_SETTINGS);
  }
  await page.goto('/', {waitUntil: 'load'});
  // wait for the first real 3D frame (marks exist in dev AND production builds; the
  // render_game_to_text hook is dev-only)
  await page.waitForFunction(() => performance.getEntriesByName('tg:first-render-end').length > 0, null, {timeout: 60_000});
  const startedAt = await page.evaluate(() => Math.round(performance.now()));
  // the GPU warmup runs in the background after boot; wait for it to report done
  await page.waitForFunction(() => performance.getEntriesByName('tg:warm-done').length > 0, null, {timeout: 60_000}).catch(() => {});
  const t = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const marks = Object.fromEntries(performance.getEntriesByType('mark').filter(m => m.name.startsWith('tg:')).map(m => [m.name, Math.round(m.startTime)]));
    return {domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), ...marks};
  });
  (t as Record<string, number>).observedFirstRender = startedAt;
  console.log('\n[boot timeline, ms since navigation]\n' + Object.entries(t).map(([k, v]) => `  ${k.padEnd(22)} ${v}`).join('\n'));
});
