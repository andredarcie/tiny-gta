// ============================================================================
// EXTENDED two-player online suite — covers the online paths the base
// two-player.online.spec.ts does not: a 3rd player joining the shared world,
// GUN (hitscan) PvP, FLAMETHROWER PvP, heal-sync restoring server HP, vehicle
// PvP-immunity, and the full death -> server-respawn cycle. Every hit is still
// decided by the SERVER (the client only reports "I attacked from O toward D").
//
// Run headed (mandatory — see test/AGENT_LOCAL_TESTING.md):
//     npx playwright test --config=playwright.online.config.ts test/two-player-extra.online.spec.ts
//
// Uses three dev-only __test hooks added for online coverage:
//   giveGun()      — grant the full arsenal (equips the pistol)
//   equipWeapon(id)— switch to a specific weapon ('pistol','flame',…)
//   setHealth(hp)  — set local PvP HP (raising it drives the heal-sync path)
// ============================================================================
import { test, expect } from '@playwright/test';
import { bootOnlinePlayers, closeOnlinePlayers, remoteByNick, type OnlinePlayer } from './support/online.ts';

test.describe.configure({ mode: 'serial' });

let players: OnlinePlayer[] = [];
let A: OnlinePlayer;   // shooter (AlphaGun)
let B: OnlinePlayer;   // target  (BravoTgt)

test.beforeAll(async ({ browser }) => {
  players = await bootOnlinePlayers(browser, ['AlphaGun', 'BravoTgt']);
  [A, B] = players;
});
test.afterAll(async () => { await closeOnlinePlayers(players); });

// ---- helpers ---------------------------------------------------------------

// Traffic-free rural duel ground: on a city road, NPC traffic rams the players
// mid-test and pollutes / interrupts the combat (killing the shooter, nudging
// the target). Off-road terrain has no traffic, so PvP is the ONLY thing that
// can change anyone's HP or position.
const OFF = { x: 600, z: -44 };

/** Stand both players on the off-road anchor, A `d` metres from B FACING B, and
 * wait until EACH sees the other arrive there. Because the server only
 * broadcasts poses it ACCEPTED, that round-trip also confirms both teleports got
 * past the plausibility/teleport-budget check (move-check.ts) before we fire —
 * so shots are never dropped by the muzzle-origin guard for a stale position. */
async function duelOffRoad(d = 4): Promise<void> {
  const bok = await B.driver.inPage(
    (p: { x: number; z: number }) => (window as any).__test.teleport(p.x, p.z, p.x + 10, p.z),
    OFF);
  expect(bok, 'B should teleport to the off-road anchor').toBeTruthy();
  const ax = OFF.x + d, az = OFF.z;
  const aok = await A.driver.inPage(
    (t: { ax: number; az: number; bx: number; bz: number }) =>
      (window as any).__test.teleport(t.ax, t.az, t.bx, t.bz),
    { ax, az, bx: OFF.x, bz: OFF.z });
  expect(aok, 'A should teleport next to B off-road').toBeTruthy();
  // A must see B at the anchor (B's teleport accepted) ...
  await A.driver.page.waitForFunction(
    (o) => {
      const s = JSON.parse((window as any).render_game_to_text());
      const r = (s.onlineRemotes || [])[0];
      return r && Math.hypot(r.x - o.x, r.z - o.z) < 2.5 && !r.dead;
    },
    OFF, { timeout: 20_000 });
  // ... and B must see A beside it (A's teleport accepted).
  await B.driver.page.waitForFunction(
    (t) => {
      const s = JSON.parse((window as any).render_game_to_text());
      const r = (s.onlineRemotes || [])[0];
      return r && Math.hypot(r.x - t.ax, r.z - t.az) < 2.5 && !r.dead;
    },
    { ax, az }, { timeout: 20_000 });
}

/** Reset B to full HP; heal-sync (online.ts) pushes the value to the server too,
 * so each serial combat test gets a clean, survivable target. */
async function healB(): Promise<void> {
  await B.driver.inPage(() => (window as any).__test.setHealth(100));
  await B.driver.page.waitForTimeout(1000);   // >= a couple of send ticks + RTT
  const b = await B.driver.snapshot();
  expect(b.health).toBe(100);
}

/** Fire A's currently-equipped weapon `n` times through the real fire path. */
async function aFire(n: number, gapMs = 200): Promise<void> {
  for (let i = 0; i < n; i++) {
    await A.driver.inPage(() => (window as any).__test.attack());
    await A.driver.page.waitForTimeout(gapMs);
  }
}

// ---- tests -----------------------------------------------------------------

