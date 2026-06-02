# Frontend Test Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Vitest + RTL + MSW v2 + Playwright for the Next.js 16 frontend so every subsequent feature issue (#18, #19, #20, #27) starts with a working test harness.

**Architecture:** Vitest with `@vitejs/plugin-react` and `happy-dom` handles unit/component tests; MSW v2 intercepts backend API calls in tests; Playwright runs a single smoke spec via a separate `test:e2e` script not wired into `init.sh`. Tests are co-located with source files (`src/app/page.test.tsx` next to `page.tsx`). Infrastructure files live in `frontend/tests/`.

**Tech Stack:** Vitest, @vitejs/plugin-react, @testing-library/react + jest-dom + user-event, happy-dom, msw v2, @playwright/test.

---

## File map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `frontend/vitest.config.ts` | Vitest entry point — plugin, env, globals, include glob |
| Modify | `frontend/tsconfig.json` | Add `vitest/globals` + `@testing-library/jest-dom` to `types` |
| Create | `frontend/tests/setup.ts` | RTL matchers import + MSW server lifecycle |
| Create | `frontend/tests/mocks/handlers.ts` | Empty MSW handler array (filled per feature) |
| Create | `frontend/tests/mocks/server.ts` | MSW node server wired to handlers |
| Create | `frontend/src/app/page.test.tsx` | First real unit test — validates full Vitest → RTL → happy-dom chain |
| Create | `frontend/playwright.config.ts` | Playwright config — testDir, baseURL, webServer auto-start |
| Create | `frontend/e2e/smoke.spec.ts` | Title check smoke test |
| Modify | `frontend/package.json` | Change `test` script from `true` to `vitest`; add `test:e2e` |
| Modify | `init.sh` | Add `--run` flag to frontend test invocation |

---

## Task 1: Create branch and install dependencies

**Files:** none (setup only)

- [ ] **Step 1: Create branch**

```bash
git switch -c issue/74-frontend-test-infra
```

- [ ] **Step 2: Install test devDependencies**

```bash
pnpm --filter frontend add -D \
  vitest \
  @vitejs/plugin-react \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  happy-dom \
  msw \
  @playwright/test
```

Expected: lockfile updated, no peer dep errors.

- [ ] **Step 3: Install Playwright browser binary**

```bash
pnpm --filter frontend exec playwright install chromium
```

Expected: Chromium downloaded to Playwright cache.

- [ ] **Step 4: Verify install**

```bash
pnpm --filter frontend exec vitest --version
pnpm --filter frontend exec playwright --version
```

Expected: both print version strings without error.

---

## Task 2: Write the first unit test (failing)

**Files:**
- Create: `frontend/src/app/page.test.tsx`

Write the test before any config exists — this establishes what the framework must support.

- [ ] **Step 1: Write `frontend/src/app/page.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage', () => {
  it('renders brand name', () => {
    render(<HomePage />);
    expect(screen.getByText('StoryGrow')).toBeInTheDocument();
  });

  it('renders main heading', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Персонализированные детские книги с возрастной адаптацией',
    );
  });
});
```

- [ ] **Step 2: Run — expect failure because config is missing**

```bash
pnpm --filter frontend exec vitest run
```

Expected: error — `Cannot find module 'vitest/config'` or similar. This confirms there is something to fix.

---

## Task 3: Create Vitest config and TypeScript types

**Files:**
- Create: `frontend/vitest.config.ts`
- Modify: `frontend/tsconfig.json`

- [ ] **Step 1: Create `frontend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        inline: [/next/],
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

`globals: true` — `describe/it/expect` available without imports.  
`server.deps.inline: [/next/]` — Vitest processes Next.js modules through its own bundler instead of requiring them as externals (avoids ESM/CJS mismatch from the Next.js package).

- [ ] **Step 2: Add types to `frontend/tsconfig.json`**

In `compilerOptions`, add a `"types"` array after `"paths"`:

```json
"paths": {
  "@/*": ["./src/*"]
},
"types": ["vitest/globals", "@testing-library/jest-dom"]
```

Full `compilerOptions` after the change:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "strict": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

---

## Task 4: Create MSW server and test setup

**Files:**
- Create: `frontend/tests/mocks/handlers.ts`
- Create: `frontend/tests/mocks/server.ts`
- Create: `frontend/tests/setup.ts`

- [ ] **Step 1: Create `frontend/tests/mocks/handlers.ts`**

```ts
import { RequestHandler } from 'msw';

export const handlers: RequestHandler[] = [];
```

Empty by design — each feature issue adds handlers here as needed.

- [ ] **Step 2: Create `frontend/tests/mocks/server.ts`**

```ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

- [ ] **Step 3: Create `frontend/tests/setup.ts`**

```ts
import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'warn'` — unhandled fetch calls print a warning (not a hard fail), which is safe while handlers are sparse.

