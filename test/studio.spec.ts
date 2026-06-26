// HEADED smoke test for the /studio dev page: the shared Mixamo character loads and there's a
// button per AnimState (driven by the game's FSM), with no console/page errors.
import { test, expect } from '@playwright/test';

test('studio: loads the Mixamo character and shows a button per AnimState', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

  await page.goto('/studio.html');
  // the base + clips load async; the state buttons appear once ready
  await expect(page.getByRole('button', { name: 'Walk', exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aim', exact: true })).toBeVisible();
  expect(await page.getByRole('button').count()).toBeGreaterThan(15); // 23 AnimStates

  // click through a couple of states (real animation switching, incl. the gun-aim overlay)
  await page.getByRole('button', { name: 'Aim', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Punch', exact: true }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/studio.png' });

  expect(errors.filter((e) => !/favicon|404/i.test(e))).toEqual([]);
});