test('a third player joins the SAME shared world; everyone sees everyone', async ({ browser }) => {
  const extra = await bootOnlinePlayers(browser, ['CharlieP']);
  const C = extra[0];
  try {
    // All three converge on seeing the other two (one shared world, no rooms).
    for (const p of [A, B, C]) {
      await p.driver.page.waitForFunction(() => {
        const s = JSON.parse((window as any).render_game_to_text());
        return !!s.online && s.online.remotes >= 2 && s.online.players >= 3;
      }, null, { timeout: 30_000 });
    }
    // Identity round-trips all three ways.
    const a = await A.driver.snapshot(), b = await B.driver.snapshot(), c = await C.driver.snapshot();
    expect(remoteByNick(a, 'CharlieP'), 'A should see Charlie').toBeTruthy();
    expect(remoteByNick(b, 'CharlieP'), 'B should see Charlie').toBeTruthy();
    expect(remoteByNick(c, 'AlphaGun'), 'Charlie should see Alpha').toBeTruthy();
    expect(remoteByNick(c, 'BravoTgt'), 'Charlie should see Bravo').toBeTruthy();
  } finally {
    await C.context.close();
  }
  // After Charlie leaves, A and B drop back to seeing exactly one remote.
  for (const p of [A, B]) {
    await p.driver.waitForState((s: any) => s.online && s.online.remotes === 1,
      { timeout: 25_000, message: 'roster did not shrink back after Charlie left' });
  }
});

test('gun (hitscan) PvP damage is decided by the server (k=0)', async () => {
  await healB();
  await A.driver.inPage(() => (window as any).__test.giveGun());
  await A.driver.inPage(() => (window as any).__test.equipWeapon('pistol'));
  await duelOffRoad(4);
  const hpBefore = (await B.driver.snapshot()).health as number;
  await aFire(4);                              // ~12 HP/hit → non-lethal from 100
  await B.driver.waitForState((s: any) => s.health < 100,
    { timeout: 15_000, message: 'B never took server-decided gun damage' });
  const hpAfter = (await B.driver.snapshot()).health as number;
  expect(hpAfter, 'B should have lost server-decided HP').toBeLessThan(hpBefore);
  expect(hpAfter, 'controlled burst should leave B alive').toBeGreaterThan(0);
});

test('flamethrower PvP damage is decided by the server (k=3)', async () => {
  await healB();
  await A.driver.inPage(() => (window as any).__test.giveGun());
  const eq = await A.driver.inPage(() => (window as any).__test.equipWeapon('flame'));
  expect(eq, 'A should equip the flamethrower').toBeTruthy();
  await duelOffRoad(4);                        // flame reaches ~10m; 4m is well inside the cone
  await aFire(5, 180);
  await B.driver.waitForState((s: any) => s.health < 100,
    { timeout: 15_000, message: 'B never took server-decided flame damage' });
  const hpAfter = (await B.driver.snapshot()).health as number;
  expect(hpAfter).toBeLessThan(100);
});

test('heal-sync restores server HP (a healed player is not one-shot low)', async () => {
  await healB();
  await A.driver.inPage(() => (window as any).__test.giveGun());
  await A.driver.inPage(() => (window as any).__test.equipWeapon('pistol'));
  await duelOffRoad(4);
  // 1) knock B DOWN low (server HP low; local HP dragged down by the ceiling).
  await aFire(5);
  await B.driver.waitForState((s: any) => s.health <= 60,
    { timeout: 15_000, message: 'B was not knocked low enough for the heal-sync test' });
  // 2) B heals to full → heal-sync must push the server HP back to 100.
  await healB();
  // 3) A empties a burst that would be LETHAL against a stale-low server HP
  //    (~40) but only wounds a truly-healed 100 HP target → B must SURVIVE.
  await aFire(4);
  await A.driver.page.waitForTimeout(800);
  const hpAfter = (await B.driver.snapshot()).health as number;
  expect(hpAfter, 'a healed player must survive (heal reached the server)').toBeGreaterThan(0);
  expect(hpAfter, 'the healed player still takes real damage').toBeLessThan(100);
});

test('a player in a vehicle is PvP-immune (server drops shots at vehicle targets)', async () => {
  // A gets in a car and parks OFF-ROAD (open rural terrain, no traffic) so the
  // ONLY possible damage source is B's PvP shots — a city road would let NPC
  // traffic ram the parked car and pollute the health reading.
  await A.driver.enterCar();
  const VX = 600, VZ = -44;                     // rural, traffic-free (see AGENT_LOCAL_TESTING)
  await A.driver.placeVehicle(VX, VZ, VX + 10, VZ);
  // B must see A rendered AS a vehicle (vk != 0) at the parking spot.
  await B.driver.page.waitForFunction(
    (w) => {
      const s = JSON.parse((window as any).render_game_to_text());
      const r = (s.onlineRemotes || [])[0];
      return r && Math.hypot(r.x - w.x, r.z - w.z) < 5 && r.vk !== 0;
    },
    { x: VX, z: VZ }, { timeout: 25_000 });
  // Arm B, line B up right next to the car facing it — the SAME geometry that
  // damaged a foot target above, so any absence of damage here is IMMUNITY.
  await B.driver.inPage(() => (window as any).__test.giveGun());
  await B.driver.inPage(() => (window as any).__test.equipWeapon('pistol'));
  const bok = await B.driver.inPage(
    (w: { x: number; z: number }) => (window as any).__test.teleport(w.x + 3, w.z, w.x, w.z),
    { x: VX, z: VZ });
  expect(bok).toBeTruthy();
  // Diagnostic: what B actually sees for A (must be a vehicle: m in 1..3, vk!=0).
  const seenA = (await B.driver.snapshot()).onlineRemotes[0];
  expect(seenA.vk, `B should see A as a vehicle (vk); saw ${JSON.stringify(seenA)}`).not.toBe(0);
  expect(seenA.m, `B should see A in a vehicle move-mode 1..3; saw ${JSON.stringify(seenA)}`).toBeGreaterThanOrEqual(1);
  const aHpBefore = (await A.driver.snapshot()).health as number;
  for (let i = 0; i < 6; i++) {
    await B.driver.inPage(() => (window as any).__test.attack());
    await B.driver.page.waitForTimeout(180);
  }
  await A.driver.page.waitForTimeout(1200);    // let any (wrongly-accepted) hit round-trip
  const a = await A.driver.snapshot();
  expect(a.health, 'a player in a vehicle must take NO PvP damage').toBe(aHpBefore);
  expect(a.mode, 'A should still be driving (not downed)').toBe('car');
});

