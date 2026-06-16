// Renders the new Schedule I-style player ped beside real Schedule I reference
// screenshots and saves the comparison to test/out/compare.png (read by the dev
// to judge the match). Not a gameplay test — uses the raw page, not the game.
import {test} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('player toon vs Schedule I', async ({page}) => {
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => console.error('[console:' + m.type() + ']', m.text()));
  // Use our OWN dev server on a dedicated port — port 5173 is sometimes squatted
  // by another project's dev server, which would serve the wrong index.html.
  await page.goto('http://localhost:5273/portrait.html', {waitUntil: 'load'});
  try {
    await page.waitForFunction(() => window.__ready === true || !!window.__err, null, {timeout: 25_000});
  } catch (e) {
    const st = await page.evaluate(() => ({ ready: window.__ready, err: window.__err, has: !!document.getElementById('cmp') }));
    console.error('[spec] timed out; page state =', JSON.stringify(st));
    throw e;
  }
  const err = await page.evaluate(() => window.__err);
  if (err) throw new Error('portrait failed: ' + err);
  await page.waitForTimeout(200);
  const buf = await page.locator('#cmp').screenshot();
  fs.mkdirSync('test/out', {recursive: true});
  fs.writeFileSync('test/out/compare.png', buf);

  // History: archive EVERY render so each evolution is preserved (never overwritten).
  // Files are numbered + timestamped so they sort chronologically.
  const dir = 'comparacoes';
  fs.mkdirSync(dir, {recursive: true});
  const nums = fs.readdirSync(dir).map((f) => parseInt(f, 10)).filter((n) => !Number.isNaN(n));
  const n = String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0');
  const ts = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
  fs.writeFileSync(path.join(dir, `${n}_${ts}.png`), buf);
  fs.writeFileSync('comparacao-player-vs-scheduleI.png', buf); // always-latest at repo root
  console.error('[spec] saved comparison to', path.join(dir, `${n}_${ts}.png`));
});
