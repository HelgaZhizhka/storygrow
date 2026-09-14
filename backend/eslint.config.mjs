// @ts-check
import { base } from '@storygrow/eslint-config';
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'src/generated/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  ...base,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'lf' }],
    },
  },
  {
    // The per-function limit is about logic. A prompt builder's body is the
    // prompt text; a test suite's body is its cases; an eval/seed script's
    // main is a sequence of steps that is run, not unit-tested. File size and
    // parameter count still apply everywhere (#380).
    files: ['src/ai/prompts/**/*.ts', 'src/scripts/**/*.ts', '**/*.spec.ts', 'test/**/*.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },
);
