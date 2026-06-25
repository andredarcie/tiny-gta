// HEADED smoke test for the /studio dev page: it should load the model, render the
// React UI, and expose a button per animation clip — with no console/page errors.
import { test, expect } from '@playwright/test';

test('studio: loads the model and shows an animation button per clip', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

  await page.goto('/studio.html');
  // clips load async (model + CDN React); the Walk button appears once ready
  await expect(page.getByRole('button', { name: 'Walk', exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Idle', exact: true })).toBeVisible();
  expect(await page.getByRole('button').count()).toBeGreaterThan(8); // 11 clips + controls

  // click through a couple of clips (real animation switching)
  await page.getByRole('button', { name: 'Punch', exact: true }).click();
  await page.waitForTimeout(1000);

  // seat tuner: pick a vehicle → it sits, sliders + copy-output appear
  await page.getByRole('button', { name: 'Carro', exact: true }).click();
  await expect(page.getByRole('button', { name: /Copiar coordenadas/ })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/studio.png' });

  // and a motorcycle too
  await page.getByRole('button', { name: 'Moto', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/studio-moto.png' });

  // IK pose editor: enter pose mode, joint handles + gizmo appear; read pose works
  await page.getByRole('button', { name: /Entrar no modo pose/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/studio-pose.png' });
  await page.getByRole('button', { name: /Ler pose atual/ }).click();
  await page.waitForTimeout(300);
  const poseText = await page.locator('textarea.out').last().inputValue();
  expect(poseText).toMatch(/UpperLegL: rot/);

  expect(errors.filter((e) => !/favicon|404/i.test(e))).toEqual([]);
});
