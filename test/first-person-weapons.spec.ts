import { expect, test } from './support/game.ts';

const WEAPON_IDS = [
  'fist', 'bat', 'pistol', 'uzi', 'shotgun', 'ak47', 'm16', 'sniper',
  'grenade', 'molotov', 'flame', 'detonator',
];

test('first-person weapon viewmodels stay visible across the arsenal', async ({ game }) => {
  await game.inPage(() => (window as any).__test.giveGun());

  for (const weaponId of WEAPON_IDS) {
    const selected = await game.inPage((id: string) => (window as any).__test.equipWeapon(id), weaponId);
    expect(selected).toBe(true);
    await game.inPage(() => (window as any).__test.attack());
    await game.inPage(() => (window as any).advanceTime(100));
    await game.page.screenshot({ path: `test-results/first-person-${weaponId}.png` });
  }

});

test('first-person rocket launcher uses its dedicated two-hand pose', async ({ game }) => {
  await game.inPage(() => (window as any).__test.teleport(320, 0, 320, 100));
  const rampageStarted = await game.inPage(() => (window as any).__test.startRampage());
  expect(rampageStarted).toBe(true);
  await game.page.waitForTimeout(350);
  await game.tap('Enter');
  await game.page.waitForTimeout(150);
  await game.inPage(() => (window as any).__test.attack());
  await game.inPage(() => (window as any).advanceTime(100));
  await game.page.screenshot({ path: 'test-results/first-person-rocket.png' });
});
