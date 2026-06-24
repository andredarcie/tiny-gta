# Local testing guide for AI agents

**Read this whenever the human asks you to "test locally", "run the game", "verify it in the
real game", or "reproduce this bug live".** It exists because booting and driving this game
from an agent has historically been a fight every single time — this guide removes the
guesswork. Follow it top to bottom.

---

## 0. THE ONE RULE: run HEADED (visible), never headless

> **You MUST run the game in a VISIBLE (headed) window the human can watch in real time.
> NEVER headless. NEVER set `HEADLESS=1`. This is mandatory, not a preference.**

Two reasons, both decisive:

1. **The human has to see it.** The whole point of a local run is that they watch the game
   being played on their screen. A headless run shows them nothing.
2. **Headless is also broken for this game.** `js/core/boot.ts` loads the game behind two
   `requestAnimationFrame` ticks, and headless Chromium throttles/stalls `requestAnimationFrame`
   — so boot can hang and any live driving (races, chases) wanders off course.

So: always `npx playwright test <spec>` with **no** `HEADLESS` env var (headed is the config
default). If you previously exported `HEADLESS=1` in the shell, unset it first.

```powershell
Remove-Item Env:HEADLESS -ErrorAction SilentlyContinue   # PowerShell: make sure headless is OFF
npx playwright test test/<your-spec>.spec.ts --reporter=list
```

```bash
unset HEADLESS                                            # bash
npx playwright test test/<your-spec>.spec.ts --reporter=list
```

---

## 1. One-time / per-environment setup

- **Chromium present?** `npx playwright install chromium` (idempotent; skips if already there).
- **Working in a git worktree?** Junction the shared `node_modules` in so `npx`, `tsc` and
  `vite` resolve (PowerShell):
  ```powershell
  New-Item -ItemType Junction -Path "<worktree>\node_modules" -Target "<main-checkout>\node_modules"
  ```
- **Port 5173 must be free** before you run. Playwright auto-starts `npm run dev` on 5173 with
  `reuseExistingServer: true` — if a *foreign* dev server (another checkout/branch) is already
  squatting 5173, your tests will silently run against the **wrong code**. Check first:
  ```powershell
  Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue
  ```
  If it's taken by something that isn't *your* checkout's dev server, stop that server (or run
  your own `npm run dev` in this checkout first so the reuse picks up the right files).

You do **not** need to start `npm run dev` yourself — `playwright.config.ts` does it. Starting
it manually in *this* checkout beforehand is the safe way to guarantee the right code is served.

---

## 2. The boot trap (this is what bites every time)

**Do not drive the title/login screen.** The shared harness used to click
`#play → #nick-input → #nick-play`, but the login modal changed (it's now guest / login /
register — there is no `#nick-play`), so that path **hangs forever** waiting for a hidden
element. That stale flow was the "boot always fails" trap.

**What actually happens:** on `localhost` the game **auto-starts** with a fixed nickname (the
dev shortcut in `js/core/input.ts` — `onLocalhost` → `beginRun()`). So there is no UI to drive.
Just navigate and wait for the running game to report `started`:

```ts
await page.goto('/', { waitUntil: 'load' });
await page.waitForFunction(
  () => !!(window as any).render_game_to_text
        && JSON.parse((window as any).render_game_to_text()).started === true,
  null, { timeout: 60_000 });
```

The shared driver **`test/support/game.ts` already does exactly this** — its `boot()` was fixed
to use the auto-start. So the normal path is simply:

```ts
import { test, expect } from './support/game.ts';

test('my check', async ({ game }) => {     // `game` is booted for you (auto-start)
  const s = await game.snapshot();
  expect(s.started).toBe(true);
});
```

**Benign error to ignore:** `A user gesture is required to request Pointer Lock.` The auto-start
tries to lock the pointer before any click. It's harmless — filter it out of any
`pageerror` assertion (`if (!/Pointer Lock/i.test(e.message)) ...`). The fixed `boot()`
already filters it.

---

## 3. How you drive the game — the `window` hooks (dev only)

These are attached in `js/core/main.ts` and exist **only** on the dev server (`import.meta.env.DEV`),
which is exactly what the harness runs against. They are the only faithful seam — a
`page.evaluate(import('/js/...'))` gets a *separate* module instance and can't touch the live game.

| Hook | What it does |
| --- | --- |
| `render_game_to_text()` | Full JSON snapshot: `mode`, `money`, `wanted`, `player{x,y,z,heading}`, `vehicle`, `house`, `weedFarm`, `offroad`, every mini-game state, … |
| `advanceTime(ms)` | Steps the loop deterministically (`step(1/60)` per frame). Great for timers, respawns, economy, day/night — no real-time waiting. |
| `__test.enterCar()` | Teleports the player to the **nearest** car and enters it. |
| `__test.exitCar()` | Get out on foot. |
| `__test.placeVehicle(x,z,fx,fz)` | Teleport the current vehicle to `(x,z)` facing `(fx,fz)`, stopped — skip a cross-map drive to reach an activity. |
| `__test.interact()` | The context action (same as pressing **E**): enter/exit, start a race under a gate, pick up. |
| `__test.setKey(code,down)` / `clearKeys()` | Drive via the normalized key state (the real input pipeline). |
| `__test.raceTarget()` | Current race checkpoint world coords (for autopilots). |