test('a PvP kill downs the victim, then the server respawns them (~5s)', async () => {
  // A back on foot (it may still be in the car from the previous test).
  if ((await A.driver.snapshot()).mode === 'car') {
    await A.driver.inPage(() => (window as any).__test.exitCar());
    await A.driver.waitForState((s: any) => s.mode === 'foot',
      { timeout: 12_000, message: 'A did not get out of the car' });
  }
  await healB();
  await A.driver.inPage(() => (window as any).__test.giveGun());
  await A.driver.inPage(() => (window as any).__test.equipWeapon('pistol'));
  await duelOffRoad(4);
  // Empty fire into B until A sees the server-decided death (each shot logged so
  // a stall is diagnosable). ~9 pistol hits down a 100 HP target.
  let sawDead = false;
  for (let i = 0; i < 24 && !sawDead; i++) {
    await A.driver.inPage(() => (window as any).__test.attack());
    await A.driver.page.waitForTimeout(200);
    const bs = await B.driver.snapshot();
    const av = (await A.driver.snapshot()).onlineRemotes[0];
    console.log(`[death] shot ${i + 1}: B.health=${bs.health} mode=${bs.mode} interior=${bs.interior} | A sees B dead=${av?.dead} @(${av?.x},${av?.z}) vk=${av?.vk} i=${av?.interior}`);
    sawDead = !!av?.dead || bs.health <= 0;
  }
  // (1) A saw B go down (server 'death' → lie-down / pvpDead) OR B hit 0 HP.
  expect(sawDead, 'A never saw B die after emptying fire into it').toBeTruthy();
  // (2) B's own PvP death drives the local WASTED flow (health hit 0).
  await B.driver.waitForState((s: any) => s.health <= 0,
    { timeout: 10_000, message: 'B was never downed (health never hit 0)' });
  // (3) the server respawns B after PVP_RESPAWN_MS (~5s) → A's view clears dead.
  await A.driver.waitForState(
    (s: any) => !(s.onlineRemotes || []).some((r: any) => r.dead),
    { timeout: 25_000, message: 'A never saw B respawn (dead flag never cleared)' });
});

test('fists are lethal in online PvP — a few clean punches down a player (k=1)', async () => {
  await healB();
  // Back to bare fists (A still holds the pistol from the prior test).
  const eq = await A.driver.inPage(() => (window as any).__test.equipWeapon('fist'));
  expect(eq, 'A should switch to fists').toBeTruthy();
  await duelOffRoad(1.6);                          // punch reach is ~2.4m; 1.6m is well inside
  // Punch (fireRate ~0.45s, so space the swings out) until B goes down. Each fist
  // now deals 40 PvP HP, so 3 clean punches kill a 100 HP target. The loop bound
  // is generous ONLY to absorb a stray whiff / send-tick — the assertion below
  // still fails if it degrades back toward the old ~10-punch grind. Death is read
  // from A's view (the server 'death' flag persists ~5s) OR B hitting 0 HP.
  let deadAt = -1;
  for (let i = 0; i < 8 && deadAt < 0; i++) {
    await A.driver.inPage(() => (window as any).__test.attack());
    await A.driver.page.waitForTimeout(520);
    const bs = await B.driver.snapshot();
    const av = (await A.driver.snapshot()).onlineRemotes[0];
    console.log(`[fists] swing ${i + 1}: B.health=${bs.health} | A sees B dead=${av?.dead}`);
    if (!!av?.dead || (bs.health as number) <= 0) deadAt = i + 1;
  }
  expect(deadAt, 'fists never killed B — punches must be lethal in PvP').toBeGreaterThan(0);
  expect(deadAt, 'fists should down a player in a few punches, not a 10-hit grind').toBeLessThanOrEqual(5);
});
