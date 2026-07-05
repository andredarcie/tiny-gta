import { defineConfig } from '@playwright/test';

// ============================================================================
// Headed config for the TWO-PLAYER online tests (test/*.online.spec.ts).
//
// Unlike the default playwright.config.ts, this one ALSO starts the local
// multiplayer server (the Cloudflare Worker via `wrangler dev` on :8787), so
// the two game windows share one real world. The dev-build client auto-connects
// to ws://localhost:8787/ws (js/net/online.ts).
//
// HEADLESS IS FORBIDDEN here for the same reasons as the main harness (see
// test/AGENT_LOCAL_TESTING.md): the human must watch it, and headless Chromium
// throttles requestAnimationFrame, which starves the game loop / online send
// tick. Always run headed — `npm run test:online`.
// ============================================================================
const headless = process.env.HEADLESS === '1';

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.online.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,        // two windows booting + real-time online round-trips
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 25_000,
    trace: 'retain-on-failure',
    launchOptions: {
      args: [
        '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist',
        // keep both game loops running full speed even when a window isn't focused
        '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
    },
  },
  projects: [{ name: 'chromium' }],
  // Start BOTH servers; reuse either if it is already up (so a manually-started
  // `npm run dev` / `npm run dev:server` is picked up instead of double-spawned).
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev:server',
      url: 'http://localhost:8787/health',
      env: { WRANGLER_SEND_METRICS: 'false' },
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