The `GameDriver` in `test/support/game.ts` wraps the common ones: `snapshot()`, `enterCar()`,
`placeVehicle()`, `startRaceByKey()`, `driveRace()`, `down/up/tap` (real keyboard),
`waitForState()`, `inPage()`.

### Keyboard / menu gotchas
- **Focus-sensitive keys:** a real `page.keyboard.press('p')` can be swallowed depending on
  focus. For UI/menu keys, dispatch the event instead (focus-independent):
  ```ts
  await page.evaluate(() => document.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', bubbles: true })));
  ```
- **Pause menu** opens with **P** (`KeyP`). Its body is `#pause-body`.
- The **NPCS roster** lives under the **INFO** submenu: pause → `[data-act="info"]` →
  `[data-act="npcs"]` (it is *not* on the main pause menu).

---

## 4. Recipes (copy/paste, then adapt)

**Boot + assert state**
```ts
const s = await game.snapshot();
expect(s.started).toBe(true);
expect(s.mode).toBe('foot');
```

**Reach a far activity / item without driving there** — drive any car, teleport it, hop out.
Two gotchas, both about animations + live physics, so do the teleport→exit→advance as **one
synchronous `inPage` block**:
- `game.enterCar()` returns as soon as `mode==='car'`, but the **enter animation is still
  running** (`entering` is set during the door-close), and `exitCar()` *no-ops while `entering`
  is pending*. So **flush it with `advanceTime` first**.
- Headed runs physics live, so any `await` gap between `placeVehicle` and `exitCar` lets the car
  roll off a sloped spot. Keep them in one synchronous block.
```ts
await game.enterCar();
const r = await game.inPage(() => {
  const t = (window as any).__test, snap = () => JSON.parse((window as any).render_game_to_text());
  const before = snap().money;
  (window as any).advanceTime(1200);             // flush the enter animation (entering -> done)
  t.placeVehicle(590, -44, 600, -44);            // fresh teleport onto a rural cash stash
  t.exitCar();                                   // entering is clear -> the exit actually starts
  (window as any).advanceTime(1200);             // finish exit (lands ~2m beside the car) + collect
  return { before, after: snap().money, mode: snap().mode };
});
expect(r.mode).toBe('foot');
expect(r.after).toBeGreaterThan(r.before);
```

**Fast-forward a timer / respawn / economy window** — use `advanceTime` instead of sleeping:
```ts
await game.inPage(() => (window as any).advanceTime(122_000));   // ~122s of game time
```

**Seed persisted state before boot** (save files, owned property, garage car, …) with
`addInitScript` so it's in `localStorage` before any game script runs:
```ts
await page.addInitScript(() => localStorage.setItem('tinygta_property',
  JSON.stringify({ owned: true, car: { type: 'car', color: 0x2a6cff, name: 'GT', spoiler: 'gt' } })));
// ...then boot and assert via render_game_to_text().house
```

**Open a DOM panel / read the HUD**
```ts
await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', bubbles: true })));
await page.locator('#pause-body [data-act="info"]').click();
await page.locator('#pause-body [data-act="npcs"]').click();
await expect(page.locator('#pause-body .npc-filter-toggle')).toHaveText('SHOW FILTERS');
```

**Drive a full race** (always headed — headless throttling makes the autopilot wander):
```ts
await game.enterCar();
await game.placeVehicle(308, 0, 322, 99);     // under the off-road start gate
await game.startRaceByKey('offroad');
const r = await game.driveRace('offroad');
expect(r.finished).toBeTruthy();
```

---

## 5. What you CAN and CANNOT assert

- **CAN (machine-checkable):** game state via `render_game_to_text()`, money/economy, DOM
  panels & HUD, "boots with no runtime error", and deterministic flows via `__test` +
  `advanceTime`.
- **CANNOT (the human's eyes):** how things *look* and *feel* — model/character appearance,
  animations, camera, particle effects, the "feel" of a race line. For these: **run headed, the
  human watches, you describe what you observed** — but the final visual call is theirs.

---

## 6. Reference example

**`test/bugfixes.spec.ts`** is a complete, passing spec built on everything above (auto-start
boot with the Pointer-Lock filter, `__test` hooks, `advanceTime`, `localStorage` seeding, and a
DOM-panel assertion). Use it as the template for new runtime checks. Put new specs in
`test/*.spec.ts` and build on the shared harness — never one-off browser scripts.
