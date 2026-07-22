# Release Verification Design (#155)

## Goal

`./init.sh` runs tsc + lint + unit tests only — it never catches build-only failures, Prisma migration drift, Docker-image-specific bugs (the exact category #203/#205/#207/#209/#211 fixed earlier in this project), or a real authenticated user flow. Add a heavier `verify.sh` that closes those gaps, run only on merge to `main` so PR iteration stays fast and cheap.

## Approach

### Where it runs

A new CI job triggered on `push: [main]` only — not on every PR. `./init.sh` stays the PR gate exactly as it is today. `verify.sh` runs after merge as a release-health check, since it needs a running Postgres/Redis/MinIO stack and makes one real LLM API call (cost and speed reasons — the same tradeoff already made for `./init.sh` staying fast).

### `verify.sh` steps, in order (fail fast, first failure stops the script)

1. **Backend build** — `pnpm --filter backend build` (`nest build`).
2. **Frontend build** — `pnpm --filter frontend build` (`next build`).
3. **Docker builds** — `docker build -f backend/Dockerfile .` and `docker build -f frontend/Dockerfile .`, the same Dockerfiles Railway builds from. Catches Dockerfile-specific bugs (missing files, multi-stage `COPY` issues, missing runtime deps) that a plain `nest build`/`next build` can't see, since those run outside any container.
4. **Prisma drift check** — `prisma migrate diff --from-migrations backend/prisma/migrations --to-schema-datamodel backend/prisma/schema.prisma --exit-code` (or equivalent), confirming the schema and the applied migration history agree, with no unmigrated schema changes.
5. **Docker Compose services up** — `docker compose up -d postgres redis minio minio-create-buckets`, wait for healthy.
6. **Authenticated Playwright e2e** — one flow: call the new test-login endpoint to get a token pair, drive the UI through creating a fast-flow book, wait for `ready` status, confirm the PDF download link resolves.

### Test-only login endpoint

`POST /auth/test-login` on the backend, gated by two independent barriers (defense-in-depth, since this endpoint issues real, valid JWTs bypassing Google OAuth entirely):

- Requires the request to arrive while `E2E_TEST_MODE=true` is set in the environment — never set on Railway (only in the CI verify job and local dev, if ever needed).
- Additionally, unconditionally throws if `NODE_ENV === 'production'`, regardless of `E2E_TEST_MODE` — so even if that flag were ever mistakenly set in production, the endpoint still refuses. This mirrors the same "don't rely on a single environment flag" lesson from the #289 cookie bug earlier this session (`NODE_ENV` alone wasn't set on Railway, which silently broke `secure: true`) — here, the endpoint is the one that must never activate in prod, so it checks defensively rather than trusting one flag alone.

Behavior: upserts a fixed fixture user (a well-known test email, e.g. `e2e-test@storygrow.test`), calls the same `AuthService.generateTokens` used by the real Google callback (no parallel token-issuing logic to maintain), and returns `{ accessToken, refreshToken }` in the JSON body directly (unlike the real OAuth callback, this is a JSON API response, not a cookie-setting redirect — the e2e test needs both tokens in a form Playwright can inject directly, and the whole point of this endpoint is to skip the redirect dance, not replicate it).

### Playwright e2e flow

New spec `frontend/e2e/create-book.spec.ts` (the existing `smoke.spec.ts` title-check stays as-is, this is additive):

1. Use Playwright's `request` context to `POST` the backend's `/auth/test-login`, capturing `{ accessToken, refreshToken }`.
2. Navigate to the app, inject `accessToken` into `localStorage` (matching `lib/auth.ts`'s `setTokens` key) before the page's own scripts run (Playwright's `addInitScript` or an equivalent pre-navigation cookie/storage seed) — the refresh token doesn't need injecting since it never lived in localStorage after #156 (it's cookie-based); the e2e's session only needs to survive the single test run, well under the 15-minute access-token lifetime, so no refresh exercise is needed here.
3. Create a child fixture (via the UI or a direct API call — direct API call is faster and this test's purpose is the generation pipeline, not the child-creation form) then start a fast-flow book creation.
4. Poll/wait for the book's status to reach `ready` (reuse the existing progress-page polling behavior already in the app, or poll the API directly with Playwright's own wait helpers).
5. Assert the book's PDF URL endpoint (`GET /books/:id/pdf-url`) resolves to a real, fetchable URL.

## Testing

This IS the testing infrastructure — no meta-tests needed beyond confirming the script itself runs clean locally before wiring it into CI.

- `backend/src/auth/auth.controller.spec.ts` gets new tests for `POST /auth/test-login`: succeeds when `E2E_TEST_MODE=true` and `NODE_ENV !== 'production'`; throws when `E2E_TEST_MODE` is unset; throws when `NODE_ENV === 'production'` even if `E2E_TEST_MODE=true` (the defense-in-depth case, tested explicitly).

## Out of scope

- Running this on every PR — cost/speed tradeoff explicitly rejected in favor of merge-only, matching the issue's own "for releases" framing.
- A full custom-flow (multi-stage LLM pipeline with judge/retry) e2e — fast-flow is the right fit for a fast, cheap smoke test; custom-flow's own quality/regeneration behavior is already covered by existing eval tooling (`eval:text`, `eval:batch`), not this script's job.
- Fixing the pre-existing, unrelated backend e2e suite failure (`app.e2e-spec.ts`'s Prisma7/ts-jest ESM resolution gap, noted during #280's final review) — separate problem, separate ticket if pursued.
