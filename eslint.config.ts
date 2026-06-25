import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Flat ESLint config for the (now TypeScript) game. Focus: catch genuine bugs
// (undefined vars are handled by tsc/typescript-eslint; here we keep the high-signal
// correctness rules as errors and demote stylistic/migration noise to warnings so
// `npm run lint` stays useful rather than a wall of red). The build is Vite/esbuild;
// this is a separate quality gate.
export default tseslint.config(
  {
    ignores: [
      'dist/**', 'node_modules/**', 'android/**', 'backend/**', 'public/**',
      'fp-preview/**', 'comparacoes/**', 'output/**', '.playwright-mcp/**', '.claude/**',
      'studio.tsx', 'studio-pose.ts', 'player-inspect.ts', // dev-only tooling pages (CDN React / throwaway)
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      // genuine-bug rules: errors
      'no-empty': ['error', { allowEmptyCatch: true }], // the codebase uses `catch(e){}` widely
      'no-constant-condition': ['error', { checkLoops: false }], // `for(;;)` rejection-sampling is intentional
      // `a && a.m()` guarded calls and `cond ? f() : g()` dispatch are an idiom used all over
      // the game; allow them so the rule still flags genuinely dead bare expressions (`x;`, `a===b;`).
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true }],
      // stylistic / migration noise: warnings (do not fail the lint)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',       // a few pragmatic `any` remain at dynamic boundaries
      '@typescript-eslint/no-non-null-assertion': 'off', // `!` is used instead of adding runtime guards
      'prefer-const': 'warn',          // migration noise: `let` never reassigned; harmless, not a bug
      'no-useless-assignment': 'warn', // false-positives on do-while/loop-first initializers; harmless dead stores
      'eqeqeq': ['warn', 'smart'],
    },
  },
  {
    // Tests + tooling run under Node/Playwright, not the browser game loop.
    files: ['test/**', 'tools/**', 'scripts/**', '*.config.ts', 'portrait.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
