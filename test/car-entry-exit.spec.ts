import { expect, test } from './support/game.ts';

test('car entry and exit complete their full animated sequence', async ({ game }) => {
  const errors: string[] = [];
  game.page.on('pageerror', error => {
    if (!/Pointer Lock/i.test(error.message)) errors.push(error.message);
  });

  await game.inPage(() => (window as any).__test.enterPrimaryCar());
  await game.inPage(() => (window as any).advanceTime(250));
  await game.page.screenshot({ path: 'test-results/car-entry-door-open.png' });
  await game.inPage(() => (window as any).advanceTime(1200));
  expect((await game.snapshot()).mode).toBe('car');
  await game.page.screenshot({ path: 'test-results/car-entry-seated.png' });

  await game.inPage(() => (window as any).__test.exitCar());
  await game.inPage(() => (window as any).advanceTime(250));
  await game.page.screenshot({ path: 'test-results/car-exit-door-open.png' });
  await game.inPage(() => (window as any).advanceTime(1200));
  expect((await game.snapshot()).mode).toBe('foot');
  expect(errors).toEqual([]);
  await game.page.screenshot({ path: 'test-results/car-exit-complete.png' });
});
