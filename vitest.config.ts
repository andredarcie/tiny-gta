import { defineConfig } from 'vitest/config';

// Unit tests (Vitest) — pure-logic, run in Node. SEPARATE from the Playwright
// browser E2E specs (test/**/*.spec.ts), which drive the real game in Chromium.
// Vitest reuses Vite's resolver, so it maps the codebase's `.js` import specifiers
// to their `.ts` sources exactly like the build does.
export default defineConfig({
  test: {
    environment: 'node',                       // pure logic; no DOM/WebGL here
    include: ['test/unit/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'test/**/*.spec.ts'],
  },
});
