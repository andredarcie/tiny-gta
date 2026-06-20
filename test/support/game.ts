// ============================================================================
// GameDriver — the ONE way agents/tests drive Tiny Crime in a real browser.
//
// It runs the actual game (real Three.js/WebGL, real game loop, real input
// pipeline) in a real Chromium and drives it through the seams the game already
// exposes, so tests are as faithful as possible:
//   - window.render_game_to_text()  -> full JSON state snapshot (defined in main.js)
//   - real keyboard events via Playwright (page.keyboard) -> the real input path
//   - live ES modules via dynamic import('/js/*.js') in page context (Vite serves
//     the same singleton module instances the running game uses), used for setup
//     helpers like placing the car at an activity's start.
//
// Import `test`/`expect` from this file in a *.spec.js to get a ready `game`
// fixture (booted lazily). See test/race.spec.js for a complete example.
//
// Coordinate system (from render_game_to_text): world x/z plane in map meters,
// y is height. Car movement is x += sin(heading), z += cos(heading), so the
// heading that points at (tx,tz) from (x,z) is atan2(tx-x, tz-z).
// ============================================================================
import { test as base, expect, type Page } from '@playwright/test';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wrapPi = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export class GameDriver {
  page: Page;
  _held: Set<string>;

  constructor(page: Page) {
    this.page = page;
    this._held = new Set();
  }

  // ---- boot ---------------------------------------------------------------
  // Faithful start: load the page, click PLAY, type a nickname, click PLAY again
  // (the same path a player takes), then wait until the game reports started.
  async boot(nick = 'BOT') {
    const page = this.page;
    page.on('pageerror', (e) => console.error('[pageerror]', e.message));
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForSelector('#play', { timeout: 30_000 });
    // The title button pulses (animated) — Playwright sees it as unstable, so click via DOM.
    await page.evaluate(() => document.getElementById('play')!.click());
    await page.waitForSelector('#nick-input', { state: 'visible', timeout: 10_000 });
    await page.evaluate((n) => { (document.getElementById('nick-input') as HTMLInputElement).value = n; }, nick);
    await page.evaluate(() => document.getElementById('nick-play')!.click());
    await page.waitForFunction(
      () => !!(window as any).render_game_to_text && JSON.parse((window as any).render_game_to_text()).started === true,
      null, { timeout: 20_000 });
    // The nickname <input> keeps focus after confirm; the game ignores key events
    // whose target is an INPUT, so blur it and give focus to the game canvas —
    // otherwise E/W/A/S/D would be swallowed.
    await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; if (a && a.blur) a.blur(); });
    await page.locator('#game').click({ position: { x: 8, y: 8 }, force: true }).catch(() => {});
    await sleep(400); // settle a few frames
    return this;
  }

  // ---- state --------------------------------------------------------------
  async snapshot() {
    return JSON.parse(await this.page.evaluate(() => (window as any).render_game_to_text()));
  }

  // Wait until a predicate over the snapshot is true. `pred` is a function that
  // receives the parsed snapshot and returns boolean; it is serialized to run in
  // the page, so it must be self-contained (no closure variables).
  async waitForState(pred: (s: any) => boolean, { timeout = 20_000, message }: { timeout?: number; message?: string } = {}) {
    try {
      await this.page.waitForFunction(
        (src) => {
          const s = JSON.parse((window as any).render_game_to_text());
          return new Function('s', `return (${src})(s)`)(s);
        },
        pred.toString(), { timeout });
    } catch (e) {
      throw new Error(`waitForState timed out${message ? `: ${message}` : ''}`);
    }
  }

  // ---- input (real keyboard) ---------------------------------------------
  async down(key: string) { if (!this._held.has(key)) { this._held.add(key); await this.page.keyboard.down(key); } }
  async up(key: string) { if (this._held.has(key)) { this._held.delete(key); await this.page.keyboard.up(key); } }
  async tap(key: string) { await this.page.keyboard.press(key); }
  async releaseAll() { for (const k of [...this._held]) await this.up(k); }

  // ---- run live game code in the page (setup / introspection) -------------
  // `fn` runs in the browser; it may `await import('/js/<module>.js')` to reach
  // the live game modules. `arg` is passed through (must be serializable).
  async inPage(fn: any, arg?: any) { return this.page.evaluate(fn, arg); }

  // ---- common actions -----------------------------------------------------
  // Get into a car (via the game's real enterCar()). Uses the window.__test hook
  // because Playwright's page-context import() does NOT share the running game's
  // module singletons — only window-attached hooks touch the live game.
  async enterCar() {
    await this.inPage(() => (window as any).__test.enterCar());
    await this.waitForState((s) => s.mode === 'car' && !!s.vehicle, { timeout: 12_000, message: 'did not enter a car' });
    await this.snapshot();
  }

  // Setup helper: place the current vehicle at (x,z) facing (faceX,faceZ),
  // stopped — test scaffolding to reach an activity's start without a long
  // cross-map drive; the activity itself is then played for real.
  async placeVehicle(x: number, z: number, faceX: number, faceZ: number) {
    const ok = await this.inPage((a: { x: number; z: number; fx: number; fz: number }) => (window as any).__test.placeVehicle(a.x, a.z, a.fx, a.fz),
      { x, z, fx: faceX, fz: faceZ });
    if (!ok) throw new Error('placeVehicle failed (not in a vehicle)');
    await this.snapshot();
  }

  async money() { return (await this.snapshot()).money; }

  // One round-trip: the full state snapshot + the current race checkpoint coords.
  async raceFrame() {
    return this.inPage(() => ({ s: JSON.parse((window as any).render_game_to_text()), t: (window as any).__test.raceTarget() }));
  }

  // ---- start a race by actually pressing E -------------------------------
  // The car must already be stopped under the start gate. Presses the real E key
  // (the player's "start race" action). Retries a couple of times in case the OS
  // window wasn't focused; if E still doesn't take, falls back to the interact
  // hook so the test can proceed. Returns true if E itself started it.
  async startRaceByKey(stateKey: string, { tries = 4 }: { tries?: number } = {}) {
    await this.page.bringToFront().catch(() => {});
    await this.inPage(() => { const a = document.activeElement as HTMLElement | null; if (a && a.blur) a.blur(); });
    const racing = (k: string) => {
      const s = JSON.parse((window as any).render_game_to_text());
      return !!(s[k] && (s[k].phase === 'countdown' || s[k].phase === 'racing'));
    };
    let started = false;
    for (let i = 0; i < tries; i++) {
      await this.page.keyboard.press('e');                 // <- press E to start the race
      const ok = await this.page.waitForFunction(racing, stateKey, { timeout: 2500 }).then(() => true).catch(() => false);
      if (ok) { started = true; break; }
    }
    if (!started) {
      await this.inPage(() => (window as any).__test.interact());    // focus fallback (still starts the race)
      await this.page.waitForFunction(racing, stateKey, { timeout: 5000 });
    }
    await this.dismissBriefing();   // pass the leaderboard briefing so the countdown can run
    return started;
  }

  // Starting an exclusive mini-game opens the leaderboard briefing (#mg-intro,
  // state.mgIntro) which FREEZES the world until the player "passes" it. Click
  // its GO button (after the 300ms guard) so the race countdown can run.
  async dismissBriefing() {
    for (let i = 0; i < 15; i++) {
      const shown = await this.inPage(() => {
        const el = document.getElementById('mg-intro');
        return !!(el && el.classList && el.classList.contains('show'));
      });
      if (!shown) return true;
      await this.page.waitForTimeout(350);                 // clear the 300ms open-guard
      const clicked = await this.page.locator('#mgi-go').click({ force: true, timeout: 1000 }).then(() => true).catch(() => false);
      if (!clicked) await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(150);
    }
    return false;
  }

  // ---- drive a running race with real W/A/D keys -------------------------
  // Holds throttle and steers toward the live current checkpoint until the race
  // ends, with a simple un-stick. Uses real keyboard input the whole way.
  //
  // SKILL KNOB — `botch` is a list of checkpoint indices where the driver
  // deliberately blows the corner (lifts off + brakes + drifts wide for
  // `botchTicks` ticks), each costing time/line. `botch:[]` = a flawless lap;
  // more botched corners = a worse, slower lap. Used to prove the difficulty
  // curve (perfect -> 1st, slight slips -> 1st by a hair, sloppy -> off the top).
  // Returns {finished, lostByRivals, place, cpReached, moneyGain, raceTimeS}.
  async driveRace(stateKey: string, { maxMs = 120_000, tickMs = 70, sample = false, botch = [] as number[], botchTicks = 7 }: { maxMs?: number; tickMs?: number; sample?: boolean; botch?: number[]; botchTicks?: number } = {}) {
    const page = this.page;
    await page.waitForFunction(
      (k) => { const s = JSON.parse((window as any).render_game_to_text()); return s[k] && s[k].phase === 'racing'; },
      stateKey, { timeout: 20_000 });
    const moneyStart = (await this.snapshot()).money;

    await page.keyboard.down('w');                          // accelerate
    let steer: string | null = null, stuck = 0, reversing = 0, place = null, cp = 0, finished = false;
    let raceTimeS = 0; const samples: any[] = []; const fumbled = new Set<number>(); let fumbleTicks = 0;
    const setSteer = async (k: string | null) => { if (k !== steer) { if (steer) await page.keyboard.up(steer); if (k) await page.keyboard.down(k); steer = k; } };
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const { s, t } = await this.raceFrame();
      const st = s[stateKey];
      if (!st || st.phase !== 'racing') { finished = true; break; }
      place = st.pos; cp = st.cp; raceTimeS = st.time;
      const v = s.vehicle;
      if (sample) samples.push({ time: st.time, pos: st.pos, cp: st.cp, speed: v ? Math.round(v.speed * 10) / 10 : 0 });
      // deliberate corner mistake (skill knob): brake + drift wide through the corner
      if (botch.includes(cp) && !fumbled.has(cp)) { fumbled.add(cp); fumbleTicks = botchTicks; }
      if (fumbleTicks > 0) {
        fumbleTicks--;
        await setSteer(null); await page.keyboard.up('w'); await page.keyboard.down('s');
        await page.waitForTimeout(tickMs); continue;
      }
      if (t && v) {
        const err = wrapPi(Math.atan2(t.x - v.x, t.z - v.z) - s.player.heading);
        if (Math.abs(v.speed) < 1.5) { if (++stuck > 16) { reversing = 10; stuck = 0; } } else stuck = 0;
        if (reversing > 0) {                                // wedged: reverse, invert steering
          reversing--; await page.keyboard.up('w'); await page.keyboard.down('s');
          await setSteer(err > 0 ? 'd' : 'a');
        } else {
          await page.keyboard.up('s');
          const ae = Math.abs(err);
          if (ae > 0.9) await page.keyboard.up('w');        // sharp turn: lift off to tighten the line
          else await page.keyboard.down('w');               // otherwise full throttle
          await setSteer(ae > 0.06 ? (err > 0 ? 'a' : 'd') : null); // err>0 -> A, err<0 -> D
        }
      }
      await page.waitForTimeout(tickMs);
    }
    for (const k of ['w', 'a', 's', 'd']) await page.keyboard.up(k).catch(() => {});
    const after = await this.snapshot();
    return {
      finished, place, cpReached: cp, raceTimeS,
      moneyGain: after.money - moneyStart,
      lostByRivals: finished && (after.money - moneyStart) <= 0,
      samples,
      snapshot: after,
    };
  }
}

// Playwright fixture: every spec gets a booted `game`.
export const test = base.extend<{ game: GameDriver }>({
  game: async ({ page }, use) => {
    const g = new GameDriver(page);
    await g.boot();
    await use(g);
  },
});

export { expect };
