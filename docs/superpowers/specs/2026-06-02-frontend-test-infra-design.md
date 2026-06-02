# Frontend Test Infrastructure — Design Spec

**Issue:** #74  
**Date:** 2026-06-02  
**Status:** approved

---

## Context

Frontend currently has a placeholder `"test": "true"` script and zero tests. Issues #18 (Google login), #19 (create-book form), #20 (SSE), and #27 (admin dashboard) are queued. Without a test harness, each frontend feature is shipped without regression coverage.

---

## Stack decisions

| Concern | Choice | Rationale |
|---|---|---|
| Test runner | Vitest | ESM-native, fast, works with Next.js 16 App Router |
| React renderer | `@testing-library/react` | RTL standard, works with RSC wrappers |
| DOM environment | `happy-dom` | Lighter than jsdom, sufficient for component tests |
| Plugin | `@vitejs/plugin-react` | Well-documented Vitest + Next.js integration path |
| API mocking | MSW v2 (`http.*` API) | Current API, browser + Node hybrid support |
| E2E | Playwright | One smoke test, separate `test:e2e` script, not in `init.sh` |

Next.js-specific modules (`next/navigation`, `next/image`, etc.) are handled via `server.deps.inline: [/next/]` in vitest config + manual vi.mock() where needed per test.

---

## File layout

```
frontend/
├── vitest.config.ts
├── playwright.config.ts
├── tests/
│   ├── setup.ts              # RTL matchers + MSW lifecycle hooks
│   └── mocks/
│       └── handlers.ts       # MSW handler stubs (empty, ready to fill)
├── e2e/
│   └── smoke.spec.ts         # Playwright: page title check
└── src/
    └── app/
        ├── page.tsx
        └── page.test.tsx     # First real unit test (co-located)
```

Naming convention: all files and directories lowercase kebab-case.

---

## Configuration

### `vitest.config.ts`

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

`globals: true` lets tests use `describe/it/expect` without imports — consistent with Jest ergonomics the team knows.

### `playwright.config.ts`

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

Playwright starts the dev server automatically when `test:e2e` runs.

### `tests/setup.ts`

```ts
import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### `tests/mocks/handlers.ts` + `tests/mocks/server.ts`

MSW v2 requires a `server.ts` that instantiates `setupServer`. `handlers.ts` exports an empty array, ready to add per-feature handlers.

---

## `init.sh` change

Replace:
```bash
pnpm --filter frontend test --silent
```
With:
```bash
pnpm --filter frontend test --run --silent
```

`--run` exits after one pass (no watch mode). Playwright (`test:e2e`) is NOT added to `init.sh` — it requires a running server and is too slow for a smoke check.

---

## First real test

`src/app/page.test.tsx` — renders `<HomePage />`, asserts the heading and tagline text are present. This validates the full Vitest → RTL → happy-dom chain end-to-end.

---

## Out of scope

- Visual regression (Chromatic/Percy)
- Storybook
- Playwright critical-path scenario (added in #20)
- `test:e2e` in CI (separate workflow, needs server lifecycle)

---

## Dependencies to add (devDependencies)

```
vitest
@vitejs/plugin-react
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
happy-dom
msw
@playwright/test
```
