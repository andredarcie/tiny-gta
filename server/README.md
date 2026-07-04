# tiny-gta-mp — multiplayer server (Cloudflare Workers + Durable Objects)

The shared-world presence server: **one** Durable Object (`WorldDO`, name
`world`) holds every online player. No rooms — when the world is full
(`MAX_PLAYERS`, default 32), new joiners receive `{t:'full'}` and the game
silently keeps playing offline.

Movement v1 (current increment): clients report their pose (`pos` messages,
≤10/s, only while moving); the DO validates/clamps and rebroadcasts compact
snapshots at 10 Hz. The wire protocol lives in `../shared/net/protocol.ts`
(shared with the browser client and unit-tested in `test/unit/`). Later
increments move toward the full authoritative simulation described in
`../ONLINE_MULTIPLAYER_PLAN.md`.

## Commands

```bash
npm install                  # once (wrangler + workers-types)
npm run dev                  # local server at ws://localhost:8787/ws (miniflare)
npm run typecheck            # tsc with workers types (root typecheck skips server/)
npm run deploy               # wrangler deploy → https://tiny-gta-mp.<account>.workers.dev
```

The Vite game in dev (`npm run dev` at the repo root) connects to
`ws://localhost:8787/ws` automatically; production builds connect to the
deployed workers.dev URL (see `js/net/online.ts`). Override with
`?mpserver=ws://...` or disable with `?mp=off`.

## Free-tier notes

- DO classes must be SQLite-backed on the free plan (`new_sqlite_classes`).
- Incoming WS messages bill 20:1; outgoing broadcasts are free. Keepalive
  ping/pong is served by `setWebSocketAutoResponse` (free, no DO wake-up).
- The broadcast interval stops after 30 s with nobody moving and the DO
  hibernates (duration billing stops) while sockets stay connected; poses are
  parked in storage and restored on wake.
- Budget headline: ~2M incoming messages/day ≈ 55 player-hours of continuous
  movement per day. If the daily cap is hit, sockets drop and every client
  falls back to offline play until the 00:00 UTC reset — by design.
