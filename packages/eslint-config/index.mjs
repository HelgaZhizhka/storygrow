/**
 * Shared ESLint base for every workspace package.
 *
 * `limits` enforces CLAUDE.md hard constraints 12–14 (#380): files ≤ 400 lines
 * (raw, what `wc -l` shows), functions ≤ 30 logic lines (blank and comment
 * lines do not count — a well-commented function is not a long one), ≤ 3
 * parameters (use an object-parameter). Packages narrow the per-function rule
 * where a function body is not logic (prompt text, JSX trees, test suites,
 * CLI mains) — each override carries its reason next to it.
 */

/** @type {import('eslint').Linter.Config} */
export const limits = {
  rules: {
    'max-lines': ['error', { max: 400, skipBlankLines: false, skipComments: false }],
    'max-lines-per-function': [
      'error',
      { max: 30, skipBlankLines: true, skipComments: true, IIFEs: true },
    ],
    'max-params': ['error', { max: 3 }],
  },
};

/** @type {import('eslint').Linter.Config[]} */
export const base = [
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  limits,
];
