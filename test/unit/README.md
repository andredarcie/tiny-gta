# Unit tests (Vitest)

Fast, pure-logic unit tests that run in **Node** (no browser, no WebGL). They are
separate from the Playwright browser E2E specs (`test/*.spec.ts`), which drive the
real game in Chromium.

```bash
npm run test:unit         # run once
npm run test:unit:watch   # watch mode
```

- Files: `test/unit/**/*.test.ts` (config: `vitest.config.ts`).
- Target **pure / deterministic** modules — math, RNG, the world generator, the
  money ledger, etc. Import game modules with their `.js` specifier (Vitest maps
  `.js`→`.ts` like the build), e.g. `import { economy } from '../../js/economy.js'`.
- Anything that needs the DOM/WebGL or the live game loop belongs in a Playwright
  `*.spec.ts`, not here. (If a unit ever needs a light DOM, set that file's
  environment to `happy-dom`/`jsdom` via a `// @vitest-environment` comment.)
- `npm test` still runs the Playwright suite; `npm run test:unit` runs these.
