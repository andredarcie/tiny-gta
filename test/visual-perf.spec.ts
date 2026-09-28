// Render-cost matrix for the graphics settings: boots the real game with each
// combination of the Settings → Graphics toggles (written to localStorage before load)
// and reads the in-game FPS counter at a fixed city view. Prints a table; asserts only
// that the game ran. Headed, like every game run:
//   npx playwright test test/visual-perf.spec.ts
import {test} from '@playwright/test';

const CONFIGS: [string, Record<string, boolean>][] = [
  ['plain (no AO, no bloom, no shadows)', {ao: false, bloom: false, shadows: false}],
  ['shadows only', {ao: false, bloom: false, shadows: true}],
  ['shadows + bloom', {ao: false, bloom: true, shadows: true}],
  ['shadows + AO', {ao: true, bloom: false, shadows: true}],
  ['everything', {ao: true, bloom: true, shadows: true}],
];

test('graphics settings FPS matrix', async ({page}) => {
  test.setTimeout(240_000);
  const rows: string[] = [];
  for (const [name, cfg] of CONFIGS) {
    await page.addInitScript((c) => {
      try { localStorage.setItem('tinygta_settings', JSON.stringify({...JSON.parse(localStorage.getItem('tinygta_settings') || '{}'), ...c, fps: true})); } catch { /* ignore */ }
    }, cfg);
    await page.goto('/?tod=0.5', {waitUntil: 'load'});
    await page.waitForFunction(() => !!(window as any).render_game_to_text
      && JSON.parse((window as any).render_game_to_text()).started === true, null, {timeout: 60_000});
    await page.evaluate(() => (window as any).__test.teleport(10, 22, 10, 120));
    await page.waitForTimeout(4000);
    const samples: number[] = [];
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(600);
      const t = await page.evaluate(() => document.getElementById('fps')?.textContent || '');
      const n = parseInt(t, 10); if (Number.isFinite(n)) samples.push(n);
    }
    samples.sort((a, b) => a - b);
    rows.push(`${name.padEnd(40)} median ${samples[samples.length >> 1]} fps  (min ${samples[0]})`);
  }
  console.log('\n[graphics FPS @1280x720]\n' + rows.join('\n'));
});
