import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit tests for the multiplayer server (the Cloudflare Worker + WorldDO).
// Pure Node/Vitest: the DO is driven through minimal fakes for the handful of
// Workers-runtime APIs it touches (see test/setup.ts) — no workerd needed.
// Coverage is scoped to server/src and gated at 70%.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
});