---

## Task 5: Run tests — expect pass

**Files:** none

- [ ] **Step 1: Run Vitest**

```bash
pnpm --filter frontend exec vitest run
```

Expected output (2 tests, 1 file):
```
 ✓ src/app/page.test.tsx (2)
   ✓ HomePage > renders brand name
   ✓ HomePage > renders main heading

 Test Files  1 passed (1)
      Tests  2 passed (2)
```

If tests fail, fix before continuing. Common issues:
- `Cannot find module '@testing-library/jest-dom'` → check `tests/setup.ts` import
- `toBeInTheDocument is not a function` → `types` missing in tsconfig
- `Error: next/...` import → check `server.deps.inline: [/next/]` in vitest config

---

## Task 6: Playwright smoke test

**Files:**
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/smoke.spec.ts`

- [ ] **Step 1: Create `frontend/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

`reuseExistingServer` — if you already have `pnpm dev` running locally, Playwright reuses it instead of spawning a second one.

- [ ] **Step 2: Create `frontend/e2e/smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('home page has correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/StoryGrow/);
});
```

---

## Task 7: Update package.json scripts

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Update scripts in `frontend/package.json`**

Change `"test": "true"` → `"test": "vitest"`.  
Add `"test:e2e": "playwright test"`.

Final `scripts` block:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "lint:fix": "eslint --fix",
  "test": "vitest",
  "test:e2e": "playwright test"
}
```

`test` has no `run` — watch mode works locally with bare `pnpm test`. `init.sh` adds `--run` at call site (Task 8).

---

## Task 8: Update init.sh

**Files:**
- Modify: `init.sh` (line 44)

- [ ] **Step 1: Edit `init.sh` line 44**

Change:
```bash
run_in_pkg frontend test --silent
```

To:
```bash
run_in_pkg frontend test --run --silent
```

`--run` tells Vitest to exit after one pass instead of entering watch mode. Without it, `init.sh` would hang waiting for file changes.

---

## Task 9: Verify init.sh and commit

**Files:** none

- [ ] **Step 1: Run full smoke check**

```bash
./init.sh
```

Expected: all steps green including `frontend test --run --silent` showing 2 tests passed.

- [ ] **Step 2: Check TypeScript is happy with test files**

```bash
pnpm --filter frontend exec tsc --noEmit
```

Expected: no errors. If `describe/it/expect` show as undefined, the `"types": ["vitest/globals"]` in tsconfig isn't being picked up — double-check the JSON is valid.

- [ ] **Step 3: Commit**

```bash
git add \
  frontend/vitest.config.ts \
  frontend/playwright.config.ts \
  frontend/tsconfig.json \
  frontend/package.json \
  frontend/tests/setup.ts \
  frontend/tests/mocks/handlers.ts \
  frontend/tests/mocks/server.ts \
  frontend/src/app/page.test.tsx \
  frontend/e2e/smoke.spec.ts \
  init.sh \
  pnpm-lock.yaml
git commit -m "feat(frontend): test infra — Vitest + RTL + MSW + Playwright (#74)"
```

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin issue/74-frontend-test-infra
gh pr create \
  --title "feat(frontend): test infrastructure — Vitest + RTL + MSW + Playwright" \
  --body "Closes #74

## Summary
- Vitest + happy-dom for component unit tests
- @testing-library/react + jest-dom matchers
- MSW v2 node server wired in global setup (handlers empty, ready per feature)
- Playwright smoke spec (page title check)
- init.sh now runs \`vitest --run\` instead of placeholder \`true\`
- First real unit test on HomePage validates the full chain

## Test plan
- [ ] \`./init.sh\` green (2 frontend unit tests pass)
- [ ] \`pnpm --filter frontend exec tsc --noEmit\` — no type errors in test files
"
```

- [ ] **Step 5: Merge after CI is green**

```bash
gh pr merge --squash --delete-branch
```

---

## Self-review

**Spec coverage:**
- ✅ `vitest.config.ts` — Task 3
- ✅ `playwright.config.ts` — Task 6
- ✅ `tests/setup.ts` — Task 4
- ✅ `tests/mocks/handlers.ts` — Task 4
- ✅ `e2e/smoke.spec.ts` — Task 6
- ✅ `init.sh` updated — Task 8
- ✅ Unit test on `page.tsx` — Task 2
- ✅ `test:e2e` script — Task 7
- ✅ `test` script replaces `true` — Task 7

**Placeholder scan:** No TBD, no "implement later", all steps have exact code.

**Type consistency:** `server` exported from `tests/mocks/server.ts`, imported in `tests/setup.ts` — consistent. `handlers` typed as `RequestHandler[]` — used with spread in `setupServer(...handlers)` — correct MSW v2 API.
