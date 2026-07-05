// ============================================================================
// TWO-PLAYER online smoke suite. Boots two real game windows (PlayerA, PlayerB)
// against a LOCAL multiplayer server and drives them through the shared-world
// pipeline end-to-end: presence, identity, ping, server-decided PvP combat,
// live movement/vehicle sync, and disconnect.
//
// Run headed (mandatory — see test/AGENT_LOCAL_TESTING.md):
//     npm run test:online
// (playwright.online.config.ts starts both the Vite dev server and the wrangler
//  MP server on :8787.)
//
// Assertions read the render_game_to_text() snapshot, including two dev-only
// fields added for this harness: `onlineRemotes` (each remote avatar's rendered
// pose/vehicle/death) and `health` (local PvP HP).
// ============================================================================
import { test, expect } from '@playwright/test';
import { bootOnlinePlayers, closeOnlinePlayers, remoteByNick, type OnlinePlayer } from './support/online.ts';

test.describe.configure({ mode: 'serial' });

let players: OnlinePlayer[] = [];
let A: OnlinePlayer;
let B: OnlinePlayer;

test.beforeAll(async ({ browser }) => {
  players = await bootOnlinePlayers(browser, ['PlayerA', 'PlayerB']);
  [A, B] = players;
});

test.afterAll(async () => { await closeOnlinePlayers(players); });

test('both players connect and see each other in one shared world', async () => {
  const a = await A.driver.snapshot();
  const b = await B.driver.snapshot();
  expect(a.online.enabled).toBe(true);
  expect(b.online.enabled).toBe(true);
  expect(a.online.phase).toBe('joined');
  expect(b.online.phase).toBe('joined');
  // each sees exactly the other one
  expect(a.online.remotes).toBe(1);
  expect(b.online.remotes).toBe(1);
  // world population (self included)
  expect(a.online.players).toBe(2);
  expect(b.online.players).toBe(2);
});

test('nicknames propagate to the other player', async () => {
  const a = await A.driver.snapshot();
  const b = await B.driver.snapshot();
  expect(remoteByNick(a, 'PlayerB'), 'A should see B by name').toBeTruthy();
  expect(remoteByNick(b, 'PlayerA'), 'B should see A by name').toBeTruthy();
});

test('the HUD ping is measured from a real round-trip', async () => {
  // Ping needs a keepalive probe round-trip (PING_INTERVAL_MS ~3s), so poll.
  await A.driver.page.waitForFunction(() => {
    const s = JSON.parse((window as any).render_game_to_text());
    return typeof s.online.ping === 'number' && s.online.ping >= 0;
  }, null, { timeout: 20_000 });
  const a = await A.driver.snapshot();
  expect(typeof a.online.ping).toBe('number');
  expect(a.online.ping).toBeGreaterThanOrEqual(0);
});

test('melee PvP damage is decided by the server and syncs both ways', async () => {
  // Both start on foot near spawn. Line A up ~2m from B, FACING B, then punch.
  const b0 = await B.driver.snapshot();
  expect(b0.mode, 'B must be on foot for a melee PvP test').toBe('foot');
  const bx = b0.player.x as number;
  const bz = b0.player.z as number;

  const placed = await A.driver.inPage(
    (t: { bx: number; bz: number }) => (window as any).__test.teleport(t.bx + 2, t.bz, t.bx, t.bz),
    { bx, bz });
  expect(placed, 'A should teleport next to B (A on foot)').toBeTruthy();

  // Wait until B actually sees A arrive right beside it (pose round-tripped).
  await B.driver.page.waitForFunction(
    (t) => {
      const s = JSON.parse((window as any).render_game_to_text());
      const r = (s.onlineRemotes || [])[0];
      return r && Math.hypot(r.x - (t.bx + 2), r.z - t.bz) < 2.5;
    },
    { bx, bz }, { timeout: 20_000 });

  const hpBefore = (await B.driver.snapshot()).health as number;
  expect(hpBefore).toBeGreaterThan(0);

  // A burst of fist swings (server melee = 10 HP each; ~10 to down, throw 14).
  for (let i = 0; i < 14; i++) {
    await A.driver.inPage(() => (window as any).__test.attack());
    await A.driver.page.waitForTimeout(220);
  }

  // (1) B's SERVER-authoritative HP dropped — the client never self-reports a hit.
  const hpAfter = (await B.driver.snapshot()).health as number;
  expect(hpAfter, 'B should have taken server-decided PvP damage').toBeLessThan(hpBefore);

  // (2) death sync: A should see B go down (server 'death' event → lie-down pose).
  await A.driver.waitForState(
    (s: any) => (s.onlineRemotes || []).some((r: any) => r.dead),
    { timeout: 20_000, message: 'A never saw B die after landing melee hits' });
});

test('live movement + vehicle sync: B sees A drive to a waypoint and keep moving', async () => {
  // Put A in a car and teleport it to a far, known waypoint.
  await A.driver.enterCar();
  const WX = 120;
  const WZ = -40;
  await A.driver.placeVehicle(WX, WZ, WX + 10, WZ); // face +x so W drives toward +x

  // B must see A's remote arrive near the waypoint AND be rendered in a vehicle.
  await B.driver.page.waitForFunction(
    (w) => {
      const s = JSON.parse((window as any).render_game_to_text());
      const r = (s.onlineRemotes || [])[0];
      return r && Math.hypot(r.x - w.x, r.z - w.z) < 5 && r.vk !== 0;
    },
    { x: WX, z: WZ }, { timeout: 25_000 });

  const seenAtWaypoint = (await B.driver.snapshot()).onlineRemotes[0];
  expect(seenAtWaypoint.vk, 'A should be synced as driving a vehicle (vk != 0)').not.toBe(0);

  // Now A drives forward for a beat; B's view of A must move off the waypoint
  // (proves continuous interpolated sync, not just a one-shot teleport).
  await A.driver.page.bringToFront().catch(() => {});
  await A.driver.down('w');
  await A.driver.page.waitForTimeout(2600);
  await A.driver.up('w');

  await B.driver.page.waitForFunction(
    (from) => {
      const s = JSON.parse((window as any).render_game_to_text());
      const r = (s.onlineRemotes || [])[0];
      return r && Math.hypot(r.x - from.x, r.z - from.z) > 5;
    },
    { x: seenAtWaypoint.x, z: seenAtWaypoint.z }, { timeout: 20_000 });
});

test('a disconnect is reflected to the other player', async () => {
  // Closing B's window drops its socket; the server broadcasts a leave and A's
  // roster must shrink back to just itself.
  await B.context.close();
  await A.driver.waitForState(
    (s: any) => s.online && s.online.remotes === 0,
    { timeout: 25_000, message: 'A still sees B after B disconnected' });
  const a = await A.driver.snapshot();
  expect(a.online.remotes).toBe(0);
  expect(a.online.players).toBe(1);
});
