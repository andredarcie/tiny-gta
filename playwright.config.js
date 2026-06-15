import { defineConfig } from '@playwright/test';

// Browser test config for Tiny GTA. Tests drive the REAL game in a REAL Chromium
// (real WebGL, real game loop) — see test/support/game.js for the driver and
// test/README or the repo README for how to write a test.
//
// Run headed (a window opens, you watch the AI play) by default — that is the
// faithful, intended mode. Set HEADLESS=1 to run without a window (CI / agents
// on a machine with no display):  HEADLESS=1 npx playwright test
const headless = process.env.HEADLESS === '1';

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.js',
  fullyParallel: false,    // the game is a singleton page; run specs serially
  workers: 1,
  retries: 0,
  timeout: 180_000,        // a full race playthrough runs in real time
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    // Uncap FPS so real-time playthroughs run as fast as the machine allows
    // (mirrors .claude/skills/perf-optimize/measure.mjs).
    launchOptions: {
      args: [
        '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist',
        // keep the game loop (requestAnimationFrame) running at full speed even
        // when the window isn't focused — otherwise countdowns/physics stall
        '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
    },
  },
  projects: [{ name: 'chromium' }],
  // Auto-start the Vite dev server for the tests and reuse one if already up.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
