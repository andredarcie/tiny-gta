// Playwright config for FILMING short videos (see .claude/skills/record-video/SKILL.md).
// Kept apart from the test suite so `npm test` never runs a video scene. Portrait window
// (9:16) at 900x1600 — wide enough (>= 900 px) that the game keeps its desktop layout
// (no touch buttons / rotate-your-phone block), downscaled to 720x1280 by the assembler.
// Always headed, like every game run in this repo.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/video/scenes',
  testMatch: '**/*.video.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    headless: false,
    viewport: { width: 900, height: 1600 },
    deviceScaleFactor: 1,
    actionTimeout: 20_000,
    launchOptions: {
      args: [
        '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist',
        '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
    },
  },
  projects: [{ name: 'chromium' }],
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
