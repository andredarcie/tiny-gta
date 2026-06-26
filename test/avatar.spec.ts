// Regression check for the rigged player avatar (the shared Mixamo base, loaded at runtime).
// Boots the real game, confirms the snapshot reports avatar:'glb' (the model attached, not the
// procedural fallback), and that walking actually moves the player through the real input
// pipeline. HEADED only (test/AGENT_LOCAL_TESTING.md).
import { test, expect } from './support/game.ts';

test('player avatar model loads and drives locomotion', async ({ game, page }) => {
  const loadErrors: string[] = [];
  page.on('console', (m) => { if (/\[(mixamo|npc-glb)\].*(fail|error)/i.test(m.text())) loadErrors.push(m.text()); });

  // The base loads async; wait until the live snapshot flips avatar -> 'glb'.
  await game.waitForState((s) => s.avatar === 'glb', { timeout: 30_000, message: 'avatar model never attached' });
  const before = await game.snapshot();
  expect(before.avatar).toBe('glb');
  expect(before.mode).toBe('foot');

  // Walk forward for ~1.5s; the player should physically move.
  await game.down('w');
  await page.waitForTimeout(1500);
  await game.up('w');
  await game.releaseAll();

  const after = await game.snapshot();
  const moved = Math.hypot(after.player.x - before.player.x, after.player.z - before.player.z);
  expect(moved).toBeGreaterThan(2);
  expect(loadErrors).toEqual([]);
});
