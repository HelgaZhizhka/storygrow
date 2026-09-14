import { base } from '@storygrow/eslint-config';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...base,
  {
    // A component's body is its JSX tree, not logic; the per-function limit
    // stays on plain .ts modules (hooks, helpers, API clients). File size and
    // parameter count apply everywhere (#380).
    files: ['**/*.tsx'],
    rules: { 'max-lines-per-function': 'off' },
  },
  {
    // A test suite's body is its cases.
    files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**/*.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
