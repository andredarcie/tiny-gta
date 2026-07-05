# Two-player online testing

Automated **headed** smoke suite that boots two real game windows against a
**local** multiplayer server and drives the shared-world pipeline end-to-end.
Complements `test/AGENT_LOCAL_TESTING.md` (single-player); read that first for
the boot trap and the `window` hooks.

## Run it

```bash
npm run test:online      # headed — two Chromium windows open, you watch them play
```

`playwright.online.config.ts` starts **both** servers for you (reusing any that
are already up):

- the Vite game on `http://localhost:5173`
- the multiplayer server (`wrangler dev`) on `http://localhost:8787` — the
  dev-build client auto-connects to `ws://localhost:8787/ws` (`js/net/online.ts`).

`HEADLESS=1` is **forbidden** here, same as the main harness: the human must
watch it, and headless Chromium throttles `requestAnimationFrame`, starving the
game loop and the online send tick.

The online spec is excluded from the default `npm test` (`testIgnore` in
`playwright.config.ts`) because it needs the `:8787` server — so run it only via
`npm run test:online`.

## What it covers (`test/two-player.online.spec.ts`)

| Test | Proves |
| --- | --- |
| connect + see each other | both join ONE shared world; each sees `remotes: 1`, `players: 2` |
| nicknames propagate | A sees B by name and vice-versa (identity round-trips) |
| ping measured | the HUD `ping` is a real keepalive round-trip, not a placeholder |
| melee PvP sync | A's fists → **server-decided** HP loss on B (client never self-reports a hit) → death syncs to A |
| live movement + vehicle sync | B sees A teleport to a waypoint **in a vehicle** (`vk != 0`), then keep moving as A drives |
| disconnect | closing B's window shrinks A's roster back to just itself |

## How it works

- **`test/support/online.ts`** — `bootOnlinePlayers(browser, nicks)` opens one
  browser **context** per nick (isolated `localStorage` → distinct
  `tinygta_pid`), seeds `tinygta_nick` before boot (the localhost auto-start
  adopts it — see `js/core/input.ts`), boots each with the single-player
  `GameDriver`, and waits until everyone has `phase: 'joined'` and sees the
  others. Reuse it for 3+ players by passing more nicks.
- Assertions read `render_game_to_text()`, which for the harness exposes two
  **dev-only** fields (they are inside the `if(DEBUG_HOOKS)` block, so they never
  ship to production):
  - `onlineRemotes` — each remote avatar's currently-rendered pose
    (`{id, nick, x, y, z, m, vk, dead, interior}`); this is how position /
    vehicle / death sync is asserted.
  - `health` — the local player's PvP HP.
- Two reusable `__test` hooks were added for deterministic PvP setup:
  `__test.teleport(x,z,fx,fz)` (foot analog of `placeVehicle`) and
  `__test.attack()` (one real weapon fire — a fist swing on foot).

## Adding a test

Put new online specs in `test/*.online.spec.ts` and build on
`bootOnlinePlayers`. Anything needing a value inside a `page.waitForFunction`
predicate must pass it as the arg (predicates run in the page — no closures).
