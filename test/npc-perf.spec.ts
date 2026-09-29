// NPC render cost: boots the real game at noon, stands at a few busy city spots and
// prints the in-game profiler's numbers — FPS, total draw calls and the per-group census
// (window.profilerCensus: draws/triangles each entity group adds). Asserts only that the
// game ran; the table is what to compare before/after a character-rendering change.
//   npx playwright test test/npc-perf.spec.ts
import { test } from './support/game.ts';

const SPOTS: [string, number, number, number, number][] = [
  ['downtown street', 10, 22, 10, 120],
  ['downtown crossing', 0, 0, 60, 60],
  ['eastside avenue', 90, 20, 90, -80],
];

test('NPC render cost at busy city spots', async ({ game }) => {
  test.setTimeout(180_000);
  const page = game.page;
  await page.evaluate(() => (window as any).profilerToggle());   // per-system CPU timing on
  const rows: string[] = [];
  for (const [name, x, z, fx, fz] of SPOTS) {
    await page.evaluate(([x, z, fx, fz]) => (window as any).__test.teleport(x, z, fx, fz), [x, z, fx, fz]);
    await page.waitForTimeout(3500);                        // traffic/peds settle, fps window fills
    const fps: number[] = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(500);
      fps.push(JSON.parse(await page.evaluate(() => (window as any).profilerReport())).fps);
    }
    fps.sort((a, b) => a - b);
    await page.screenshot({ path: `output/visual/npc-perf-${name.replace(/ /g, '-')}.png` });
    const census = JSON.parse(await page.evaluate(() => (window as any).profilerCensus()));
    const rep = JSON.parse(await page.evaluate(() => (window as any).profilerReport()));
    const people = ['peds', 'gangPeds', 'cops', 'officers', 'ruralFolk']
      .reduce((a, k) => a + (census[k]?.draws || 0), 0);
    rows.push(`${name.padEnd(18)} fps ${String(fps[2]).padStart(3)}  draws ${census.__total.draws}`
      + `  people ${people} (peds ${census.peds.draws}, gang ${census.gangPeds.draws}, cops ${census.cops.draws + census.officers.draws})`
      + `  cars ${census.traffic.draws + census.idleCars.draws}  visible ${JSON.stringify(rep.counts)}`
      + `
${' '.repeat(18)} cpu ms ${JSON.stringify(rep.systemsMs)}`);
  }
  console.log('\n[npc perf @noon]\n' + rows.join('\n'));
});
