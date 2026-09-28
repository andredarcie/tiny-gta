// Visual review shots: boots the real game at a few times of day (?tod=) and camera
// spots, and saves screenshots to output/visual/<LABEL>/ for before/after comparison of
// visual changes. Run headed: `SHOTS_LABEL=after npx playwright test test/visual-shots.spec.ts`.
// It asserts nothing about the look — judging the pictures is the owner's call.
import {test} from '@playwright/test';

const LABEL = process.env.SHOTS_LABEL || 'current';
const TODS: [string, number][] = [['noon', .5], ['sunset', .74], ['night', .02]];
// [name, x, z, lookAtX, lookAtZ, pitch] — pitch >0 looks down (fpPitch)
const SPOTS: [string, number, number, number, number, number][] = [
  ['street', 10, 22, 10, 120, .02],
  ['plaza', -30, -30, 40, 40, .08],
  ['rural', 196, 4, 260, -60, .02],
];

for (const [todName, tod] of TODS) {
  test(`shots at ${todName}`, async ({page}) => {
    test.setTimeout(120_000);
    await page.goto(`/?tod=${tod}`, {waitUntil: 'load'});
    await page.waitForFunction(() => !!(window as any).render_game_to_text
      && JSON.parse((window as any).render_game_to_text()).started === true, null, {timeout: 60_000});
    await page.waitForTimeout(2500);
    for (const [spot, x, z, fx, fz] of SPOTS) {
      await page.evaluate(([x, z, fx, fz]) => (window as any).__test.teleport(x, z, fx, fz), [x, z, fx, fz]);
      await page.waitForTimeout(1800);   // let shadows/sky/fog catch up
      await page.screenshot({path: `output/visual/${LABEL}/${todName}-${spot}.png`});
    }
  });
}
