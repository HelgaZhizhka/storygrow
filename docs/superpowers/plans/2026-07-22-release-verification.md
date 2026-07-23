# Release Verification Implementation Plan (#155)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `verify.sh` release-health check (backend/frontend builds, Docker builds, Prisma migration drift, one authenticated Playwright happy-path through real fast-flow book generation) that runs on merge to `main`, closing gaps `./init.sh` (tsc + lint + unit tests only) never catches.

**Architecture:** A new `POST /auth/test-login` backend endpoint (double-gated, never active in production) issues real JWTs for a fixture user without going through Google OAuth. A new Playwright spec drives that token through a real browser session to create a fast-flow book and confirm its PDF becomes available. `verify.sh` orchestrates builds, Docker builds, a Prisma drift check, service/seed setup, and that Playwright run. A new CI job invokes it only on `push: [main]`, keeping `./init.sh`'s per-PR gate fast and cheap.

**Tech Stack:** NestJS, Next.js, Prisma, Playwright (already a frontend devDependency), Docker, GitHub Actions.

## Global Constraints

- No `any`. No new npm dependencies beyond what's already installed (Playwright is already present).
- `./init.sh` is NOT modified by this plan — it stays the fast per-PR gate exactly as today.
- `POST /auth/test-login` must refuse with a 404 (not 403/401 — deliberately don't confirm the route exists) unless BOTH: `E2E_TEST_MODE` env var is exactly `'true'`, AND `NODE_ENV` is NOT `'production'`. Neither check alone is sufficient — this is deliberate defense-in-depth (a single-flag dependency was exactly how #289's production cookie bug happened).
- The e2e flow uses fast-flow book creation (cheap, synchronous, one LLM call) — never custom-flow (multi-stage, judge/retry loop, materially more expensive and slower).
- The new CI job runs only on `push: [main]`, never on `pull_request` — this check needs a live Postgres/Redis/MinIO stack and makes one real OpenAI API call, so it must not run on every PR push.
- Functions ≤30 lines, ≤3 params; files ≤400 lines; no index-as-key in dynamic lists (not touched by this plan, but don't introduce any).

---

### Task 1: `POST /auth/test-login` backend endpoint

**Files:**
- Modify: `backend/src/auth/auth.controller.ts`
- Modify: `backend/src/auth/auth.controller.spec.ts`

**Interfaces:**
- Consumes: `AuthService.validateOrCreateUser` and `AuthService.generateTokens` (both already exist, unchanged).
- Produces: `POST /auth/test-login` → `{ accessToken: string; refreshToken: string }` when enabled, `404` otherwise — consumed by Task 2 (the Playwright spec calls this directly via HTTP, not through any frontend code).

- [ ] **Step 1: Write the failing tests**

The current `mockConfig` in `backend/src/auth/auth.controller.spec.ts` is a fixed closure:

```ts
const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'FRONTEND_URL') return 'http://localhost:3000';
    if (key === 'NODE_ENV') return 'test';
    return undefined;
  }),
};
```

Replace it with a mutable map so individual tests can override `NODE_ENV`/`E2E_TEST_MODE` without touching every other test's setup:

```ts
const configValues: Record<string, string | undefined> = {
  FRONTEND_URL: 'http://localhost:3000',
  NODE_ENV: 'test',
};

const mockConfig = {
  get: jest.fn((key: string) => configValues[key]),
};
```

In the shared `beforeEach`, right after `jest.clearAllMocks();`, reset the two keys this task cares about so no test's override leaks into the next:

```ts
  beforeEach(async () => {
    jest.clearAllMocks();
    configValues.NODE_ENV = 'test';
    configValues.E2E_TEST_MODE = undefined;
    const module = await Test.createTestingModule({
```

(Only that one line changes inside `beforeEach` — the rest of the existing `Test.createTestingModule({...})` block is untouched.)

Add `validateOrCreateUser` to `mockAuth`:

```ts
const mockAuth = {
  generateTokens: jest.fn<Promise<TokenPair>, [string, string, string]>(),
  exchangeRefreshToken: jest.fn<Promise<TokenPair>, [string]>(),
  logout: jest.fn<Promise<void>, [string]>(),
  validateOrCreateUser: jest.fn(),
};
```

Add a new `describe` block at the end of the file, after the existing `describe('sseTicket', ...)` block, before the final closing `});`:

```ts
  describe('testLogin', () => {
    const fixtureUser = { id: 'e2e-user-1', email: 'e2e-test@storygrow.test', role: 'user' as const };

    it('issues real tokens for the fixture user when E2E_TEST_MODE is enabled outside production', async () => {
      configValues.E2E_TEST_MODE = 'true';
      mockAuth.validateOrCreateUser.mockResolvedValueOnce(fixtureUser);
      mockAuth.generateTokens.mockResolvedValueOnce(tokens);

      const result = await controller.testLogin();

      expect(mockAuth.validateOrCreateUser).toHaveBeenCalledWith({
        googleId: 'e2e-test-fixture',
        email: 'e2e-test@storygrow.test',
      });
      expect(mockAuth.generateTokens).toHaveBeenCalledWith(
        fixtureUser.id,
        fixtureUser.email,
        fixtureUser.role,
      );
      expect(result).toEqual(tokens);
    });

    it('throws NotFoundException when E2E_TEST_MODE is not set', async () => {
      configValues.E2E_TEST_MODE = undefined;

      await expect(controller.testLogin()).rejects.toThrow(NotFoundException);
      expect(mockAuth.validateOrCreateUser).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when NODE_ENV is production, even if E2E_TEST_MODE is true', async () => {
      configValues.E2E_TEST_MODE = 'true';
      configValues.NODE_ENV = 'production';

      await expect(controller.testLogin()).rejects.toThrow(NotFoundException);
      expect(mockAuth.validateOrCreateUser).not.toHaveBeenCalled();
    });
  });
```

Add `NotFoundException` to the existing import line:

```ts
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter backend test -- auth.controller
```

Expected: FAIL — `controller.testLogin is not a function`, and the pre-existing tests should still pass (the `configValues` refactor is behavior-preserving for them — confirm this in the output, don't just skim for the new failures).

- [ ] **Step 3: Implement**

In `backend/src/auth/auth.controller.ts`, add `NotFoundException` to the existing import:

```ts
import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
```

Add two new constants near the top of the file, alongside the existing `REFRESH_COOKIE_NAME`/`REFRESH_COOKIE_MAX_AGE_MS`:

```ts
const REFRESH_COOKIE_NAME = 'sg_refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const E2E_TEST_GOOGLE_ID = 'e2e-test-fixture';
const E2E_TEST_EMAIL = 'e2e-test@storygrow.test';
```

Add the new endpoint, right after `sseTicket` (which currently ends with `return { ticket: this.tickets.issue(user) }; }`), before the private `setRefreshCookie` method:

```ts
  /**
   * Bypasses Google OAuth for release-verification e2e (#155) — double-gated so
   * it can never activate in production even if one check is misconfigured
   * (the exact single-flag failure mode that caused #289's cookie bug).
   */
  @Post('test-login')
  @HttpCode(HttpStatus.OK)
  async testLogin(): Promise<{ accessToken: string; refreshToken: string }> {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new NotFoundException();
    }
    if (this.config.get<string>('E2E_TEST_MODE') !== 'true') {
      throw new NotFoundException();
    }

    const user = await this.auth.validateOrCreateUser({
      googleId: E2E_TEST_GOOGLE_ID,
      email: E2E_TEST_EMAIL,
    });
    return this.auth.generateTokens(user.id, user.email, user.role);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter backend test -- auth.controller
```

Expected: PASS, 10/10 (7 pre-existing + 3 new).

- [ ] **Step 5: Verify the whole backend**

```bash
pnpm --filter backend exec tsc --noEmit
pnpm --filter backend lint
```

Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/auth.controller.ts backend/src/auth/auth.controller.spec.ts
git commit -m "feat(auth): add double-gated test-login endpoint for release verification (#155)"
```

---

### Task 2: Playwright e2e spec — authenticated fast-flow book creation

**Files:**
- Modify: `frontend/playwright.config.ts`
- Create: `frontend/e2e/create-book.spec.ts`

**Interfaces:**
- Consumes: `POST /auth/test-login` (Task 1).
- Produces: `pnpm --filter frontend exec playwright test e2e/create-book.spec.ts` — consumed by Task 3 (`verify.sh` invokes this command).

**Design note, stated explicitly (not a silent deviation from the earlier-approved design doc):** the design spec's own reasoning for skipping the child-creation UI form ("direct API call is faster and this test's purpose is the generation pipeline, not the child-creation form") applies identically to the book-creation form — `frontend/src/app/(app)/books/new/page.tsx` is a 368-line, multi-field, actively-evolving form, and driving it via brittle Playwright selectors would test form UX (better covered by cheaper unit/component tests) rather than the generation pipeline this check exists to validate. Both child and book creation happen via direct API calls in this spec. The test still drives a REAL page load in a real browser afterward — navigating to the finished book's detail page and asserting the real "Скачать PDF" button renders — so it isn't a pure backend test wearing a Playwright costume; it exercises real frontend rendering code for the one page whose correctness this check cares about (does the app actually show the user their finished book).

- [ ] **Step 1: Enable reusing an already-running frontend server**

`frontend/playwright.config.ts` currently:

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

Change only the `reuseExistingServer` line — `verify.sh` (Task 3) starts a production-built server itself before invoking Playwright, and needs Playwright to reuse it rather than spawn a second `pnpm dev` on the same port:

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
    reuseExistingServer: !process.env.CI || process.env.PW_REUSE_SERVER === 'true',
  },
});
```

- [ ] **Step 2: Write the spec**

`frontend/e2e/create-book.spec.ts`:

```ts
import { test, expect, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface TestLoginResponse {
  accessToken: string;
  refreshToken: string;
}

interface Child {
  id: string;
}

interface LearningGoal {
  id: string;
  title: string;
}

interface FastFlowBook {
  bookId: string;
  pdfKey: string;
}

async function apiPost<T>(
  request: APIRequestContext,
  path: string,
  accessToken: string | null,
  data: unknown,
): Promise<T> {
  const res = await request.post(`${API_URL}${path}`, {
    data,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  expect(res.ok(), `POST ${path} failed: ${res.status()} ${await res.text()}`).toBe(true);
  return res.json() as Promise<T>;
}

async function apiGet<T>(
  request: APIRequestContext,
  path: string,
  accessToken: string,
): Promise<T> {
  const res = await request.get(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(res.ok(), `GET ${path} failed: ${res.status()} ${await res.text()}`).toBe(true);
  return res.json() as Promise<T>;
}

test('logs in, creates a fast-flow book, and the finished book page shows a PDF download button', async ({
  page,
  request,
}) => {
  const { accessToken } = await apiPost<TestLoginResponse>(request, '/auth/test-login', null, {});

  const child = await apiPost<Child>(request, '/children', accessToken, {
    name: 'E2E Тест',
    age: 5,
  });

  const goals = await apiGet<LearningGoal[]>(
    request,
    `/learning-goals?childId=${child.id}`,
    accessToken,
  );
  const goal = goals.find((g) => g.title.includes('Делиться'));
  expect(goal, 'seeded "Делиться с другими" learning goal (has a fast-flow Template) not found').toBeDefined();

  const book = await apiPost<FastFlowBook>(request, '/books', accessToken, {
    childId: child.id,
    learningGoalId: goal!.id,
    mode: 'fast',
  });
  expect(book.pdfKey).toBeTruthy();

  await page.addInitScript((token: string) => {
    window.localStorage.setItem('sg_access_token', token);
  }, accessToken);

  await page.goto(`/books/${book.bookId}`);
  await expect(page.getByRole('button', { name: 'Скачать PDF' })).toBeVisible();
});
```

- [ ] **Step 3: Verify locally**

This step genuinely exercises the new code — unlike most plan tasks, this one's real test IS running it end-to-end, so do not skip it even though it needs live infrastructure.

Prerequisites: `docker compose up -d postgres redis minio minio-create-buckets` running, `backend/.env` with a real `OPENAI_API_KEY`, migrations applied (`pnpm --filter backend prisma:migrate` or `prisma migrate deploy`), and the seed scripts run once (`pnpm --filter backend seed:learning-goals && pnpm --filter backend seed:templates && pnpm --filter backend seed:illustrations`).

In one terminal:

```bash
E2E_TEST_MODE=true pnpm --filter backend start:prod
```

(If `backend/dist` doesn't exist yet, run `pnpm --filter backend build` first.)

In a second terminal:

```bash
pnpm --filter frontend build && pnpm --filter frontend start
```

In a third terminal:

```bash
PW_REUSE_SERVER=true pnpm --filter frontend exec playwright test e2e/create-book.spec.ts
```

Expected: 1 passed. This makes one real `gpt-4o-mini` call (fast-flow's `GENERATION_MODEL`) — costs a few cents, takes well under the "1-2 minutes" the app's own UI copy quotes for the full custom-flow pipeline, since fast-flow skips the judge/retry loop entirely.

If it fails, read the failure message before assuming the test is wrong — this is the first time this exact flow has been exercised through a real browser, and a genuine app bug is equally as likely as a test-authoring mistake.

- [ ] **Step 4: Confirm the existing e2e smoke test is unaffected**

```bash
pnpm --filter frontend exec playwright test e2e/smoke.spec.ts
```

Expected: still 1 passed — this plan is additive, `smoke.spec.ts` is untouched.

- [ ] **Step 5: Commit**

```bash
git add frontend/playwright.config.ts frontend/e2e/create-book.spec.ts
git commit -m "test(e2e): authenticated fast-flow book creation happy-path (#155)"
```

---

### Task 3: `verify.sh` — builds, Docker builds, Prisma drift, orchestrated e2e run

**Files:**
- Create: `verify.sh` (repo root, alongside the existing `init.sh`)

**Interfaces:**
- Consumes: `POST /auth/test-login` (Task 1), `frontend/e2e/create-book.spec.ts` (Task 2).
- Produces: an executable script exiting 0 on success — consumed by Task 4 (the new CI job invokes it directly, the same way `ci.yml`'s existing job invokes `./init.sh`).

- [ ] **Step 1: Write the script**

`verify.sh` (make executable: `chmod +x verify.sh` after creating it):

```bash
#!/usr/bin/env bash
# StoryGrow release verification — builds, Docker builds, Prisma drift, and one
# authenticated e2e happy-path. Heavier and slower than init.sh (which stays the
# fast per-PR gate) — this runs only on merge to main (#155).
#
# Requires: Docker, a real OPENAI_API_KEY in the environment.
# Exits 0 on success. Non-zero on any failure.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

log() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
pass() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }

: "${OPENAI_API_KEY:?OPENAI_API_KEY must be set}"
: "${DATABASE_URL:?DATABASE_URL must be set}"

BACKEND_PID=""
FRONTEND_PID=""
cleanup() {
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

log "Backend build"
pnpm --filter backend build
pass "backend build"

log "Frontend build"
pnpm --filter frontend build
pass "frontend build"

log "Docker build: backend"
docker build -f backend/Dockerfile -t storygrow-backend-verify .
pass "backend Docker build"

log "Docker build: frontend"
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001}" \
  -t storygrow-frontend-verify .
pass "frontend Docker build"

log "Docker Compose services (postgres, redis, minio)"
docker compose up -d --wait postgres redis minio
pass "services healthy"

log "MinIO bucket init"
# minio-create-buckets is a one-shot job (exits 0 on success) -- `--wait` treats
# an exited container as unhealthy, so it can't be in the --wait list above.
# Running it without -d blocks until it actually exits, same effect.
docker compose up minio-create-buckets
pass "buckets ready"

log "Prisma migrate deploy"
pnpm --filter backend exec prisma migrate deploy
pass "migrations applied"

log "Prisma drift check"
DRIFT_SQL=$(pnpm --filter backend exec prisma migrate diff \
  --from-config-datasource \
  --to-schema=prisma/schema.prisma \
  --script)
# The pgvector HNSW index lives outside migration history by design (schema.prisma
# can't express `USING hnsw (...)` — see backend/prisma/migrate-dev.mjs) — any DB
# that has it (every dev DB that's run `pnpm --filter backend db:hnsw-index`, and
# production) always "diffs" on exactly this one DROP INDEX statement. Treat that
# specific line as expected; anything else is genuine, unintended drift.
UNEXPECTED=$(echo "$DRIFT_SQL" | grep -v '^--' | grep -v '^$' \
  | grep -v '^DROP INDEX "VocabularyEntry_embedding_hnsw_idx";$' || true)
if [ -n "$UNEXPECTED" ]; then
  echo "$DRIFT_SQL"
  echo "Unexpected schema drift detected (beyond the known HNSW-index exception)."
  exit 1
fi
pass "no unexpected schema drift"

log "Seed reference data"
pnpm --filter backend seed:learning-goals
pnpm --filter backend seed:templates
pnpm --filter backend seed:illustrations
pass "seeded"

log "Start backend (test mode)"
E2E_TEST_MODE=true pnpm --filter backend start:prod &
BACKEND_PID=$!
for _ in $(seq 1 30); do
  curl -sf http://localhost:3001/health >/dev/null && break
  sleep 1
done
curl -sf http://localhost:3001/health >/dev/null
pass "backend up"

log "Start frontend"
pnpm --filter frontend start &
FRONTEND_PID=$!
for _ in $(seq 1 30); do
  curl -sf http://localhost:3000 >/dev/null && break
  sleep 1
done
curl -sf http://localhost:3000 >/dev/null
pass "frontend up"

log "Authenticated e2e: create-book"
PW_REUSE_SERVER=true pnpm --filter frontend exec playwright test e2e/create-book.spec.ts
pass "e2e passed"

log "Release verification PASSED"
```

- [ ] **Step 2: Run it locally**

```bash
chmod +x verify.sh
OPENAI_API_KEY=<your real key> DATABASE_URL=postgresql://storygrow:storygrow@localhost:5432/storygrow NEXT_PUBLIC_API_URL=http://localhost:3001 ./verify.sh
```

Expected: `Release verification PASSED`, exit 0. This is the real test for this task — every step above either already has its own verification (builds/Docker builds are self-verifying — they fail loudly) or was already proven working in Task 2's Step 3. This run additionally proves the ORCHESTRATION (script wiring, cleanup trap, health-check polling) works end-to-end as one script, not just as separately-run manual steps.

If the Docker build steps are slow locally and you've already confirmed the app builds/runs correctly (Task 2's Step 3), it's acceptable to run this once fully, then iterate on script wording changes without re-running the full Docker builds each time — but the LAST run before marking this task done must be a complete, unmodified, start-to-finish `./verify.sh` execution.

- [ ] **Step 3: Commit**

```bash
git add verify.sh
git commit -m "feat(ci): add verify.sh — builds, Docker builds, Prisma drift, authenticated e2e (#155)"
```

---

### Task 4: Wire `verify.sh` into a new CI job (push to `main` only)

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `verify.sh` (Task 3).

- [ ] **Step 1: Add the new job**

`.github/workflows/ci.yml` currently has one job, `init`. Add a second job, `verify`, after it (same file, top-level `jobs:` key gets a second entry):

```yaml
  verify:
    name: ./verify.sh
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: pgvector/pgvector:pg17
        env:
          POSTGRES_USER: storygrow
          POSTGRES_PASSWORD: storygrow
          POSTGRES_DB: storygrow
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U storygrow"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5

      - name: Setup pnpm
        uses: pnpm/action-setup@d15e628ca66d93ee5f352c71671a7bc6a97af5c9
        with:
          version: 10.29.3
          run_install: false

      - name: Setup Node
        uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        env:
          DATABASE_URL: postgresql://storygrow:storygrow@localhost:5432/storygrow

      - name: Install Playwright browsers
        run: pnpm --filter frontend exec playwright install --with-deps chromium

      - name: Release verification
        run: ./verify.sh
        env:
          DATABASE_URL: postgresql://storygrow:storygrow@localhost:5432/storygrow
          REDIS_URL: redis://localhost:6379
          S3_ENDPOINT: http://localhost:9100
          S3_ACCESS_KEY: storygrow
          S3_SECRET_KEY: storygrow-dev-secret
          S3_BUCKET: storygrow
          NEXT_PUBLIC_API_URL: http://localhost:3001
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GOOGLE_CLIENT_ID: dummy-e2e-value
          GOOGLE_CLIENT_SECRET: dummy-e2e-value
          GOOGLE_CALLBACK_URL: http://localhost:3001/auth/google/callback
          JWT_SECRET: e2e-verify-jwt-secret
          JWT_REFRESH_SECRET: e2e-verify-jwt-refresh-secret
          FRONTEND_URL: http://localhost:3000
          STRIPE_SECRET_KEY: sk_test_dummy
          STRIPE_WEBHOOK_SECRET: whsec_dummy
          STRIPE_PRICE_ID: price_dummy
          EVAL_THRESHOLD: '7.0'
          EVAL_MAX_RETRIES: '2'
```

Notes on this job, for the implementer's own understanding (not to be added as YAML comments — keep the file matching the terse style of the existing `init` job):

- This job uses GitHub Actions' built-in `services:` for Postgres only, rather than `docker compose up` for everything, because `docker compose` inside a `services:`-having job would try to bind the SAME `5432` port the `services:` block already owns — simpler to let Actions manage Postgres natively and have `verify.sh`'s own `docker compose up -d --wait postgres redis minio` + `docker compose up minio-create-buckets` bring up ONLY redis/minio (Postgres is already running and already satisfies `pg_isready`, so Compose's own Postgres health check for that service will pass instantly against the Actions-managed instance — as long as the container names/ports don't collide, which they don't since Actions' `services:` Postgres doesn't run inside `docker compose`'s own project namespace). If this collision reasoning turns out wrong when actually run (Step 2 will reveal it), the simpler fix is dropping the `services:` block entirely and letting `verify.sh`'s own `docker compose up -d --wait postgres redis minio` + `docker compose up minio-create-buckets` bring up Postgres too — prefer that fallback over debugging a genuine port conflict.
- The dummy `GOOGLE_CLIENT_ID`/`STRIPE_SECRET_KEY`/etc. values exist only so `ConfigService.getOrThrow` doesn't crash the app at boot — none of these providers are actually called by the fast-flow e2e path, so their values never need to be real.
- `OPENAI_API_KEY` is the one REAL secret this job needs — it must be added to the repository's GitHub Actions secrets (Settings → Secrets and variables → Actions) before this job can pass. **This is a manual step outside this plan's code changes** — flag it to the user rather than assuming it's already configured, the same way Stripe/webhook secrets needed manual setup earlier in this project.

- [ ] **Step 2: Verify the YAML is well-formed**

```bash
pnpm exec -- node -e "require('js-yaml') ? '' : ''" 2>/dev/null || true
python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>/dev/null && echo "YAML valid" || echo "install a YAML linter or eyeball it carefully — this repo has no YAML lint tool wired in"
```

This is best-effort — if neither check runs (no `js-yaml`/`python3` yaml module available), carefully re-read the diff for indentation correctness instead; a malformed workflow file fails silently (GitHub just won't show the job) rather than with a clear error, so it's worth double-checking by eye if the automated check isn't available.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run verify.sh on push to main (#155)"
```

**Note for the controller (not a task step — this cannot be verified until the branch merges):** this job will only actually execute once this PR merges to `main` (its own trigger is `push: main`, so it never runs on the PR itself). Task 6 below records this as a known gap in this plan's own verification and asks the user to confirm the job goes green after merge.

---

### Task 5: Add `OPENAI_API_KEY` GitHub Actions secret (manual, user-only step)

**This is not a code task — no files change.** Flag it clearly and wait for confirmation before Task 4's CI job can ever pass:

- [ ] Ask the user to add `OPENAI_API_KEY` (a real, working OpenAI key — can be the same one already in Railway/local `.env`, or a separate key scoped for CI usage if they prefer to track spend separately) to the repository's GitHub Actions secrets: **Settings → Secrets and variables → Actions → New repository secret**, name `OPENAI_API_KEY`.
- [ ] Confirm with the user this is done before treating Task 4's CI job as verified — the plan's own `Task 4, Step 2` YAML check only confirms the file parses, not that the job will actually succeed at runtime without this secret.

---

### Task 6: Full verification and progress log

**Files:**
- Modify: `progress.md`

- [ ] **Step 1: Run the full smoke check**

```bash
./init.sh
```

Expected: `Smoke check PASSED` — confirms this plan's changes didn't break the existing fast gate.

- [ ] **Step 2: Add a progress.md entry**

Summarize: #155 shipped (`verify.sh` — builds, Docker builds, Prisma drift check, one authenticated Playwright e2e via a new double-gated `POST /auth/test-login` endpoint); runs only on push to `main`, not every PR, for cost/speed reasons; explicitly note the OPENAI_API_KEY GitHub Actions secret is a manual step the user must complete (Task 5) before the new CI job can pass, and that the job's actual success can only be confirmed after this PR merges (its trigger is push-to-main, so it can't run against its own PR) — this is a known, unavoidable verification gap for this specific plan, not an oversight.

- [ ] **Step 3: Commit**

```bash
git add progress.md
git commit -m "docs(progress): session entry — #155 release verification"
```
