# StoryGrow — Session Log

Multi-session continuity log. **Newest entry at the bottom.** One entry per work session.

Each entry uses this template:

```
## YYYY-MM-DD — short topic

**Done:**
- ...

**Decisions:**
- ...

**Next:**
- ...

**Blockers:**
- ... (or "none")
```

---

## 2026-05-21 — Project pivot to StoryGrow, harness initial setup

**Done:**
- Reviewed RS School AI-SaaS course context and the reference `storycraft` project.
- Decided against the original StyleCraft AI idea (no domain expertise in styling) and against finishing the standard course `storycraft` (insufficient AI-engineering depth).
- Pivoted to **StoryGrow** — a pedagogically-grounded variant on the course architecture, leveraging the user's expertise in programming and child education.
- Rewrote `PROJECT_PLAN.md` for StoryGrow (concept, stack, AI-pipeline architecture, 5-week roadmap, budget).
- Renamed project directory `miranda` → `storygrow`.
- Created core harness files: `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md`, `progress.md`, `session-handoff.md`.

**Decisions:**
- Stack: NestJS (backend) + Next.js (frontend) + Prisma + PostgreSQL + pgvector + BullMQ + Redis + S3/MinIO.
- AI: **Vercel AI SDK** (`ai`, `@ai-sdk/openai`, `zod`) — no LangChain (no agent semantics in our pipeline).
- AI-engineering differentiators on top of base course architecture: **RAG** over English vocabulary corpora (Dale-Chall + AoA-Kuperman) as proxy difficulty, **structured generation** via `generateObject` with Zod schema enforcing pedagogical structure, **LLM-as-judge** with regeneration loop, **LangFuse** for observability.
- Product language: Russian (UI + stories). RAG corpus: English (proxy for difficulty bands).
- Write from scratch (not copy from `/Users/mac/Projects/storycraft/`). Storycraft is reference only.
- Task tracking: **GitHub Issues** (milestones = weeks, labels = areas).
- Doc artefacts stay local: `docs/superpowers/specs|plans/`, `docs/adr/`.
- Skill workflow: hybrid `superpowers:*` + `mattpocock/skills`. See `AGENTS.md` skill workflow map.

**Next:**
- Scaffold `backend/` (NestJS) and `frontend/` (Next.js) with pnpm workspace — Week 1 issues #1, #2, #3.
- Write `docker-compose.yml` (Postgres + pgvector, Redis, MinIO, LangFuse) — issue #4.
- Write `.env.example` — issue #5.

**Blockers:**
- None.

---

## 2026-05-21 — Harness completed, GitHub set up, roadmap → issues

**Done:**
- Wrote remaining harness: `docs/CODE_STYLE.md`, `docs/ARCHITECTURE.md`, `init.sh`, `.gitignore`.
- Initialized git, first commit.
- Created public GitHub repo `HelgaZhizhka/storygrow`, pushed `main`.
- Created Milestones (Week 1..5) and Labels (12 `area:*` + 3 `priority:*`).
- Ran `/setup-matt-pocock-skills` (GitHub Issues / `docs/` / default triage labels / single-context):
  - Added `## Agent skills` section to `CLAUDE.md`.
  - Wrote `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md`.
  - Created 5 triage labels on GitHub (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`).
- Migrated roadmap into 32 GitHub Issues (#1-#32) distributed across Week 1..5 milestones with `area:*` + `priority:*` labels.

**Decisions:**
- Public repo on GitHub (portfolio + free CI).
- Hybrid skills strategy: `superpowers:*` for process (brainstorming, writing-plans, executing-plans, tdd, verification) + `mattpocock/skills` for issues/triage/diagnose/handoff. See `AGENTS.md` skill workflow map.
- 32 issues granularity — finer than original ~30-item roadmap, but each is independently completable in 1-4 hours with agents.

**Next:**
- Start Week 1 work — issue #1 (scaffold pnpm workspace).
- Recommended order for Week 1: #1 → #2 → #3 → #4 → #5.

**Blockers:**
- None.

---

## 2026-05-22 — Git workflow adopted (ADR-0001)

**Done:**
- Wrote [docs/adr/0001-git-workflow.md](docs/adr/0001-git-workflow.md): one issue → one branch (`issue/<N>-<short-kebab>`) → one PR → squash-merge to `main`. PR titles in Conventional Commits.
- `CLAUDE.md`: tightened Hard Constraint #7 (no direct push to `main`, not only force push); added #18 (Conventional Commits on PR titles); added a "Git Workflow (canonical)" section with the typical command loop.
- `AGENTS.md`: added the one-issue-one-branch-one-PR rule to Working Rules.
- GitHub: branch protection on `main` (no force, no direct push, 0 required reviewers); repo merge settings squash-only + auto-delete merged branches.
- Dogfooded the workflow: this change shipped via PR #33 instead of a direct push.

**Decisions:**
- Squash merge as the only merge mode (rebase and merge-commit disabled at repo level).
- Conventional Commits as a "soft" rule on PR titles + squash subjects; intermediate commits on feature branches are not constrained (they get squashed away).
- `enforce_admins: false` — admin can bypass if branch protection ever blocks legitimate emergency work, but we treat the PR flow as the rule.

**Next:**
- Start Week 1 — issue #1 (scaffold pnpm workspace) on a branch `issue/1-pnpm-workspace`.
- Open question: should `progress.md` updates be bundled into the feature PR (preferred), or go via standalone PRs at session end? Decide before/during issue #1.

**Blockers:**
- None.

---

## 2026-05-23 — Agent harness refinements (agent1st-inspired) — #35

**Done:**
- Reviewed [applerom/agent1st AGENTS.md](https://github.com/applerom/agent1st/blob/main/AGENTS.md). Verdict: B+ doc — solid `Rule → WHY → IF MISSING` format, useful principles around evidence-based completion / right to disagree / not stopping at weak signals; but mostly philosophical and largely duplicated by the `superpowers:*` skills we already use.
- Cherry-picked 4 ideas without wholesale replacement (issue #35, PR #36):
  - `CLAUDE.md` — applied `Rule → Why → If missing` format to all 6 AI-Pipeline Discipline rules so the agent can judge edge cases instead of mechanically applying them.
  - `CONTEXT.md` — added "Semantic Hygiene — Easily Confused Pairs" table (12 pairs: Book vs Story, StoryEval vs Judge Score, Fast Flow vs Custom Flow, Template vs StorySchema, etc.).
  - `AGENTS.md` — new "Agent Behavior Contract" section: Done-is-not-a-mood, Right-to-disagree, Don't-stop-at-first-weak-signal, Complaint-Driven Development (with `Friction:` block format).
  - `session-handoff.md` — replaced free-form template with compact handoff format (Objective/Status/Key decisions/Assumptions/Rejected paths/Blockers/Next steps/Evidence/Frictions).
- Cleaned up the two stray commits left on the old `issue/1-pnpm-workspace` branch — neither related to pnpm scaffolding:
  - PR #39 (issue #37) — cherry-picked `91ddd4e` into main: documented the "bundle progress.md updates into the feature PR" rule in `AGENTS.md`.
  - PR #40 (issue #38) — cherry-picked `a10be5c` into main: standalone meetup harness walkthrough doc.
  - Deleted the polluted `issue/1-pnpm-workspace` branch (local + remote) — recreated clean off main for the actual #1 work.

**Decisions:**
- Reject "Agent1st Mode ON" magic phrase — cargo cult, does not change model behavior.
- Reject wholesale 11-principle copy — duplicates `superpowers:verification-before-completion`, `superpowers:systematic-debugging`, `superpowers:brainstorming`, `superpowers:executing-plans`, etc.
- Phase the `Why / If missing` format in gradually — applied only to AI-Pipeline Discipline first; revisit the 18 hard constraints later if the format proves useful in practice.
- CDD friction log lives inline under the current `progress.md` session entry (not a separate file) — same artefact, no dual source of truth.

**Next:**
- Issue #1 (scaffold pnpm workspace) — start now.

**Blockers:**
- None.

---

## 2026-05-23 — Week 1 #1: pnpm workspace scaffold

**Done:**
- Created repo-root workspace artefacts (issue #1):
  - `package.json` — `name: storygrow`, `private: true`, `packageManager: pnpm@10.29.3`, `engines.node >=22.0.0`, `format` / `format:check` scripts, devDep `prettier ^3.3.3` (resolved to `3.8.3`).
  - `pnpm-workspace.yaml` — references `backend` and `frontend` (directories themselves come in #2/#3).
  - `prettier.config.js` — CJS, `printWidth: 100`, `singleQuote: true`, `trailingComma: 'all'`, `arrowParens: 'always'`, `endOfLine: 'lf'`.
  - `.prettierignore` — excludes `node_modules`, lockfiles (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`), build outputs, and (deliberately) all `*.md` to keep current hand-formatted docs untouched.
  - `.nvmrc` — `22.15.0` (matches current local Node; lets `nvm use` / CI pick the right version).
  - `.editorconfig` — universal 2-space LF / UTF-8 / trim trailing whitespace / final newline; preserve trailing whitespace in `*.md` (markdown line-break syntax).
- Verified: `pnpm install` runs clean, `pnpm format:check` passes, `./init.sh` exits 0.
- Fixed a small ordering bug in `progress.md` introduced during the harness PR — the 2026-05-23 entry had been inserted above 2026-05-22, violating "newest at bottom". Reordered.

**Decisions:**
- Pin pnpm to `10.29.3` exact via `packageManager` (matches currently installed; ignore the v11 update prompt for now to keep CI / local in sync).
- Pin Node via `engines: { node: ">=22.0.0" }` — current local is `v22.15.0`, gives upgrade headroom without forcing a hard pin.
- Prettier `printWidth: 100` over the more common `80` — modern monitors, NestJS/Next code tends to be wider, and per-line meaningful density goes up.
- `.prettierignore` includes `*.md` for now. Reason: existing harness docs are hand-formatted with intentional table widths / soft-wrapping that prettier would reflow. Revisit once the project has more docs and we want canonical markdown formatting across the board.
- Skip root-level convenience scripts (`build`/`test`/`lint -r`) until at least one sub-package has those scripts — `pnpm -r` errors when no package has the named script. Add in #2/#3.
- Cherry-picked environment-level files from the `yes-code-merch` repo config audit (`.nvmrc`, `.editorconfig`, lockfile entries in `.prettierignore`). Per-package configs (shared `tsconfig.base.json`, shared ESLint preset) deferred until after `backend/` and `frontend/` exist — separate issues (N2, N3). Husky + lint-staged (N1) lands next, with only Prettier wired in initially.

**Next:**
- Issue #41: husky + lint-staged (prettier only initially) — Week 1.
- Issue #42: GitHub Action to lint PR title (Conventional Commits) — Week 1.
- Issue #2: scaffold `backend/` (NestJS).
- Issue #3: scaffold `frontend/` (Next.js).
- After #2/#3: shared `tsconfig.base.json` (#43), shared ESLint preset (#44), CI workflow running `./init.sh` (#45), and root-level `build`/`test`/`lint` fan-out scripts via `pnpm -r`.

**Blockers:**
- None.

---

## 2026-05-24 — Week 1 #41: husky + lint-staged (prettier only)

**Done:**
- Installed `husky@9` and `lint-staged@17` as repo-root devDependencies.
- `pnpm exec husky init` created `.husky/`; `prepare: husky` in `package.json` so `pnpm install` rewires the hook on every fresh checkout.
- `.husky/pre-commit` → `pnpm exec lint-staged`.
- `lint-staged` config (in `package.json`): `"*": "prettier --write --ignore-unknown"` — single glob, prettier decides per-file whether it knows the parser, falls through silently otherwise.
- End-to-end verification: created a deliberately malformed JSON file, staged it, committed — pre-commit hook ran prettier, reformatted the staged content, the commit landed with the cleaned version. Reset the test commit afterwards.
- `./init.sh` exits 0.

**Decisions:**
- Catch-all `*` glob over per-extension globs. Reason: `prettier --ignore-unknown` already no-ops on files it can't parse, so per-extension globs would just duplicate prettier's own filtering and need updating every time we add a new file type. One glob = one source of truth.
- No ESLint in `lint-staged` yet — `backend/` and `frontend/` don't exist; ESLint preset comes with #44 after #2/#3. We'll add `eslint --fix` to the pipeline then.
- No `commit-msg` / commitlint hook. ADR-0001 keeps Conventional Commits as a soft rule on PR titles only (enforced by CI in #42); intermediate commits on feature branches stay unconstrained because squash-merge wipes them.
- No `pre-push` test runner. `./init.sh` is the local smoke-check, CI (#45) is the gate — pre-push tests would just slow down branch pushes without adding signal.

**Next:**
- Issue #42: CI lint PR title (Conventional Commits) — Week 1, next.
- Issues #2 (backend) / #3 (frontend) scaffolds — unblocks #43, #44, #45.

**Blockers:**
- None.

---

## 2026-05-24 — Week 1 #42: CI lint PR title (Conventional Commits)

**Done:**
- Added `.github/workflows/lint-pr-title.yml` — single-job workflow on `ubuntu-latest`.
- Uses `amannn/action-semantic-pull-request` pinned to commit SHA `48f256284bd46cdaab1048c3721360e808335d50` (= tag `v6.1.1`).
- Allowed types match ADR-0001 exactly: `feat | fix | chore | docs | refactor | test | perf | ci`.
- `requireScope: false` — area scope is optional per ADR-0001 ("Area matches an `area:*` label when one fits, free-form otherwise").
- Triggers: `pull_request` on `opened | edited | reopened | synchronize`.
- Permissions: `pull-requests: read` (action only reads the PR title; doesn't post comments).
- The PR opened for this very change is the live test — a non-conformant title would fail the check, this title passes.

**Decisions:**
- `pull_request` (not `pull_request_target`). Reason: single-maintainer repo, no fork PRs expected. `pull_request_target` is the right choice only when checks must run with elevated permissions on forked-PR code; using it without need expands the attack surface for very little gain.
- No `subjectPattern` lowercase rule. Reason: ADR-0001 says "short imperative subject" but doesn't mandate lowercase. Don't invent stricter rules than the source-of-truth doc; if we want lowercase later, amend the ADR first.
- Pin to commit SHA, not the `v6` floating tag. Reason: tag re-points are silent — a compromised tag would let a malicious version of the action read PR metadata. SHA pinning trades dependabot-style upgrade ergonomics for supply-chain integrity, which matters more here.
- Branch protection: marking `lint-pr-title / Conventional Commits` as a required check on `main` is a separate manual step in GitHub UI (Settings → Branches → main). Noting it in the PR body; if it's not set, the workflow runs but isn't gating — fine until we have a real violation.

**Next:**
- Set the workflow as a required status check on `main` (UI step, after at least one run completes successfully).
- Issues #2 (backend) / #3 (frontend) scaffolds — unblocks #43, #44, #45.

**Blockers:**
- None.

---

## 2026-05-24 — Week 1 #2: backend (NestJS) scaffold + /health

**Done:**
- Scaffolded `backend/` via `pnpm dlx @nestjs/cli new backend --package-manager pnpm --skip-git --skip-install --strict` (Nest 11, TypeScript 5, ESLint 9 flat config, Jest).
- Replaced the default `Hello World` `AppController` / `AppService` with a `HealthController` at `GET /health` returning `{ status: 'ok' }` (typed via `HealthStatus`). `AppModule` wires the two.
- `main.ts` listens on `process.env.PORT ?? 3001` (frontend gets 3000 per CLAUDE.md → backend defaults to 3001 to avoid collision).
- Unit test (`health.controller.spec.ts`) and e2e test (`test/app.e2e-spec.ts`) both updated to cover the `/health` endpoint.
- Tightened the Nest CLI default ESLint config: `@typescript-eslint/no-explicit-any: error` (Hard Constraint #1), `no-floating-promises: error`, prettier `endOfLine: 'lf'` (was `'auto'`).
- Removed `backend/.prettierrc` — root `prettier.config.js` is the single source of truth.
- Trimmed `backend/package.json`: dropped duplicated `format` script (root owns formatting), added `dev` alias (= `nest start --watch`) so `pnpm --filter backend dev` matches CLAUDE.md, dropped `start:debug` (unused).
- Fixed `init.sh`: dropped `--run` from `pnpm test --run --silent` — vitest-only flag that broke Jest. Now `pnpm test --silent` for both packages; the `test` script in each package is framework-aware.
- Verified end-to-end: `./init.sh` passes (`tsc --noEmit`, `lint`, `test --silent`); e2e suite (`pnpm exec jest --config ./test/jest-e2e.json`) passes.

**Decisions:**
- Scope reduction from the issue text. The original issue body says "Copy `eslint.config.js` + `tsconfig.json` from `mentor-resources/templates/configs/`" — that directory was never created (stale wording from the imported roadmap). Per our N1–N5 plan, strict shared tsconfig (#43) and shared ESLint preset (#44) are explicitly separate issues that land after both packages exist. So #2 uses the Nest CLI defaults *as is* (`strictNullChecks`, `noImplicitAny`, `strictBindCallApply` are already on) and we'll harmonize in #43/#44.
- Enabled `no-explicit-any: error` (Hard Constraint #1) anyway — disabling a Hard Constraint while waiting for a follow-up PR would be a documented rule violation in the interim. One-line override, undone cleanly when #44 replaces the preset.
- Backend default port `3001`, not `3000`. Frontend Next.js owns 3000 per CLAUDE.md; preventing the collision now is cheaper than diagnosing it later.
- `@nestjs/core` and `unrs-resolver` postinstall scripts blocked by pnpm 10's default sandboxing — left as-is (no functional break observed). `pnpm approve-builds` if either turns out to need it (e.g. opentelemetry hooks fail to register). Not in #2 scope.

**Next:**
- Issue #3: scaffold `frontend/` (Next.js).
- After #3: shared `tsconfig.base.json` (#43), shared ESLint preset (#44), CI `./init.sh` workflow (#45).

**Blockers:**
- None.

---

## 2026-05-24 — Week 1 #3: frontend (Next.js) scaffold

**Done:**
- Scaffolded `frontend/` via `pnpm create next-app@latest` (Next 16.2.6, React 19.2, Tailwind 4, ESLint 9 flat, App Router, `src/` layout, `@/*` import alias, Turbopack).
- Replaced the Vercel demo landing with a StoryGrow placeholder (`src/app/page.tsx`) — Russian copy (product language per CONTEXT.md), centered single-column hero, dark-mode aware via Tailwind classes.
- `src/app/layout.tsx`: switched `<html lang>` from `"en"` to `"ru"`, added Cyrillic subset to `Geist` (default font), set real `metadata.title` / `description`.
- ESLint config (`frontend/eslint.config.mjs`): added `@typescript-eslint/no-explicit-any: error` override on top of `eslint-config-next` (Hard Constraint #1).
- `frontend/package.json`: added `description`, `lint:fix` script, and a placeholder `test` script (`true`) so `init.sh`'s `pnpm test --silent` step doesn't fail before a test framework is wired in.
- Deleted the Vercel demo SVGs (`next.svg`, `vercel.svg`, `file.svg`, `window.svg`, `globe.svg`) — `page.tsx` no longer references them.
- Deleted `frontend/CLAUDE.md` (was just `@AGENTS.md` re-export) and `frontend/.git/` (nested repo). Merged `frontend/pnpm-workspace.yaml`'s `ignoredBuiltDependencies` (`sharp`, `unrs-resolver`) into the root workspace file, plus `@nestjs/core`; deleted the nested file.
- Kept `frontend/AGENTS.md` (5-line note from the Next CLI warning that Next 16 has breaking changes vs training-data Next) and `frontend/.gitignore` was deleted in favor of the root one; added `frontend/next-env.d.ts` to root `.gitignore` (Next auto-regenerates it; must not be committed per Next docs).
- Verified: `./init.sh` exits 0 (`tsc --noEmit`, `lint`, placeholder `test` for frontend; backend still green); `pnpm --filter frontend exec next build` exits 0 with one static `/` route.

**Decisions:**
- **`text "no test"` placeholder via `"test": "true"`.** First attempt was `echo 'no tests yet' && exit 0` — that broke when `init.sh` invoked it as `pnpm test --silent`: pnpm appends `--silent` to the script → `exit 0 --silent` → too many arguments. Switched to bare `true` (POSIX `true(1)` ignores all args and exits 0). Real test framework lands with the first frontend feature, not in #3.
- **No vitest / RTL / playwright yet.** Picking a frontend test stack is opinionated (vitest vs jest, jsdom vs happy-dom, integration vs visual). Wiring it in a "scaffold" PR would pre-commit to a choice without a real test to validate it. Defer to a dedicated issue when the first non-trivial component lands.
- **Kept `eslint-config-next` flat-config as the base.** It already includes core-web-vitals + React rules + JSX a11y. #44 (shared ESLint preset) will compose this with the backend preset; for now adding our Hard-Constraint override is the minimum viable change.
- **Single `pnpm-workspace.yaml` at the root.** The Next 16 CLI creates a nested one to declare `ignoredBuiltDependencies`. pnpm reads the *nearest* workspace file, so a nested one shadows the root and breaks the monorepo. Moved the ignore declarations into the root file.
- **Russian copy on the landing.** `CONTEXT.md` says product language is Russian (UI + stories). Hard-coding the language now avoids the trap of building English-first scaffolds that get retrofitted later. i18n tooling decision deferred until there's actual content variation.

**Next:**
- Week 1 milestone closes with this PR. All five originally scoped Week 1 issues done (#1, #2, #3) plus the three we spun out today (#41 husky, #42 PR-title CI, #46... wait — re-count from the GitHub issue list).
- Week 2 unblocks now: #43 shared tsconfig, #44 shared ESLint preset, #45 CI `./init.sh` workflow.
- Then back to original roadmap: #4 (docker-compose), #5 (.env.example).

**Blockers:**
- None.

---

## 2026-05-24 — Week 2 #45: CI workflow running ./init.sh on PR

**Done:**
- Added `.github/workflows/ci.yml`: single `init` job on `ubuntu-latest`, 10-min timeout.
- Triggers: `pull_request` to `main` (for gating) and `push` to `main` (for status badge / post-merge confirmation).
- Steps: `actions/checkout` → `pnpm/action-setup` (`10.29.3`, no auto-install) → `actions/setup-node` (`node-version-file: .nvmrc`, `cache: 'pnpm'`) → `pnpm install --frozen-lockfile` → `./init.sh`.
- All three actions pinned to commit SHA, not floating major tags (same supply-chain rationale as #42's amannn pin — `actions/checkout` literally reads the repo contents, so a tag re-point is high-impact).
- `concurrency` block cancels older PR runs when new commits arrive (`cancel-in-progress: ${{ github.event_name == 'pull_request' }}`) but keeps `main`-push runs to avoid losing the post-merge confirmation.
- `permissions: contents: read` — minimum needed for checkout; no write tokens issued.

**Decisions:**
- **Pinned to commit SHA, not v4 / v6 tags** — even for first-party `actions/*`. Reasoning same as #42: tag re-points are silent, and an `actions/checkout` compromise would let the action read the source tree. Slight upgrade-ergonomics cost; acceptable here without dependabot wired up.
- **`pnpm install --frozen-lockfile`** instead of plain `pnpm install`. CI must fail loudly when the lockfile is out of sync with `package.json`, not silently regenerate it. This is the lockfile-discipline counterpart to local `pnpm install`.
- **Single job, no matrix.** Issue acknowledged a Node 22 / 24 matrix as a possible follow-up — explicitly out of scope. We pin Node via `.nvmrc` and that's the one supported version until/unless the matrix becomes worth it.
- **Trigger on `push` to `main` too**, not only `pull_request`. Reason: future README status badge needs a `main`-branch run to report against; also lets us catch any post-merge anomalies (e.g. a base-branch shift that breaks something a PR review never saw).

**Manual follow-up (after first green run on main):**
- GitHub UI → Settings → Branches → main → edit branch protection → require status check **"./init.sh"** (in addition to the **"Conventional Commits"** check from #42).

**Next:**
- #4: `docker-compose.yml` (Postgres + pgvector, Redis, MinIO, LangFuse) — unblocks Week 2 feature work.
- #5: `.env.example` (likely bundled with #4 since they share the env contract).

**Blockers:**
- None.

---

## 2026-05-24 — Week 1 #4 + #5: docker-compose + .env.example

**Done:**
- `docker-compose.yml` at repo root, five services:
  - `postgres` — `pgvector/pgvector:pg17`, init script in `infra/postgres/init/01-create-langfuse-db.sql` creates a second `langfuse` database alongside the app `storygrow` database.
  - `redis` — `redis:7-alpine`.
  - `minio` + `minio-create-buckets` — main MinIO server (API `9000`, console `9001`) and a one-shot init container using the `mc` client to create the `storygrow` bucket and set anonymous-download policy.
  - `langfuse` — `langfuse/langfuse:2` (v2; the simplest single-container flavour, points at the shared postgres for its own `langfuse` DB).
- All services have healthchecks (`pg_isready`, `redis-cli ping`, `mc ready`) and named volumes (`postgres-data`, `redis-data`, `minio-data`).
- `.env.example` lists every variable from CLAUDE.md, grouped by area (DB / Redis / S3 / OpenAI / LangFuse / Auth / Stripe / Eval). LangFuse section also adds the v2 self-host vars (`NEXTAUTH_SECRET`, `SALT`, `INIT_USER_*`).
- New `docs/local-dev.md` — service port table, first-run bootstrap, common commands, reset recipes.
- Fixed a latent port collision in `CLAUDE.md`: it documented `LANGFUSE_HOST=http://localhost:3001`, but backend now lives on `3001` per #2. Moved LangFuse to `3030`. `CLAUDE.md` Quick Commands updated with `docker compose down -v` and a pointer to `docs/local-dev.md`.
- `docker compose config --quiet` exits 0 (syntactic validation).

**Decisions:**
- **One PR for two issues.** ADR-0001 says "one issue → one branch → one PR", which we softened today by mutual agreement: `.env.example` is literally generated by the same compose contract — splitting would mean each PR depends on the other for the port/credential alignment to be reviewable. Two `Closes #` lines in the PR body close both issues on merge.
- **LangFuse v2, not v3.** v3 needs ClickHouse + a worker + S3 + Redis + a separate postgres — 6 services for the observability layer alone. v2 is a single container against any postgres, fits a course-project deploy budget, and exposes the same OTel ingest API we'll use from `experimental_telemetry`.
- **Shared postgres for app + LangFuse with two databases**, not two postgres containers. Tradeoff: marginally more coupling (a `down -v` wipes both); benefit: one image, one healthcheck, one set of credentials. Acceptable for local dev — production deploy may split later.
- **MinIO bucket anonymous-download policy.** Stories' rendered PDFs and illustrations will be served via signed URLs in prod, but for local dev iterating on the rendering pipeline a public-read dev bucket avoids needing the SDK signature dance every time.
- **Port allocation locked in:** `3000` frontend, `3001` backend, `3030` LangFuse, `5432` postgres, `6379` redis, `9000`/`9001` MinIO. CLAUDE.md updated so this is now the canonical source.
- **Did NOT verify with `docker compose up -d`** — Docker Desktop wasn't running on this machine. Compose file syntactically validated via `docker compose config`. First user with a running daemon should `up -d` and confirm all five services reach `healthy`.

**Next:**
- Verify the compose stack actually boots clean (one user with docker running). If anything is broken, file as a fix-up issue.
- #6+: first AI-pipeline issues — backend Prisma + pgvector schema, AI module skeleton with `generateObject`. Week 2 territory.

**Blockers:**
- None (Docker verification is a soft follow-up, not a blocker).

---

## 2026-05-24 — #53: MinIO host-port collision fix + compose stack verified

**Done:**
- Verified the compose stack against a real Docker daemon. Found a collision: dev host had Homebrew `php-fpm` listening on `127.0.0.1:9000`, blocking MinIO's host port. Filed #53 as a follow-up to #4.
- Shifted MinIO's host-facing ports `9000 → 9100` (API) and `9001 → 9101` (console). Container-internal ports stay `9000`/`9001`, so the `minio-create-buckets` init container (talks to `http://minio:9000` via the docker network) is unaffected.
- Updated everywhere the host port appeared: `docker-compose.yml`, `.env.example`, `CLAUDE.md` (Required Environment Variables block), `docs/local-dev.md` (port table + first-run URLs).
- End-to-end verification with `docker compose up -d`:
  - `postgres` → healthy (init script created `langfuse` DB on first start).
  - `redis` → healthy.
  - `minio` → healthy on `0.0.0.0:9100→9000`, `0.0.0.0:9101→9001`.
  - `minio-create-buckets` → exit 0; logs confirm bucket created with anon-download policy.
  - `langfuse` → HTTP 200 on `http://localhost:3030`.
  - `curl http://localhost:9100/minio/health/live` → HTTP 200.

**Decisions:**
- **B over A (shift MinIO port, don't kill php-fpm).** The user runs PHP for other projects; killing it would optimize for ports-look-canonical at the cost of breaking their workflow. Port allocation is project-local convention, not protocol — non-standard host port is the right tradeoff. Documented in CLAUDE.md so this becomes the canonical local-dev port.
- **Kept container-internal ports at 9000/9001.** Only the host mapping changed. Reasoning: the docker network is the project's bus — services talk to each other by service name on default ports (`http://minio:9000`). Renaming internal ports would have rippled into the `mc` init container and any future backend code that consumes S3 from inside the docker network.
- **#53 was a follow-up issue, not just a direct fix on the #4 PR.** ADR-0001 mandates one-issue-one-branch-one-PR; #4 was already merged. New issue is the right move for traceability — the squash-merge commit on `main` for #4 will continue to show "ships with port 9000" while #53 documents the correction.

**Next:**
- Branch protection UI step still pending: require `./init.sh` and `Conventional Commits` checks on `main` (separate from this PR).
- Week 2 feature work — start in a fresh session with re-read CLAUDE.md / CONTEXT.md.

**Blockers:**
- None.


---

## 2026-05-25 — Week 2: tooling + Prisma schema + Zod AI schemas (parallel)

**Done:**
- **#43 + #44** (PR #55): `tsconfig.base.json` at repo root; both `backend/` and `frontend/` tsconfigs extend it (8 shared options extracted). Internal workspace package `packages/eslint-config` (`@storygrow/eslint-config`) with shared `no-any: error` rule; both packages import it, `pnpm-workspace.yaml` updated to include `packages/*`.
- **#10 + #12** (PR #56): `backend/src/ai/schemas/story.schema.ts` — `StorySchema` Zod with `title`, `setup`, `conflict`, `lesson`, `resolution`, `discussionQuestions[5]`, `illustrationPrompts[3-8]`; `backend/src/ai/schemas/judge.schema.ts` — `JudgeScoreSchema` (5 criteria 0–10), `JudgeSchema`, `computeFinalScore`; barrel `index.ts`; `backend/src/ai/prompts/.gitkeep`. `zod` added to backend deps.
- **#6** (PR #57): Prisma v7 (`@prisma/client`, `prisma` dev). `backend/prisma/schema.prisma` — all 9 domain entities: `User`, `Child`, `Book`, `BookPage`, `StoryEval`, `Subscription`, `LearningGoal`, `VocabularyEntry` (`embedding Unsupported("vector(1536)")`), `Template`. `prisma.config.ts` for v7. `postinstall: prisma generate`.

**Decisions:**
- **Prisma v7**: `provider = "prisma-client"` (not `prisma-client-js`), URL in `prisma.config.ts`. Client generated to `backend/generated/prisma`. Migration files were not created — requires a live DB (`docker compose up`), that is issue #7.
- **Three parallel agents** in isolated worktrees — zero merge conflicts; rebase onto the new main was clean for both.
- **`computeFinalScore` as a pure exported function** in judge.schema.ts — testable without mocks.

**Next (priority order):**
- #7: pgvector extension + initial migration (requires `docker compose up`)
- #8 → #9: RAG corpora + VocabularyRagService
- #11: StoryGenerator (requires `ai` + `@ai-sdk/openai`)
- #13: StoryEvaluator + regeneration loop
- #14: LangFuse via experimental_telemetry
- #16: Google OAuth + JWT (backend)

**Blockers:**
- #7 requires a running postgres — run `docker compose up -d` first.

---

## 2026-05-25 — #7: pgvector extension + HNSW index migration (PR #58)

**Done:**
- `backend/prisma.config.ts` — added `datasource.url: env('DATABASE_URL')` and `experimental.extensions: true` (required for Prisma v7 + pgvector).
- Migration `0001_init` — `CREATE EXTENSION IF NOT EXISTS vector` + all 9 domain tables + 4 enums + FK constraints. Generated from the schema in #6.
- Migration `0002_add_vector_index` — HNSW index on `VocabularyEntry.embedding` (`vector_cosine_ops`).
- Applied to a live `pgvector/pgvector:pg17`; verified: `vector` extension active, index visible in `\di`.

**Decisions:**
- **HNSW over IVFFlat** — IVFFlat requires a minimum number of rows to build cluster centroids; the table starts empty and fills incrementally (#8). HNSW requires no training.
- **`prisma migrate deploy` for applying migrations** (not `migrate dev`) — `migrate dev` is interactive and holds an advisory lock in the background; `deploy` is production-safe and non-interactive.

**Next:**
- #8: download Dale-Chall + AoA-Kuperman corpora and write the indexing script for `VocabularyEntry` via pgvector embeddings.
- #9: `VocabularyRagService` — grade-level retrieval via similarity search.
- #11 (StoryGenerator) + #16 (Google OAuth) can start in parallel.

---

## 2026-05-25 — Week 2 #8 + #9: Vocabulary RAG service (PR #59)

**Done:**
- **Design spec:** `docs/superpowers/plans/2026-05-25-vocabulary-rag.md` — full design for #8 + #9 including corpus choice, embedding pipeline, similarity search API, and integration with StoryGenerator.
- **Dependencies:** added `ai`, `@ai-sdk/openai`, `csv-parse`, `pg`, `@prisma/adapter-pg`, `@types/pg` to backend.
- **Corpus:** `backend/prisma/seed/vocabulary.csv` — 820 Russian words manually curated for grades 0–4 (frequency proxy: D.Sh. Matveev "Frequency Dictionary of Russian Children's Vocabulary"). Each row: `word,gradeLevel,frequency`.
  - *Deviation from original issue:* issue #8 specified Dale-Chall + AoA-Kuperman (English proxies). Switched to Russian corpus because the product language is Russian (stories + UI); English word difficulty does not map cleanly to Russian pedagogical vocabulary bands.
- **`ageToGradeLevel`** helper (`backend/src/ai/rag/age-grade.map.ts`) — maps child age (2–10) to reading grade level (0–4) with unit tests.
- **`VocabularyRagService`** (`backend/src/ai/rag/vocabulary-rag.service.ts`) — `findByGradeLevel(grade, limit)` and `searchByEmbedding(embedding, limit)` using Prisma + pgvector HNSW index. Full unit tests with mocked PrismaClient.
- **`PrismaService`** (`backend/src/prisma/prisma.service.ts`) — NestJS provider using `@prisma/adapter-pg` + `pg.Pool` for Driver Adapter support (required for pgvector raw queries). `PrismaModule` wired into `AppModule`.
- **`seed-vocabulary` script** (`backend/src/scripts/seed-vocabulary.ts`) — reads CSV, batches words through `embedMany` (`text-embedding-3-small`, 512 batch, 200ms delay), upserts into `VocabularyEntry` via `$executeRaw` with `ON CONFLICT`. Uses `tsx` runner (not `ts-node`) for ESM compatibility.
- **Fix:** `@types/pg` was missing — caused TS7016 and 8 ESLint `no-unsafe-*` violations across `prisma.service.ts` and `seed-vocabulary.ts`.

**Decisions:**
- **Russian corpus instead of English.** The original plan (Dale-Chall + AoA-Kuperman) was a proxy for English difficulty. For Russian stories, we need Russian word-frequency bands. The 820-word seed set is a pedagogical MVP; we can expand to 5k+ later via a real frequency dictionary.
- **Manual curation over automated download.** Dale-Chall and AoA-Kuperman are freely available but English-specific. No equivalent open Russian child-vocabulary corpus exists in a downloadable CSV. Manual curation from a frequency dictionary is the pragmatic path for a course-project MVP.
- **`embedMany` for batch embedding** — one OpenAI API call per 512 words, with 200ms delay between batches. Cost: ~820 words / 512 * $0.02/1M tokens ≈ negligible for seeding.
- **`$executeRaw` with `ON CONFLICT`** instead of `prisma.vocabularyEntry.createMany` — `createMany` does not support the `vector` type in Prisma v7; raw SQL is the only path for pgvector inserts.
- **Postinstall caveat:** `prisma generate` runs in `postinstall` and requires `DATABASE_URL`. Fresh clones without `.env` will fail `pnpm install`. Workaround: `pnpm install --ignore-scripts` then `pnpm --filter backend prisma:generate` with env set. This is a known friction; we may need to make `postinstall` conditional or move generation to an explicit step.

**Next:**
- Open PR #59 for #8 + #9 (branch `issue/8-9-vocabulary-rag`), squash-merge after review.
- #11: `StoryGenerator` service with `generateObject` + `StorySchema`.
- #13: `StoryEvaluator` + regeneration loop.
- #14: LangFuse integration via `experimental_telemetry`.

**Blockers:**
- None.

**Frictions:**
- `pg` types missing was a preventable catch — `init.sh` should have been run immediately after the `prisma.service.ts` commit, not deferred to the end of the branch. Cost: one extra fix-up commit.
- `prisma generate` in `postinstall` fails on fresh clones without `DATABASE_URL`. Need to decide: remove `postinstall`, make it conditional, or document the workaround.

---

## 2026-05-26 — Architecture review, controlled generation design, storycraft analysis

**Done:**
- **PR #59 merged** — vocabulary RAG (#8 + #9) squash-merged to main.
- **PR #62 merged** — session documentation: ADR-0002, StoryGenerator spec, PROJECT_PLAN.md (EN), concepts explainer.
- **`docs/adr/0002-page-templates-contract.md`** — architectural decision: Page Templates as a typed contract between StoryGenerator and PDFRenderer. 6 template types, physical sizing from A5, HTML-as-source, CSS scoping rationale, DALL-E size mapping.
- **`docs/superpowers/specs/2026-05-26-story-generator-controlled.md`** — full spec for #11 StoryGenerator with 3-layer control architecture (PRE/GENERATION/POST), vocabulary compliance check, regen loop, hard fail, StoryEval migration, test plan.
- **`docs/concepts/controlled-generation.md`** — Russian-language concept explainer of controlled AI generation (intentionally Russian, for personal re-reading).
- **`PROJECT_PLAN.md`** — translated to English.
- **`progress.md`** — Russian fragments translated to English.
- **Storycraft stream2 analysis** — compared course reference project against StoryGrow. Key finding: storycraft lacks structured generation, RAG, judge, evals — we are ahead on AI engineering. Key gap we identified: Page Templates as physical layout contract.
- **GitHub issue #60** created — `feat(pdf): page templates contract` (Week 3 milestone, blocks #11 and #17).
- **Worktrees cleanup** — removed 3 stale agent worktrees from `.claude/worktrees/`.

**Decisions:**
- **Target audience narrowed to 5–8 years** — pedagogically valid age band for our text-centric approach. Under 5: images dominate, vocabulary RAG less effective. Over 8: children read independently without this format.
- **Page Templates as next architectural step** — before implementing #11 (StoryGenerator), the LLM needs a typed layout contract. Issue #60 must be done first.
- **Controlled generation = 3-layer sandwich** — PRE (RAG whitelist + system prompt), GENERATION (`generateObject` + Zod schema), POST (vocabulary compliance check + LLM judge + regen loop + hard fail). All three layers from the start, not retrofitted later.
- **Vocabulary compliance — deterministic, not via LLM** — `checkCompliance()` measures token share from allowed corpus. Threshold 0.85. Auditable metric stored in `StoryEval.vocabularyCompliance`.
- **All project docs in English** — specs, plans, ADRs, root docs. Russian only in `docs/concepts/` on explicit request.
- **From storycraft — taking only one thing** — Page Templates contract. Their AI layer (raw openai SDK, no schema, no judge) is significantly behind ours.

**Next:**
- #11 StoryGenerator (now unblocked by #60).

**Blockers:**
- None.

---

## 2026-05-28 — #60: page templates contract (PR #63, squash-merged)

**Done:**
- `backend/src/pdf/page-templates/page-templates.config.ts` — typed catalogue of 6 templates (`cover`, `image-top`, `image-bottom`, `image-left`, `text-focus`, `final`): maxChars, DALL-E sizes, age suitability. Single source of truth.
- `backend/src/ai/schemas/story.schema.ts` — replaced flat `setup/conflict/lesson/resolution/illustrationPrompts` with `PageSchema` + `pages[]`. Template enum imported directly from config.
- `backend/src/pdf/page-templates/book-plan.validator.ts` — deterministic post-generation validator (cover-first, final-last, text/title maxChars, age suitability, unknown-template guard). 12 unit tests.
- `backend/src/ai/prompts/story-generator.prompt.ts` — `buildStoryUserPrompt` includes age-filtered template catalogue + text limits; `buildRegenerationFeedback` formats failures for retry loop.
- 6 HTML template stubs with scoped BEM CSS and `{{slot}}` placeholders.
- `./init.sh` exits 0 — 29 tests, tsc, lint all green.

**Decisions:**
- `StorySchema.title` kept as book-level metadata; `pages[0].title` is the shorter cover display title (max 60 chars). Documented in JSDoc.
- `JudgeFeedback` → replaced with `JudgeResult` from judge.schema.ts (no duplicate type).
- `text-focus` suitableFor `[7, 8]` only — younger children need image-heavy layouts.
- CSS fix: `text-focus` illustration uses `flex: 1; min-height: 0` to resolve height in Puppeteer flex context.

**Next:**
- #11 StoryGenerator — now unblocked. Spec: `docs/superpowers/specs/2026-05-26-story-generator-controlled.md`.

**Blockers:**
- None.

---

## 2026-05-29 — #11: StoryGenerator service + #67: AI architecture refactor (PRs #66, #68)

**Done:**
- **PR #65** — CI fix: added dummy `DATABASE_URL` to `pnpm install` step so `prisma generate` no longer fails in CI (Prisma 6 `env()` throws on missing var during postinstall).
- **PR #66 — Issue #11 StoryGenerator service** (subagent-driven, 8 tasks):
  - `stop-words.ts` — 247 Russian function words for vocabulary compliance filtering.
  - `vocabulary-compliance.ts` — `checkCompliance()`: tokenize Russian text, filter stop words, measure corpus coverage. Threshold 0.85.
  - `story-generator.service.ts` — 3-layer pipeline: PRE (VocabularyRagService RAG) → GENERATION (`generateObject` + StorySchema + LangFuse telemetry) → POST (validateBookPlan + checkCompliance + LLM judge + retry loop). Writes `StoryEval` on every attempt.
  - `judge.prompt.ts` + `JUDGE_SYSTEM_PROMPT` + `buildJudgePrompt()`.
  - Prisma migration: added `judgeReasoning`, `vocabularyCompliance`, `passed` to `StoryEval`.
  - `errors.ts` — `StoryGenerationFailedError`.
  - 44 tests passing.
- **PR #68 — Issue #67: 5 AI architectural improvements** (post-#11 review):
  - `ai.config.ts` — all AI tuning constants centralized (GENERATION_MODEL, EMBEDDING_MODEL, DEFAULT_TOP_K, COMPLIANCE_THRESHOLD, PAGES_MIN, PAGES_MAX, DISCUSSION_QUESTIONS_COUNT, EVAL_THRESHOLD_DEFAULT, EVAL_MAX_RETRIES_DEFAULT).
  - `telemetry.ts` — `createTelemetry(functionId, metadata)` helper with `LANGFUSE_ENABLED` toggle.
  - `validators/` — `CheckResult { passed, errors }` unified interface; `validateBookPlan` moved from `pdf/page-templates/` to `ai/validators/`.
  - `StoryGeneratorService` split into: `StoryGeneratorService` (generation) + `StoryEvaluatorService` (structural + compliance + judge) + `StoryOrchestratorService` (retry loop + RAG + DB writes).
  - 52 tests passing.

**Decisions:**
- `illustrationPrompt` fields (DALL-E, English) excluded from Russian vocabulary compliance check — intentional.
- `computeFinalScore()` used deterministically instead of trusting LLM's self-reported `finalScore`.
- Env vars `EVAL_THRESHOLD` and `EVAL_MAX_RETRIES` read at runtime (not construction) to allow hot config; guarded with `Number.isNaN` fallback to defaults.
- `StoryEvaluatorService` not exported from `AiModule` — internal to orchestrator by design.
- Re-export shims removed (no consumers of old paths existed).

**Next:**
- #14 LangFuse integration via `experimental_telemetry` (`createTelemetry` helper already in place).
- #13 StoryEvaluator service + regeneration loop (seams ready: `StoryEvaluatorService` + `CheckResult`).
- #15 BullMQ generation queue (`StoryOrchestratorService` ready to be the queue processor).
- #16 Google OAuth + JWT authentication (backend).

**Blockers:**
- None.

---

## 2026-05-29 — #14: LangFuse integration (PR #69)

**Done:**
- **LangFuse v3 stack** in `docker-compose.yml`:
  - ClickHouse (`clickhouse/clickhouse-server:25.3`) with embedded ClickHouseKeeper via `infra/clickhouse/cluster.xml` (needed for `ReplicatedMergeTree` tables used by LangFuse migrations).
  - `langfuse/langfuse:3` web server + `langfuse/langfuse-worker:3` worker (v3 splits ingestion into a separate worker process).
  - MinIO `langfuse-events` bucket for S3-backed event upload storage.
  - All env vars: `CLICKHOUSE_URL` (HTTP/8123 for queries), `CLICKHOUSE_MIGRATION_URL` (native/9000 for migrations), `CLICKHOUSE_PASSWORD`, `LANGFUSE_S3_EVENT_UPLOAD_*`, `REDIS_HOST/PORT`.
- **`backend/src/instrument.ts`** — OTel SDK bootstrap: `LangfuseSpanProcessor` from `@langfuse/otel`, started on module load, exported `shutdownTelemetry()` for graceful shutdown.
- **`main.ts`** — imports `./instrument.js` as side-effect (must run before any DI wiring).
- **`createTelemetry()` helper** in `backend/src/ai/telemetry.ts` — wraps `experimental_telemetry` object; wired into `StoryGeneratorService.generateStory()` and `StoryEvaluatorService.evaluate()`.
- **`backend/src/ai/schemas/story.schema.ts`** — changed `text` and `title` from `.optional()` to `.nullable()`. OpenAI structured output requires all properties in `required`; `.optional()` removed them, causing 400 errors.
- **`book-plan.validator.ts`** — updated null checks from `!== undefined` to `!= null`.
- **Spec files** — added `text: null, title: null` to all inline `Page` objects across 5 spec files.
- **Verified:** LangFuse UI at `localhost:3030` shows 2 parent traces (`story-generation`) with 15 child spans each. `./init.sh` exits 0, 52 tests passing.

**Decisions:**
- `@langfuse/otel@5.x` requires LangFuse v3 (adds OTLP endpoint); v2 returns 404.
- `.nullable()` over `.optional()` in PageSchema — OpenAI structured output requires fields stay in JSON Schema `required`.
- `tsx` for scripts — handles Prisma 6 ESM client natively; ts-node creates CJS/ESM cycle.
- `shutdownTelemetry()` called explicitly in scripts — `process.exit` bypasses SIGTERM, spans would not flush otherwise.

**Next:**
- #13 StoryEvaluator service (seams in place).
- #15 BullMQ generation queue.
- #16 Google OAuth + JWT.

**Blockers:**
- None.

---

## 2026-05-29 — #16: Google OAuth + JWT authentication (PR #70)

**Done:**
- **Prisma migration** `20260529165023_add_user_refresh_token` — `User.refreshToken String?` для хранения SHA-256 хэша refresh token (одна активная сессия на юзера).
- **`AuthService`** — `validateOrCreateUser` (upsert по googleId/email), `generateTokens` (access 15m / refresh 7d, числовые секунды), `exchangeRefreshToken` (verify + hash match + rotate), `logout` (clear hash).
- **`GoogleStrategy`** + **`JwtStrategy`** — Passport strategies через ConfigService.
- **`AuthController`**: `GET /auth/google`, `GET /auth/google/callback` (redirect frontend с токенами в query params), `POST /auth/refresh`, `POST /auth/logout`.
- **`JwtAuthGuard`** + **`@CurrentUser()`** — готовы для защиты routes.
- **`ConfigModule.forRoot({ isGlobal: true })`** в AppModule; `.env.example` дополнен.
- 64 теста, `./init.sh` зелёный.

**Decisions:**
- `expiresIn` числом секунд (не строкой) — `@nestjs/jwt@11` использует `ms@3` с template literal `StringValue`, которому `string` не присваивается.
- Refresh token хранится как SHA-256 хэш — подпись секретом защищает от подделки, хэш нужен только для инвалидации.
- Inline `eslint-disable` не использовали — заменили вложенный `expect.objectContaining` на явный `toHaveBeenCalledWith`.

**Next:**
- #15 BullMQ generation queue.
- #17 Puppeteer PDF rendering.
- #18 Frontend: Google login (разблокирован этим PR).

**Blockers:**
- None.

---

## 2026-05-29 — #15: BullMQ generation queue + processor (PR #71)

**Done:**
- `generation.types.ts` — `GENERATION_QUEUE`, `GENERATE_BOOK_JOB` constants, `GenerateBookPayload`, `GenerationProgress` types.
- `GenerationService` — `enqueueBook()` (ownership + status guard: throws `NotFoundException` / `ConflictException`), `getJobStatus()`.
- `GenerationProcessor` — `@Processor(GENERATION_QUEUE)`, extends `WorkerHost`, sets `Book.status` lifecycle (`generating → ready / failed`), calls `StoryOrchestratorService.generate()`, progress updates 10/20/80/100%.
- `GenerationController` — `POST /books/:id/generate` (JWT-protected, 202 Accepted), `GET /jobs/:jobId/status`.
- `GenerationModule` — `BullModule.registerQueue` only (`forRootAsync` moved to `AppModule` per code review).
- Code review fixes: `job.id ?? bookId` → explicit throw; raw string literals → `BookStatus` enum; dead `getJobName()` removed; `generatingSet` flag guards against double-fail on DB error; `BullModule.forRootAsync` moved to `AppModule`; `GET /jobs/:jobId/status` added.
- 81 tests passing, `./init.sh` green.

**Decisions:**
- `BullModule.forRootAsync` belongs in `AppModule` (global registration), not in feature modules — avoids hidden ordering dependency when a second queue consumer is added.
- `BookStatus` enum used everywhere — raw string literals would silently break on schema rename.
- Code review run as foreground subagent (blocking) — correct because review result gates what to fix before merge.

**Next:**
- #17 Puppeteer PDF rendering (Page Templates from #60 already done).
- #18 Frontend: Google login + protected routes (unblocked by PR #70).
- #20 Frontend: SSE progress stream (`updateProgress` hooks in place).

**Blockers:**
- None.

---

## 2026-05-29 — Grilling session: development trajectory + process improvements

**Done:**
- Velocity audit: 29/37 issues closed in 8 days vs original 5-week plan (~70% complete in 23% of budget). Roadmap velocity 2-3× faster than estimated.
- 7-question grilling on process gaps and risks identified. 6 new issues created + 1 closed + 1 split.

**Decisions (with rationale):**
- **#72 eval-corpus harness** (Week 4) — pause after #17+#19 to populate `StoryEval` with 30 real generations before #27 admin dashboard. Why: without real judge data, dashboard is mocks; defense centerpiece is the metric story.
- **#74 frontend test infra** (Week 3, before #18) — Vitest + RTL + MSW + Playwright. Why: zero frontend tests now, 5 frontend issues incoming; without safety net agent has no UX feedback loop.
- **Frontend design workflow: Claude Design + ASCII** — for each frontend issue, user creates Claude Design prototype, exports PNG to `docs/design/`, agent reads via multimodal Read + structural ASCII wireframe in issue body. Why: closes the visual-judgment gap for agents without Figma overhead.
- **#26 Fast Flow split → #75/#76/#77/#78** — original one-issue was 4 different concerns (content/illustrations/service/frontend), violating one-issue-one-PR pattern. Illustrations: DALL-E pre-gen (~$2 one-time) over stock/skip for visual consistency with Custom Flow.
- **#22 dev VPS merged into #29 prod deploy** (Week 5) — local docker-compose covers 95% of testing scenarios; one deploy session catches the same prod risks (Puppeteer headless, OAuth callback URL, TLS) as two.
- **#79 defense demo script** (Week 3, early) — written NOW so its requirements flow back to #25/#27/#72 priorities, not after-the-fact in Week 5.

**Revised timeline:**
- Remaining: ~17 issues across Weeks 3-5.
- At current 3-issue/day pace: code-complete ~**6-8 June** (was: 25 June).
- ~2-week buffer before defense — to be used for eval-data accumulation, demo rehearsal, polish.

**Next:**
- #17 Puppeteer PDF rendering (next pickup).
- Then #74 frontend test infra → #18 login → #19 form → eval-corpus pause (#72) → #20 SSE.

**Blockers:**
- None.

**Frictions:**
- 5 process-improvement issues created in one session — agentic dev was running on auto-pilot without a periodic audit. Should schedule similar grilling reviews every ~1 week to keep priorities aligned with defense.

---

## 2026-06-01 — #80 ImageGenerator + #82 S3 keys + #17 PDF rendering (PRs #81, #86, #87)

**Done:**

### PR #81 — ImageGenerator (#80)
- Identified planning gap during grilling: AI pipeline diagram had `ImageGenerator` step but no issue, no code, no `illustrationUrl` field in schema. Created #80 before starting #17 PDF.
- New `S3Module` + `S3Service` wrapping AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`). `uploadObject({ key, body, contentType })` + `getSignedUrl(key)`. Reads config from env (`S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`).
- `ImageGeneratorService` uses Vercel AI SDK `generateImage` against `openai.imageModel('dall-e-3')`. Parallel `Promise.all` per page. DALL-E size from `PAGE_TEMPLATES[template].images[0].dalleSize`. Style suffix appended. LangFuse child span per page (substituted for `experimental_telemetry` after verifying AI SDK v6 image generator doesn't accept that param). `ImageContentPolicyError` typed exception detects DALL-E safety refusals via error-message regex.
- Code review found 3 Critical + 4 Important. Fixes applied: explicit `maxRetries: 1`; storyJson persisted BEFORE image-gen (so DALL-E failure doesn't lose validated story); image-gen extracted from orchestrator into processor; `IMAGE_QUALITY` constant consumed; no silent dalleSize fallback.
- Architecture shift: `StoryOrchestratorService` is now eval-loop-only. `GenerationProcessor` sequences story → persist → images → persist → ready. Cleaner separation.
- Re-review accepted the substitution + fixes. 3 follow-up issues filed (#83 BullMQ retry + skip-orchestrator-on-retry, #84 `BookStatus.images_failed` + robust content-policy detection, #85 stale-book sweeper).

### PR #86 — S3 keys not URLs (#82)
- Code review of #81 surfaced latent landmine: `Book.imageUrls` stored 7-day signed URLs at generation time. After expiry, DB rows persist with dead URLs.
- Renamed `Book.imageUrls` → `Book.imageKeys` (`RENAME COLUMN`, no data loss). `ImageGeneratorService` now returns S3 keys.
- New `BookImageService.signKeys(keys)` — signs on read. To be used by future `GET /books/:id` endpoints (#19/#20) and PDF renderer.
- Mechanical refactor, ~90 LOC diff, no architectural change → skipped pre-merge code review per the policy fixed during grilling.

### PR #87 — Puppeteer PDF render (#17)
- New `PdfRenderService`: 6 HTML page templates cached at module init (`readFileSync`), placeholder substitution per page, multi-page A5 (874×1240) HTML doc assembled with `page-break-after: always`, Puppeteer headless → PDF buffer → S3 at `books/<bookId>/book.pdf`.
- HTML escaping on all LLM-output text/title. Browser closed in `finally`. Discussion questions scoped to final page only.
- `BookImageService.signKey(key)` singular helper.
- Prisma: `Book.pdfUrl` → `Book.pdfKey` (consistency with #82).
- `GenerationProcessor` chained: orchestrator → persist storyJson → image-gen → persist imageKeys → sign URLs → PDF render → persist pdfKey + status=ready. Split persistence so PDF failure preserves storyJson + imageKeys.
- **Code review caught a CRITICAL defect** that all 105 tests missed: HTML templates were not copied to `dist/` (no `assets` config in `nest-cli.json`). Production startup would have crashed with ENOENT on first boot. Fixed: added `assets: [{ include: "pdf/page-templates/*.html" }]` to nest-cli.json; verified `pnpm exec nest build` now copies HTMLs to `dist/pdf/page-templates/`.
- Additional fixes from review: `--no-sandbox` gated on `PUPPETEER_NO_SANDBOX` env var (security: don't disable Chromium sandbox by default in dev/CI); `waitUntil: 'networkidle0'` instead of `'load'` (wait for remote signed-URL images); `escapeAttribute` now escapes `&` (signed URLs contain query-string `&`); `safeImageUrl` scheme allowlist (https/http only, defensive against future `javascript:`/`data:` bugs); ordered assertions in failure-path test (`toHaveBeenNthCalledWith`).
- 2 follow-up issues: #88 manual PDF smoke test with real Puppeteer, #89 prod Dockerfile Chromium runtime deps + `PUPPETEER_NO_SANDBOX=true` + BullMQ job timeout.

**Decisions (with rationale):**
- **Re-review policy fixed** during #81 fix session: re-review only when (a) architectural shift, (b) substitution of recommended approach, (c) new critical test, or (d) ≥3 connected Critical fixes. Mechanical/targeted fixes get no re-review. Applied: re-review for #81 (architectural shift image-gen → processor), first review for #87 (new feature, new dependency, multi-step pipeline). Skipped for #86 (mechanical refactor).
- **storyJson preservation across pipeline stages**: split `book.update` into 4 sequential calls so each completed stage's output survives later failures. Trade-off: 3× more DB writes per book; gain: image-gen or PDF failure leaves a recoverable state (future #84 partial recovery API).
- **S3 keys, not signed URLs, in DB**: the column name encodes the intent. Sign-on-read pattern via `BookImageService` is the canonical way to expose URLs to clients.
- **DALL-E size driven from PAGE_TEMPLATES**: same single-source-of-truth pattern as the StorySchema enum. Future template-catalogue changes propagate automatically.

**Architecture:**
- Full backend AI pipeline now complete: Form → BullMQ enqueue → Orchestrator (RAG + Story + Eval + retry) → ImageGenerator (DALL-E + S3 keys) → PdfRenderer (Puppeteer + S3 PDF) → `Book.{storyJson, imageKeys, pdfKey, status=ready}`.
- LangFuse traces: `story-generation` (parent for eval loop) + `image-generation` (parent for per-page DALL-E spans). PDF render is logged but not in LangFuse (not an AI call).

**Next:**
- #74 frontend test infra — Vitest + RTL + MSW + Playwright. First frontend work, unlocks #18/#19/#20.
- Then #18 Google login → #19 create-book form → pause for #72 eval-corpus → #20 SSE progress.

**Blockers:**
- None.

**Metrics:**
- 64 → 105 backend tests (+41 over the session).
- 30 → 33 issues closed (#80, #82, #17 merged).
- 7 new follow-up issues filed (#82-#85, #88, #89, #79, #72, #74-#78 — partial overlap with grilling outputs).
- Code-complete trajectory unchanged: ~6-8 June at current pace.

**Frictions:**
- Forgot to bundle progress.md into feature PRs (per AGENTS.md rule). Fixing with this standalone docs PR. Established practice for next session: add progress.md entry to first commit of each feature branch.
- Pre-existing migration drift: each `prisma migrate dev` autogenerates `DROP INDEX VocabularyEntry_embedding_hnsw_idx`. Manually trimmed three times now. Root cause: schema doesn't declare the HNSW index (it's only in a separate migration), so Prisma's schema-to-migration diff treats it as drift. Worth a follow-up to declare the index in `schema.prisma` once Prisma supports HNSW natively, or document the manual-trim step prominently.

---

## 2026-06-03 — #74 frontend test infra + #24 Stripe webhooks (PRs #92, #93)

**Done:**

### PR #92 — Frontend test infrastructure (#74)
- `vitest.config.ts` — Vitest + @vitejs/plugin-react, happy-dom, globals, setupFiles.
- `tests/setup.ts` — @testing-library/jest-dom + MSW server lifecycle.
- `tests/mocks/handlers.ts` + `server.ts` — MSW v2 node server scaffold.
- `frontend/src/app/page.test.tsx` — 2 unit tests (brand name render, h1 heading).
- `playwright.config.ts` + `e2e/smoke.spec.ts` — Playwright E2E (title check).
- `init.sh` fixed: `vitest --run` flag added (without `--run` vitest enters watch mode in CI).

### PR #93 — Stripe webhooks (#24)
- `POST /api/stripe/webhooks` — validates Stripe signature via `stripe.webhooks.constructEvent`, delegates to `BillingService`.
- `BillingService` — idempotency via `StripeWebhookEvent` table; handles `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`.
- `StripeWebhookEvent` Prisma model + migration (HNSW drift trimmed per established pattern).
- `billing-types.ts` — `StripeInstance`/`StripeEvent` via `InstanceType<typeof Stripe>` to bypass Stripe v22 + `module: "nodenext"` + `isolatedModules` namespace type constraints. `WebhookSubscription`/`WebhookInvoice` interfaces handle both v1 and v2 Stripe billing API shapes (`current_period_end` moved to `SubscriptionItem` in v2; `invoice.subscription` nested under `parent.subscription_details` in v2).
- 13 tests across controller + service specs.

**Decisions:**
- **Stripe v22 type bypass**: `import Stripe from 'stripe'` in CJS (`module: "nodenext"` + no `"type": "module"`) resolves to `StripeConstructor` namespace which only exposes `type Stripe`, not `Event`/`Subscription`/`Invoice`. Workaround: derive types via `InstanceType<typeof Stripe>` + `ReturnType<>` — bypasses namespace lookup entirely.
- **`RawBodyRequest` as `type` import**: `isolatedModules: true` + `emitDecoratorMetadata: true` requires all types in decorated parameter positions to use `import type`. Fixed with inline `type RawBodyRequest` modifier.
- **Closed PR #73** (external contributor, merge conflicts) and reimplemented #24 from scratch.

**Next:**
- #18: Google OAuth login flow on frontend (button + callback page).
- #19: Create-book form (wizard UI).
- #20: SSE progress feed.
- #72: Eval corpus harness (can batch with #20).

**Blockers:**
- None.

**Metrics:**
- 118 backend tests (unchanged; billing tests added, replace the earlier stubs).
- 35 issues closed (#74, #24 merged).
- Code-complete trajectory: ~6-8 June.

---

## 2026-06-03 — Big push: frontend, fast flow, payments, admin, ops, compliance fix (PRs #94–#130)

Consolidated catch-up entry. 37 PRs squash-merged in one high-velocity day, grouped by theme below. Project went from backend-pipeline-complete to a working end-to-end product (auth → create → generate → read → admin → pay).

**Frontend core (auth + books + SSE):**
- **#94** Google OAuth login flow — auth guard, callback page, token store.
- **#95** Book creation form (wizard) + CRUD endpoints.
- **#96** SSE progress stream + book detail page (live attempt/stage feed).
- **#112** Enable CORS for the frontend origin.
- **#114** Auto-refresh JWT on 401 + add seed scripts.

**Fast Flow (template/AI fast path, no RAG/compliance — the #75–#78 cluster):**
- **#103** Tag taxonomy + `substitutePlaceholders` + 5 template stories.
- **#104** `FastIllustration` table + `pickIllustration` + DALL-E seed script.
- **#105** `FastFlowService` + sync `POST /books` routing.
- **#107** Frontend mode selector + fast-flow inline result.
- **#116** Gender-aware placeholders + expanded template text.
- **#123** Gender-correct all 5 seed templates + fix goal title mapping.
- **#125** Replace static template text with AI generation (still no RAG/compliance gate — that's the Custom Flow's job).
- **#106 / #126** lint cleanups (unsafe-any/unsafe-member-access in fast-flow specs).

**Payments (Stripe Checkout + quotas):**
- **#101** Stripe Checkout — `POST /api/stripe/subscribe` + pricing page.
- **#102** Subscription quota enforcement — free=1, basic=10, premium=∞.

**Admin:**
- **#97** `LearningGoal` CRUD + seed + user role + age-range filter.
- **#108** Books list + metrics dashboard (the defense-facing eval view).

**Ops / resilience (the #83–#85 follow-ups):**
- **#98** Skip orchestrator/image-gen on retry + BullMQ retry config.
- **#99** `BookStatus.images_failed` + partial recovery + content-policy detection.
- **#100** Stale-book sweeper — recover books stuck in `status=generating`.

**Build / model:**
- **#110** Switch to SWC builder + move Prisma client into `src/generated` (faster builds; client path now `src/generated/prisma`).
- **#118** Switch image model `dall-e-3 → gpt-image-1` (+ **#119** test assertion `standard → medium` quality).

**Security / correctness fixes:**
- **#121** Ownership checks on job-status and SSE progress endpoints (was leaking other users' generation state).
- **#127** Prevent duplicate child names per user.

**#130 — vocabulary compliance reachable (today's main session):**
- Root cause found during a custom-flow smoke test: stories scored 8.8–9.6 by the judge but `passed=false` because `vocabularyCompliance` landed ~0.11–0.21 against a `0.85` threshold. Two compounding bugs: exact string match against heavily-inflected Russian, and scoring against only the 80 RAG-retrieved words instead of the full grade corpus.
- Added self-contained Russian Snowball stemmer (`russian-stemmer.ts`); stem both story tokens and corpus before comparison.
- Score compliance against full grade-≤N corpus via new `VocabularyRagService.listByGrade()`; the 80 retrieved words still go only to the generator.
- Recalibrated `COMPLIANCE_THRESHOLD` `0.85 → 0.40` (empirical stemmed match ~0.45–0.54 vs ~436-word grade-≤1 corpus; noise floor ~0.14).
- Verified end-to-end against real DB + OpenAI ("Маша и волшебство дружбы") — passes compliance first attempt, `StoryEval` row written. Re-seeded the empty corpus (`pnpm --filter backend seed:vocabulary`, 812 words) that triggered the original crash. Cleaned up the two failed test books.

**Decisions (with rationale):**
- **Fast Flow stays gate-free.** Fast flow uses template/AI text with no RAG retrieval and no compliance check; the pedagogical vocabulary gate is the Custom Flow's differentiator. Keeping them separate avoids forcing template stories through a corpus they were never built against.
- **Compliance threshold is empirical, not aspirational.** 0.85 was an untested guess that made the gate unreachable. 0.40 was measured against the real stemmed corpus with headroom above the noise floor — a gate that actually discriminates.
- **gpt-image-1 over dall-e-3** for illustration generation (#118) — better instruction-following for the per-template prompts.
- **Prisma client moved into `src/generated`** (#110) so the SWC build and Jest resolve it without a separate out-of-tree path.

**Next (remaining open issues, ~10):**
- **Defense-facing:** #72 eval-corpus harness (populate `StoryEval` via 30 real generations) → #79 demo script → #32 defense prep / dashboard polish.
- **Deploy:** #29 prod deploy to Hetzner via Dokploy + #89 Dockerfile Chromium runtime deps + #30 Sentry/Loki monitoring.
- **Polish:** #31 UI polish pass, #28 SEO marketing pages, #88 manual PDF smoke test.
- **Post-defense:** #128 photo-based character generation (GDPR blocker).

**Blockers:**
- None.

**Metrics:**
- 118 → ~180 backend `it/test` cases.
- ~35 → ~45 issues closed (#94–#130 span; 10 open remain).
- Code-complete reached on the ~6–8 June trajectory — end-to-end product now functional locally.

**Frictions:**
- progress.md went 37 PRs stale (last entry #93). Single-day velocity outran the "bundle progress.md into each feature PR" rule. Caught during this review; reconstructed from git history. The bundling rule clearly isn't holding under high-throughput days — worth either enforcing it in the PR template/checklist or accepting periodic catch-up entries like this one as the actual workflow.
- HNSW migration drift trimmed again during fast-flow migrations (#103/#104) — same recurring `DROP INDEX` autogen noted on 2026-06-01. Still unaddressed at the schema level.

---

## 2026-06-03 — DX frictions fixed at the root (#133)

**Done:**
- **HNSW migration drift — root-caused and eliminated.** Prisma cannot represent `USING hnsw (embedding vector_cosine_ops)` in `schema.prisma`, so keeping the index in migration history made every `migrate dev` autogen a spurious `DROP INDEX`. Moved the index out of migrations into an idempotent SQL file (`backend/prisma/sql/hnsw-index.sql`). The `prisma:migrate` wrapper (`prisma/migrate-dev.mjs`) now drops the index → runs `migrate dev` clean → recreates the index. Emptied migration `20260525095439_add_vector_index` to a no-op. Fixed `db:hnsw-index` for Prisma 7 (`db execute` reads the datasource from `prisma.config.ts`; `--schema` no longer accepted).
- **progress.md bundling — added `.github/pull_request_template.md`** with a Definition-of-Done checklist (update progress.md, AI-pipeline evidence, Conventional Commits title) so doc updates stop getting forgotten.
- Verified `pnpm prisma:migrate` reports "Already in sync" with no drift/reset; HNSW index + all seed data intact (VocabularyEntry 812, LearningGoal 20, Template 5, FastIllustration 44).

**Decisions (with rationale):**
- **Index lives outside migration history, not inside.** Keeping it in migrations forces a perpetual trimmable `DROP`; the chosen drop-before/recreate-after wrapper keeps the dev DB matching migration history exactly, so `migrate dev` is clean every run. Prod uses `migrate deploy` (no drift detection) + the `db:hnsw-index` script, so the index is never dropped there.
- **Use `pnpm prisma:migrate`, not raw `prisma migrate dev`.** Raw `migrate dev` will still see the live index as drift and demand a reset; the wrapper is the supported entrypoint.

**Next:**
- Unchanged from prior entry (defense harness #72/#79/#32, deploy #29/#89/#30, polish).

**Blockers:**
- None.

---

## 2026-06-04 — Image-gen size bug fixed, end-to-end UI run verified (#135)

**Done:**
- **Verified book generation end-to-end through the UI** (frontend + backend, real OpenAI generation). Text pipeline confirmed healthy: RAG/HNSW retrieval, vocabulary compliance (0.468 ≥ 0.40), and LLM-as-judge all passed on attempt 1 (StoryEval finalScore 9). Book reached status `ready` with 8 images + PDF in S3.
- **Fixed image generation failure (#135 → PR #136).** `page-templates.config.ts` still carried dall-e-3 sizes (`1024x1792`/`1792x1024`), which `gpt-image-1` rejects with HTTP 400 ("Supported sizes are 1024x1024, 1024x1536, 1536x1024, and auto"). Renamed `DalleSize`→`ImageSize` and slot field `dalleSize`→`imageSize`, remapped all six templates to supported sizes, updated `image-generator.service.ts`.
- `./init.sh` green (0 errors); fix shipped via squash-merge.

**Decisions:**
- Image model is `gpt-image-1`, not dall-e-3 — its size set is the canonical constraint for any future template slot.

**Next:**
- Unchanged (defense harness #72/#79/#32, deploy #29/#89/#30, polish).
- **UI gap noted (not yet ticketed):** books in `images_failed` status show no retry button — only "Вернуться к книге". The `POST books/:id/retry-images` endpoint exists in the backend but isn't surfaced in the UI.

**Blockers:**
- None.

---

## 2026-06-04 — Language purity guard added to eval pipeline (#138)

**Done:**
- **Found quality gap:** the generated book contained an English sentence («Алиса learned to care about her friends…») in the final page. `checkCompliance` tokenises only Cyrillic, so Latin words were invisible to it; judge scored 9 and it passed. No deterministic guard existed for language purity.
- **Added `checkLanguagePurity`** in `vocabulary-compliance.ts`: scans `title`, `page.title`, `page.text`, `discussionQuestions` for Latin words (≥2 chars); `illustrationPrompt` is correctly excluded (required to be English). On failure, errors merge into `structuralErrors` → existing retry loop regenerates with explicit feedback («убери английские слова»).
- **Strengthened judge criterion 1** (`ageAppropriateVocab`): explicit −4+ penalty for non-Russian text in story fields.
- `./init.sh` green; fix shipped via PR #139.

**Decisions:**
- Language purity is a hard gate (deterministic), not a judge score — a 100% Russian story is a structural correctness requirement, not a quality dial.

**Next:**
- Unchanged.

**Blockers:**
- None.

---

## 2026-06-04 — Image prompt simplifier + SSE auth fix (#141, #144, #146)

**Done:**
- **Image prompt auto-simplify on content policy (#141 → PR #142).** `gpt-image-1` rejected an innocent illustration prompt ("Алиса in a dim room"). Added `simplifyIllustrationPrompt` in `backend/src/ai/image-generator/prompt-simplifier.ts` — calls `gpt-4o-mini` to rephrase the rejected prompt to a simpler, neutral form, then retries once. Only raises `ImageContentPolicyError` if the simplified prompt is also rejected. 170/170 tests green.
- **SSE onerror fallback (#144 → PR #145).** Progress page was unconditionally setting `failed=true` on any SSE error, showing «Не удалось сгенерировать книгу» even for books that were already `ready`. Fixed `onerror` to call `GET /books/:id`, redirect if `ready`, show error only for terminal-failed statuses.
- **SSE auth root fix (#146 → PR #146).** `EventSource` cannot send `Authorization` headers, so the SSE endpoint always returned 401 for authenticated users. Added `JwtSseStrategy` (passport-jwt) accepting the token from both `Authorization` header and `?token=` query param. Added `JwtSseAuthGuard`. Switched `ProgressController` to the new guard. Updated `progress/page.tsx`: checks book status on mount (redirects if already ready, ensures token is fresh), then opens `EventSource` with `?token=<accessToken>`.

**Decisions:**
- `?token=` query param exposure is acceptable for short-lived (15-minute) access tokens over HTTPS. The alternative (cookie-based SSE) requires cross-origin cookie config on the API server.
- Status check on mount before opening EventSource: double benefit — handles already-complete books (no spinner flicker) and ensures the API's auto-refresh logic has run before the token is embedded in the SSE URL.

**Next:**
- Unchanged (defense harness #72/#79/#32, deploy #29/#89/#30, polish).
- UI gap: `images_failed` books show no retry button (no ticket yet).

**Blockers:**
- None.

---

## 2026-06-04 — UI polish + deploy prep (#31, #89, #29)

**Done:**

### UI polish (#31 → PR #149)
- `frontend/src/lib/types.ts` — shared `BookStatus` union type.
- `frontend/src/components/ui/StatusBadge.tsx` — Russian-label badge with semantic Tailwind colours (ready=green, generating=blue, pending=gray, failed/generation_failed=red, images_failed=orange).
- Books list page — `StatusBadge`, `formatDate()` ("4 июня"), hover arrow, empty state (dashed border, 📚, CTA), quota banner.
- Book detail page — quality stats bar (оценка качества / попыток / страниц), pages rendered from `BookPage` rows (fast-flow) or `storyJson.pages[]` (custom flow), AI images via `next/image` with `unoptimized`, discussion questions section, `images_failed` retry button, skeleton loading.
- `GET /books/:id/image-urls` backend endpoint — bulk S3 presigned URL fetch.
- `next.config.ts` — `output: 'standalone'`, `images.remotePatterns` for MinIO (`localhost:9100`) and prod HTTPS.
- `next/image unoptimized` used for book-page illustrations: Next.js 14+ SSRF protection blocks `/_next/image` from fetching localhost IPs; `unoptimized` bypasses the optimizer for already-sized AI-generated PNGs.

### Deploy prep (#89 → PRs #147, #148; #29 → docs)
- `backend/Dockerfile` — multi-stage: builder (PUPPETEER_CACHE_DIR, pnpm install, nest build), pruner (pnpm deploy --prod), runner (14 Chromium runtime libs, PUPPETEER_NO_SANDBOX=true).
- `frontend/Dockerfile` — multi-stage: builder, runner (Next.js standalone output).
- `backend/src/generation/generation.processor.ts` — `lockDuration: 90_000` on `@Processor` to prevent BullMQ job stall during Puppeteer PDF render.
- `docs/adr/0003-chromium-runtime.md` — ADR for co-locating Chromium in API container.
- `docs/deploy-checklist.md` — 15-section production checklist: Hetzner VPS, Dokploy, services, env vars table, Google OAuth callback, Stripe webhook, `prisma migrate deploy`, seed commands, HNSW index, smoke test.
- Closed #72 (eval-corpus harness) as `wontfix` — jury evidence already provided by 2 real `StoryEval` rows from end-to-end runs; generating 30 synthetic books has no additional value.

**Decisions:**
- `unoptimized` on all book-page `<Image>` components rather than conditional by URL — presigned S3/MinIO URLs are already full-res AI-generated images; Next.js WebP resizing adds no value and breaks in dev.
- `lockDuration` on the Worker decorator (not `DefaultJobOptions`) — BullMQ only exposes `lockDuration` at the Worker level; `timeout` does not exist in `DefaultJobOptions`.
- Chromium co-located in API container (not a sidecar) — simpler Dokploy deployment; Puppeteer + API share a process, no IPC overhead. Documented in ADR-0003.

**Next:**
- #79 demo script — record end-to-end walkthrough for defense.
- #32 defense prep / dashboard polish.
- #28 SEO marketing pages (lower priority).
- #30 Sentry/Loki monitoring (lower priority).
- Hetzner VPS provisioning — manual user step, checklist in `docs/deploy-checklist.md`.

**Blockers:**
- None.

**Metrics:**
- `./init.sh` green (0 errors, 2 lint warnings).
- ~45 → ~47 issues closed.

---

## 2026-06-04 — Docs cleanup + issue triage

**Done:**
- Closed #72 (corpus harness) as wontfix — 2 real StoryEval rows are sufficient jury evidence.
- Closed #88 (PDF smoke test) as done — verified during full end-to-end run on 2026-06-04.
- Fixed `docs/ARCHITECTURE.md` stale content:
  - Image model `dall-e-3` → `gpt-image-1`, noted `Book.imageKeys[]` storage
  - Fast Flow description updated: it uses `generateObject` + AI since PR #125; LangFuse trace written
  - `Book` model sketch: removed non-existent `mode` field, `pdfUrl` → `pdfKey`, added `imageKeys[]`, fixed `title` (non-optional), added `images_failed`/`generation_failed` statuses
  - `StoryEval` model sketch: `scores` → `judgeScores`, `createdAt` → `generatedAt`, added `judgeReasoning`, `vocabularyCompliance`
  - Removed dead link to non-existent ADR `0001-ai-stack-vercel-sdk.md`
  - Backend port `4000` → `3001` in deployment diagram

**Next:**
- Code review of current codebase
- #29 Hetzner VPS provisioning (manual user step — follow `docs/deploy-checklist.md`)
- #32 Defense prep: eval dashboard polish + slides
- #28 SEO pages (lower priority)
- #30 Sentry/Loki (lower priority)

**Blockers:**
- None.

---

## 2026-06-04 — Code review findings applied (PR #151)

**Done:**
- High-effort code review (10 commits, 7 finder angles × parallel verify agents). 5 findings confirmed/plausible:
  1. `progress.controller.ts` — `images_failed` missing from terminal status guard; SSE endpoint hung.
  2. `progress/page.tsx` — `onerror` unconditionally called `es.close()`, killing browser SSE reconnect on transient errors.
  3. `books/[id]/page.tsx` — image URL fetch failure silently swallowed (empty `.catch(() => {})`).
  4. `types.ts` / `StatusBadge.tsx` — `generation_failed` phantom status (never existed in Prisma enum).
  5. All 4 AI services read `OPENAI_API_KEY` via `process.env` directly, bypassing ConfigService.
- Applied all 5 fixes on branch `issue/code-review-fixes` → PR #151 → squash-merged.
- `./init.sh` exits 0 (tsc + lint + 170 tests).

**Decisions:**
- `MAX_SSE_ERRORS = 5`: up to 5 transient SSE errors before giving up, rather than fail-on-first.
- `EVAL_THRESHOLD` also moved into ConfigService in `StoryEvaluatorService` (same pattern as OPENAI_API_KEY).
- Test fixtures for 4 AI spec files updated with `{ provide: ConfigService, useValue: mockConfig }`.

**Next:**
- #29 Hetzner VPS provisioning (manual user step — follow `docs/deploy-checklist.md`)
- #32 Defense prep: eval dashboard polish + slides
- #28 SEO pages (lower priority)
- #30 Sentry/Loki (lower priority)

**Blockers:**
- None.

---

## 2026-06-05 — External review (Codex) → security fixes + triage

**Done:**
- Reviewed a full-project audit done with Codex/GPT. Verified each finding against the code (treated the report as input, not truth).
- **Security PR #153 (merged):** fixed broken object-level authorization (IDOR) — `createBook`, `FastFlowService.generate`, and `listLearningGoals` now scope `Child` lookups by `{ id, userId }`; an unowned `childId` is rejected with 404 (existence not leaked). Also cut S3 presigned-URL TTL from 7 days → 30 min. Tests cover cross-user `childId` rejection for both flows.
- Filed issues for the deferred findings so nothing is lost:
  - #154 quota TOCTOU race (medium; transaction fix, no ledger table)
  - #155 release verification: builds + authenticated Playwright e2e (medium; before #29 deploy)
  - #156 auth hardening: localStorage tokens + SSE query token → cookies/SSE ticket (before public launch, NOT before defense — risky refactor)
  - #157 unify AI/env config (low; Fast Flow + EVAL_MAX_RETRIES via ConfigService; no factory)

**Decisions:**
- Did NOT do ledger table, AiProviderFactory, or cookie-auth refactor now — over-engineering for a course MVP before defense. Triaged to issues instead.
- Security fix landed FIRST as its own PR, before resuming the character-personalization feature (which adds more `childId` surface).

**In progress (paused):**
- Character personalization + illustration style feature. Spec + plan written and committed on branch `issue/character-personalization` (not pushed): `docs/superpowers/specs/2026-06-05-character-personalization-design.md`, `docs/superpowers/plans/2026-06-05-character-personalization.md`. Will rebase onto updated `main` before implementing (plan Task 7 touches `createBook`, which the security fix also changed).

**Next:**
- Resume character-personalization implementation (Tasks 1–9 in the plan).
- Then #29 deploy (do #155 verify.sh first), #32 defense prep.

**Blockers:**
- None.

---

## 2026-06-05 — Character personalization + illustration style (PR #158)

**Done:**
- Brainstormed → spec → plan → implemented (9 tasks) the character feature for the custom (AI) flow:
  - **Protagonist mode** per book: `child` (hero = the child, name + appearance used) vs `observer` (third-person story about an invented character; child's name/appearance NOT used — pedagogically safer for sensitive goals like tantrums/greed).
  - **Appearance**: free-text `Child.appearance`, reusable; blank → LLM invents. Entered inline when creating a new child.
  - **Art style** per book: watercolor (default) / cartoon / storybook / pixel / realistic → image-prompt suffix.
  - Bug fix: child `gender` now reaches generation (was collected but ignored).
- New Prisma enums `ProtagonistMode`/`ArtStyle` + columns + migration. `./init.sh` green (178 backend tests).
- Spec: `docs/superpowers/specs/2026-06-05-character-personalization-design.md`; plan: `docs/superpowers/plans/2026-06-05-character-personalization.md`.

**Decisions:**
- Photo → vision-agent / reference-image models DEFERRED (privacy + model-swap risk before defense). Text-based consistency is maximized via `characterProfile` prepended to every page, not guaranteed.
- Observer prompt never includes the child's name (avoids accidental leak into the story).

**Next:**
- Manual end-to-end verification of the two modes (live generation).
- #29 deploy (do #155 verify.sh first), #32 defense prep.

**Blockers:**
- None.

---

## 2026-06-09 — Read-aloud story quality: tuning, safety regression, strategy pivot

**Context:** all work below is on branch `issue/160-read-aloud-tuning` (PR #161) and is **NOT merged** — it can still produce unsafe stories. Canonical decisions (CONTEXT.md terms, ADR-0004) were committed to `main`.

**Done (on #161, unmerged):**
- Read-aloud text tuning: page text limit 120→220 (`image-top`/`image-bottom`), `DEFAULT_TOP_K` 80→150, vocab prompt reframed ("prefer" not "only"), vocabulary compliance decoupled from the hard pass-gate → soft signal.
- Judge `engagement` criterion added (`JudgeSchema` now 6 criteria) + storytelling brief; moral-repetition fix.
- Text-only eval harness `pnpm --filter backend eval:text "<goal>" <age> [child|observer]` — runs Vocab→Generator→Evaluator only (no images/PDF/DB), cents per run. Also generates exemplar drafts.

**Safety regression found (live):** pushing `engagement` (tension) made the model reach for a real danger — a *wild bear the child approaches and befriends* (goal Смелость). Passed the judge's `safetyForChildren` (a friendly bear isn't "violent"). → models dangerous real-world behaviour for a 5yo.

**Strategy pivot (grilling session, decisions):**
1. Steer quality with **Gold Exemplars (few-shot)**, not prose-rules (rules don't compose; each fix dents another).
2. Exemplar provenance: **draft → human (pedagogy-expert) approval**; 2–3 across goals; never pure auto-gen.
3. Storage: **static constants now**, RAG/pgvector later when the library grows.
4. **Safe-conflict boundary** (ADR-0004): constraint is on the modelled *action*, not the scary element. Emotional/social/internal conflict allowed; a real physical danger the hero approaches/befriends forbidden. Enforced in prompt + judge.
5. **Text-only harness** = cheap iteration loop + exemplar-draft generator.

**Committed to main:** `CONTEXT.md` terms (Gold Exemplar, Safe Conflict); `docs/adr/0004-safe-conflict-boundary.md`. Spec expanded with full strategy + status (on branch): `docs/superpowers/specs/2026-06-08-read-aloud-text-tuning-design.md`. Audio narration parked as issue #159.

**Honest status:** this is a *strategy/hypothesis, not a proven solution*. Not yet built: safe-conflict enforcement, the exemplars. Proof comes only after building 1 exemplar + safe-conflict and verifying via the harness across several goals.

**Next (to finish before merging #161):**
1. Enforce safe-conflict (generation prompt hard constraint + widen judge `safetyForChildren`) per ADR-0004.
2. Build 2–3 Gold Exemplars (harness draft → expert approval → wire as static few-shot).
3. Re-verify via harness; then merge #161.

**Merge-time doc TODO:** update `CONTEXT.md` "Judge Score" 5→6 criteria (+ engagement, widened safety) when #161 merges.

**Blockers:**
- None (decision-gated on building exemplars + safe-conflict).

---

## 2026-06-09 — Read-aloud quality: completed safe-conflict + exemplars + gpt-4o (#161 ready)

Continuation of the entry above. The three "Next" items are now **done** on branch `issue/160-read-aloud-tuning` (PR #161), verified via the text harness.

**Done:**
- **Safe-conflict enforced** (ADR-0004): hard rule 10 in the generation system prompt + widened judge `safetyForChildren`. Verified — the "bear" no longer appears (shadow→teddy, learning a scooter/shoelaces). Judge notes "no encouragement of risky behavior".
- **Three Gold Exemplars** (`backend/src/ai/prompts/exemplars.ts`): courage (Миша), kindness (Соня), independence (Тёма), human-approved, injected as few-shot by goal.
- **Story text → `gpt-4o`** (`STORY_MODEL`); judge + other calls stay on `gpt-4o-mini`. Text ~$0.02/book vs images ~$0.30/book. gpt-4o stopped copying the exemplar plot (original stories now).
- Experiment journal for the presentation: `docs/process/ai-text-quality-evolution.md` (gitignored; `docs/process/` added to `.gitignore`).
- Issue #162 filed: batch-eval harness + LangFuse datasets (for systematic version testing — later, YAGNI now).

**Outcome:** safe + original + structured + decent read-aloud stories. **Known limitation (honest):** the witty *voice* of the human exemplars doesn't fully transfer — `engagement` plateaus ~7; a model-capability ceiling, not a prompt gap.

**LangFuse clarification:** it IS wired and working in the real app (`instrument.ts` → `@langfuse/otel` NodeSDK; env keys set; `experimental_telemetry` on every LLM call). Only the standalone text harness emits no traces (by design). We already implement the tutorial pattern on a newer SDK — nothing to take.

**Next:**
- Merge #161 (ready). At merge: update `CONTEXT.md` "Judge Score" 5→6 (+ `engagement`, widened `safetyForChildren`) and note `gpt-4o` story-text model in `docs/ARCHITECTURE.md`.
- Separate stage: UI/UX redesign (remove existing/new toggle; visual polish) with the user's Claude Design references — frontend, independent of text quality.
- #29 deploy (do #155 verify.sh first); #32 defense prep.

**Blockers:**
- None.

---

## 2026-06-11 — UI redesign: design system + core screens (PR #164)

**Done:** Adopted the Claude Design handoff (path A) and restyled the core authenticated screens onto it.
- **Design system** (`globals.css`): OKLCH token palette (Indigo/Teal/Gold), light + dark via `[data-theme]`, gradients/shadows/radii mapped into Tailwind v4 (`@theme inline`) + a `sg-*` component layer (cards, inputs, segments, radio-cards, badges, buttons, style grid, page rows). Body aura background.
- **Fonts:** the design's Bricolage/Outfit have NO Cyrillic (UI is Russian) → swapped to Cyrillic-capable **Unbounded** (display) + **Manrope** (body) via next/font.
- **New-book form** restyled + the agreed structural change: **existing/new toggle removed** (always inline child; submit upserts the child by name), appearance shown only in child-hero mode, art style as a visual swatch grid.
- **Books list** → cover-card grid (gradient placeholders, status badge overlay). **Book detail** → display header, stats card, image+text page rows, gradient question numbers. **StatusBadge** → design badge variants.
- Verified live on real data (auth + real illustrations). `./init.sh` green.

**Notes:**
- Cover placeholders are gradients (the list endpoint has no cover URL). Real covers = a later backend tweak.
- Font swap from the design's choice is the one deliberate deviation (Cyrillic); one-line to change in `layout.tsx`.

**Next (separate stages, per user):** landing `/`, login, pricing `/pricing`, theme toggle. Then #29 deploy (do #155 verify.sh first), #32 defense prep.

**Blockers:** None.

---

## 2026-06-11 — Art-style preview thumbnails (PR #165)

**Done:** Replaced the gradient color swatches in the new-book art-style picker with real reference images. Each preview is one neutral scene (child + fox in a park) rendered through the **actual** book pipeline (`gpt-image-1` + `STYLE_SUFFIXES`), so the picker honestly shows what each style produces.
- One-off generator `backend/src/scripts/gen-style-previews.ts`; PNGs in `frontend/public/styles/` (downscaled with `sips -Z 360`).
- New-book form uses `next/image` over `.sg-style-sw`.

**Notes:** the generator is a committed dev tool (reproducible if a style suffix changes), never wired into runtime.

**Blockers:** None.

---

## 2026-06-11 — Public marketing screens: landing + login + pricing (PR #167, closes #166)

**Done:** Built the three public screens from the Claude Design handoff, completing the UI redesign (#164 covered the authed app screens).
- **Landing `/`** — `PublicNav`, hero with an animated CSS 3D book cover + trust row, features (3), how-it-works steps (3), sample spreads (3), gradient CTA, footer.
- **Login `/login`** — design-system auth card on aura background; real Google OAuth preserved.
- **Pricing `/pricing`** — Basic/Premium (Premium featured); Stripe subscribe flow + auth gate preserved; copy fixed to "Иллюстрации ИИ".
- **Theme toggle** — stateless, CSS-driven icon via `[data-theme]`; `ThemeInit` applies the stored theme on every route. No `dangerouslySetInnerHTML` (rejected as a smell).
- **CTA routing** — auth-aware: guest → `/login`, authenticated → `/books/new`.
- Marketing-only classes in a separate `marketing.css` (`@layer components`), imported after `globals.css` to keep `globals.css` under the 400-line guideline. (A `@import` inside `globals.css` did not resolve under Tailwind v4 + Turbopack → imported as a sibling stylesheet in `layout.tsx`.)
- Spec: `docs/superpowers/specs/2026-06-11-public-marketing-screens-design.md`.
- Verified live in-browser (light + dark, theme persists across routes, app screens unaffected).

**Notes:**
- Landing sample spreads + hero cover are decorative gradients (no real cover URL yet).
- Out of scope: SEO/OG tags (#28), deploy.

**Blockers:** None.

---

## 2026-06-11 — Docs + CI cleanup (PR #169, #171)

Found while auditing docs and chasing a red CI:
- **#169 (closes #168)** — `ARCHITECTURE.md` had drifted: fixed backend module tree (`billing`/`s3`/`instrument.ts`/`admin`/`fast-flow`/`prisma`/`generated`), flat public frontend routes + `marketing.css`, 6 judge criteria (added `engagement`), `LearningGoal`/`Template`/`Subscription` schema, RAG top-K 150. (`CONTEXT.md` was already current.)
- **#171 (closes #170)** — `main` CI was **red**: `gen-style-previews.ts` used `import.meta.dirname`, but the backend compiles to CommonJS, so `tsc --noEmit` failed (`TS1470`). It shipped red via #165 (runs fine under `tsx`, but `init.sh` runs `tsc`); #169 inherited the red. Fixed by switching to `__dirname`.

**Lesson:** `init.sh` typechecks with `tsc`, not just `tsx` — one-off scripts in `backend/src/scripts/` must be CommonJS-compatible (`__dirname`, not `import.meta`). Don't self-merge before CI is green.

**Blockers:** None.

---

## 2026-06-25 — Character-consistent illustrations via Gemini reference portrait (PR #175, closes #174)

**Done (built via subagent-driven development — per-task review + final whole-branch review):**
- **Provider strategy** (`backend/src/ai/image-generator/providers/`): `ImageProvider` interface + two impls behind `IMAGE_PROVIDER=gemini|openai`. Both use the SAME Vercel AI SDK `generateImage` shape.
  - `GeminiImageProvider` — **Gemini 2.5 Flash Image** (`google.image('gemini-2.5-flash-image')`), `aspectRatio` from an `imageSize→aspectRatio` map, reference via `prompt.images`. **Default.**
  - `OpenAiImageProvider` — the existing gpt-image-1 path wrapped behind the interface; config-selectable escape hatch.
- **Portrait stage** — when the story has a `characterProfile`, generate one reference portrait → S3 + new `Book.characterPortraitKey` (migration `20260624000000`), reused on retries; passed as a reference to every page so the protagonist looks the same across all pages.
- Prompt builders as constants; simplify-on-refusal retry preserved (`ImageGenerationError('refused')` → terminal `ImageContentPolicyError` → `images_failed`); LangFuse span `image-generation.portrait` + provider metadata.
- **Cover fix** (`story-generator.prompt.ts` rule 11): illustration prompts must never request text/titles inside the image (Gemini was baking a hallucinated English title onto the cover).
- New dep `@ai-sdk/google`. Needs a billing-enabled Google project with prepaid credits (free tier = 0 for image models); on quota exhaustion → `images_failed`, flip `IMAGE_PROVIDER=openai`.

**Live e2e:** generated a custom book end-to-end on Gemini — the same red-haired girl in a green dress on all 7 pages, portrait stored, `characterPortraitKey` set, clean text-free cover (9.3/10). The win text-only `characterProfile` couldn't deliver.

**Validation:** `./init.sh` green (backend 192 tests, frontend 13). Process learning recorded: subagent briefs must include a **lint** step — the implementers ran tsc+tests but not lint, so 12 lint errors slipped to the final `init.sh`; a `pnpm add` also re-linked node_modules and broke frontend eslint-config-next (fixed by `pnpm install`).

---

## 2026-06-25 — Real cover thumbnails + landing hero polish (PR #177, closes #176)

**Done:**
- **A — book list covers:** `/books` showed gradient placeholders. `listBooks` now returns a signed `coverUrl` (`imageKeys[0]` of ready books); cards render it via `next/image` **`unoptimized`** (signed MinIO URLs aren't server-optimizable — matches the detail page). Placeholder kept for not-ready books.
- **B — landing hero cover:** `.cover-art` was a plain gradient; now a diagonal striped purple gradient + white sparkles, matching the Claude Design mock.

**Verified in-browser** on real data (red-haired-girl covers + status badge; hero matches the mock). `tsc`/`lint` clean.

**Next:** PDF page templates from the Claude Design handoff (`pdf-templates/*.html`) — the renderer still uses the old templates; this is a separate feature (own brainstorm → spec → plan).

**Blockers:** None.

---

## 2026-06-25 — Claude Design PDF templates + Cyrillic book fonts (PR #180, closes #179)

**Done (brainstorm → spec → plan → inline execution):**
- Adopted the six redesigned "magic publishing" page templates (`backend/src/pdf/page-templates/*.html`) — cream paper, indigo ink, sparkles, full-bleed cover with a gradient curtain, final page with a moral accent phrase + numbered gradient question circles. Drop-in: same five `{{placeholders}}`, A5, classes → `pdf-render.service.ts` substitution + `page-templates.config.ts` unchanged.
- **Fonts:** the design's Bricolage/Outfit have no Cyrillic → **Comfortaa** (headings) + **Literata** (body). Self-hosted: `gen-pdf-fonts.ts` inlines the Cyrillic woff2 as base64 into a committed `page-templates/fonts.css`; `buildDocument()` injects it **once** → no network font fetch at render. `nest-cli.json` now copies `*.css` to `dist` (missing `fonts.css` fails fast).

**Live PDF e2e:** rendered a real book and inspected the PDF — cover, content pages, and final page all match the design; Russian renders in Comfortaa/Literata (no fallback); protagonist consistent (Gemini, #174). `./init.sh` green.

**Lesson:** after pulling a branch that adds an asset, the running backend must be restarted so the build copies it into `dist` (the fail-fast surfaced this).

---

## 2026-06-25 — Russian labels: name declension + age plural (PR #182, closes #181)

**Done:** the book-title fallback read "Книга для Маша" (wrong case). Added `frontend/src/lib/ru.ts` with `genitiveName()` (heuristic Russian first-name genitive — "Маша→Маши", "Тёма→Тёмы", "Иван→Ивана"; indeclinable/foreign names pass through) and moved `pluralYears()` there from the detail page. Used both in the `/books` card + detail title; the list age now pluralizes ("1 год / 2 года / 5 лет"). Unit-tested (`ru.test.ts`).

---

## 2026-06-25 — Docs sync (PR #173 + image-model follow-up)

- **#173 (closes #168 follow-up):** a 10-day-old PR finally merged — `CLAUDE.md`/`PROJECT_PLAN.md` story model `gpt-4o-mini → gpt-4o`, 5→6 judge criteria, `DALL-E → gpt-image-1`, ADR-0002 supersede note, `staged-books.md` re-stage warning, removed `meetup-harness-walkthrough.md`.
- **Image-model follow-up:** after #174 the default image model is **Gemini 2.5 Flash Image** (gpt-image-1 = fallback) — updated `CLAUDE.md`, `PROJECT_PLAN.md`, `CONTEXT.md`, `ARCHITECTURE.md` accordingly (character consistency moved from "out of scope" to done-via-reference-portrait).

**Open defense-prep tail:** `staged-books.md` Book 1 is flagged for re-staging (5-criteria, empty title) — regenerate a fresh fallback book under the current pipeline before the defense.

**Blockers:** None.

---

## 2026-06-25 — Session checkpoint (clean handoff)

**Verified state:** `main` green, **0 open PRs**, working tree clean. Shipped this stretch: Gemini character consistency (#174), PDF-template redesign + Cyrillic fonts (#179), real cover thumbnails + landing hero (#176), Russian label declension/plural (#181), and a full docs re-sync (core + defense docs now reflect 6 judge criteria + Gemini-default image model). A duplicate fork PR (#183) for #181 was closed.

**Servers (local):** backend `:3001`, frontend `:3000`, docker infra up. `IMAGE_PROVIDER` defaults to gemini; needs a billing-enabled `GOOGLE_GENERATIVE_AI_API_KEY`.

**Next (start here):**
1. **#32 — defense prep** (primary): slides + demo script + eval-dashboard polish. `docs/defense/` is now accurate — build the presentation on it.
2. **Re-stage the fallback demo book** (`docs/defense/staged-books.md`): the staged book is pre-`engagement` (5 criteria, empty title) — generate a fresh one under the current 7-criteria pipeline (incl. `earnedResolution`), update ID/scores/title.
3. **#162** — batch-eval harness + LangFuse datasets (strengthens the eval story).
4. Backlog (lower priority / post-defense): #154 quota TOCTOU, #157 config unify, #156 auth hardening, #159 TTS, #128 photo-gen (GDPR), #30 monitoring, #28 SEO, #143 dev-warning.

**Strategy reminder:** ~~no deploy for the defense~~ **SUPERSEDED 2026-06-26** — deploy IS now wanted and defense is de-prioritized; see the 2026-06-26 priority-reset entry at the end of this file.

**Blockers:** None.

---

## 2026-06-25 — Two-arc story model + earnedResolution criterion (issue #188, branch `issue/188-two-arc-story-model`)

**Done:**
- **T1** — `LearningGoal.arcType` enum (`virtue` | `flaw`) added to Prisma schema + migration; seed backfills all existing goals to `virtue`.
- **T2** — Flaw-arc Gold Exemplars added to `backend/src/ai/prompts/`; `pickExemplar()` is arc-aware (matches exemplar to goal title + arc type).
- **T3** — Story-generator prompt builder selects arc-specific beat sheet: virtue arc uses the existing four-stage setup; flaw arc injects a "Расплата" (consequence) beat and an earned-resolution rule (no instant forgiveness).
- **T4** — `arcType` threaded from `LearningGoal` through `StoryOrchestratorService` → `StoryGeneratorService` → `buildStoryUserPrompt`; `GenerateBookInput` carries it.
- **T5** — `earnedResolution` added as the 7th judge criterion in `JudgeSchema` + `JUDGE_SYSTEM_PROMPT`; admin metrics dashboard now shows it alongside the other six.
- **T6 (this session)** — Docs sync: ADR-0004 clarification (stakes vs danger), CONTEXT.md (Arc Type glossary entry + 7th criterion in Judge Score), ARCHITECTURE.md (arc routing in pipeline + StoryEval schema), qa-prep.md Q2 (6→7 criteria, Russian), staged-books.md (re-stage warning updated to 7 criteria), progress.md (this entry).

**Decisions:**
- Safe Conflict (ADR-0004) is NOT relaxed — emotional/social consequences are the engine of the flaw arc, not physical danger.
- `arcType` defaults to `virtue` on backfill so existing goals and exemplars are unaffected.
- `earnedResolution`: the judge is NOT told the arc — it applies one uniform "the resolution must be earned" bar to every story. The criterion text makes the flaw-cost ("Расплата") requirement conditional on the story being a flaw story, so a virtue story that earns its resolution scores full marks without a visible Расплата.

**Next:**
- **T7** — Run `./init.sh` (must exit 0), then trigger a live regeneration for a flaw-goal book and confirm the consequence beat appears in the output + `StoryEval` holds 7 criteria. Update staged-books.md with a re-staged fallback book once verified.

**Blockers:** None.

---

## 2026-06-26 — Priority reset + text-quality push (#188/#187 merged, #191 docs, RAG plan)

**Done:**
- **#188 (two-arc model) and #187 (appearance limit) merged to `main`** (`33e3731`, `d4bd213`). Live flaw regen verified the consequence beat + `earnedResolution` row.
- **Text-quality fixes** (in #188): removed beat-meta leakage ("но без последствий"), enforced hero-name consistency, demanded concrete external consequences, forbade characters (incl. mentors) from pronouncing the moral. Verified on 3 flaw goals via `eval:text`.
- **`eval:text` harness** now derives `arcType` from the goal — text-only A/B without burning image tokens.
- **#191 (this entry)** — docs recalibrated away from "course defense as the priority/substance" toward product quality + deployment (CLAUDE.md, AGENTS.md, PROJECT_PLAN.md, CONTEXT.md, ARCHITECTURE.md). `docs/defense/*` materials and ADRs left intact (history + tools for the eventual defense).

**Priority reset (supersedes earlier "defense prep (primary)" / "no deploy" notes above):**
- The course defense is **no longer the priority** — it remains a later milestone, not the organizing principle.
- **Priority 1: product quality** — genuinely good, non-banal story text. Blandness is the core problem.
- **Priority 2: deployment** — the app WILL be deployed (Dokploy/Hetzner); the earlier "no deploy" plan is reversed.

**RAG plan (agreed):** the vocabulary RAG constrains lexicon downward and contributes to banality.
- **Phase 1 (next):** stop injecting the allowed-words list into generation (free the lexicon); keep the `ageAppropriateVocab` judge as the age guardrail; drop the out-of-corpus regeneration feedback. A/B a stronger creative model via `eval:text` (Anthropic model needs the `@ai-sdk/anthropic` dep — discuss before adding).
- **Phase 2 (optional):** repurpose pgvector toward craft/exemplar retrieval (dynamic high-quality few-shot) so RAG serves voice.
- **#190 (vocab corpus fix)** to be reoriented or closed — fixing a vocab *limiter* loses meaning if we free the lexicon.

**Next:**
1. Open `issue/191` PR (docs recalibration).
2. RAG Phase 1 — separate issue/branch: remove vocab injection from generation + clean regen feedback; re-test text via `eval:text`.
3. Discuss model A/B (dep decision) and run the comparison.
4. Plan deployment as its own workstream (brainstorm → spec).

**Blockers:** None.

---

## 2026-06-27 — Text-quality design grill → ADR-0005 (decomposed pipeline)

**Done:**
- **Grilling session** (`/grill-with-docs`) on the core problem — story-TEXT quality (banal vs ornate). Reframed it from a single register dial to three root causes: (1) one overloaded `generate` call, (2) mis-calibrated "writerly" exemplars + a per-page density spec that manufactures over-writing, (3) a judge blind to register that dilutes craft 1:7.
- **Studied a real published book** (Usborne First Reading, *The Boy Who Cried Wolf*, in `~/Downloads/book_example.pdf`) + picture-book craft sources. Target register = **spare + dialogue-forward + picture-trusting**: short plain sentences, dialogue carries the story, almost no simile, description is the illustrator's job. Our exemplars (e.g. "как два сонных червяка") are over-written by comparison.
- **`ADR-0005` written + committed** (`99331cc`): decompose `generate` into **Plan → Prose → Edit** (by concern, not by page); `StoryPlan` as first-class consistency anchor; retarget register; rebuild exemplars (used by both prose and judge); **split judge into Guardrail gates + two-sided `registerMatch`** so the craft signal can't be averaged away; **drop vocabulary-RAG** (pgvector repurposed for future craft-exemplar retrieval).
- **CONTEXT.md updated** (same commit): new terms `Story Plan`, `Prose Pass`, `Read-Aloud Edit`, `Register Match`; updated `AI Pipeline`, `Custom Flow`, `Judge Score`, `Gold Exemplar`; deprecated `Vocabulary Entry` / `Grade Level`.
- **Validation-gate experiment** (per ADR) via `eval:text` on Честность + Смелость: retargeting the prose spec + 2 exemplars to the spare register shifted output decisively (avg **145→74** and **137→61** chars, dialogue-forward, no scenery padding, no mid-story moralising). The current judge stayed at engagement **7** / finalScore ~8.7 across the whole shift → **empirical proof the judge is register-blind**. Experiment edits reverted (clean tree); ADR/CONTEXT remain committed.

**Decisions:**
- Reference repo `yakovlef/storycraft` is **behind us**, not a model to copy (raw per-page calls, no judge/structure). Its only transferable idea — decomposition — is adopted.
- **Exemplars are NOT dropped** — they are the operational definition of "good" and the judge's `registerMatch` yardstick. They are *rebuilt*, not removed.
- Correction to sequencing: the `registerMatch` judge depends on trustworthy exemplars, so **"the meter" = rebuild exemplars (spare *and* lively) FIRST, then build the judge.** Sparse ≠ automatically lively (the quick spare rewrites tipped into terse-flat); liveliness must come from characterful, funny dialogue.
- Issues: **#190 to close** (fixing a removed vocab limiter is moot); **#193 reframe** "free the lexicon" → "remove vocab-RAG from pipeline".

**Next (the meter, then decomposition):**
1. Rebuild exemplars → spare **and** lively (Usborne as north star), update `exemplars.spec.ts`.
2. Build `registerMatch` judge: split schema (Guardrails gates + Craft), judge prompt shows exemplars, two-sided (penalise flatter AND ornate); stop averaging craft into the mean.
3. Generation decomposition: `StoryPlan` schema + Plan/Prose/Edit phases; choose Prose-phase model via `eval:text` under the new meter.
4. (Branch hygiene) Decide #193 PR scope now that it carries the ADR.

**Blockers:** None.

---

## 2026-06-27 (cont.) — register corrected (Сутеев) + exemplars rebuilt + age bands

**What changed since the entry above (important reversal):**
- The "spare register" direction from the entry above was **WRONG and is reversed.** A spare experiment was rejected by the product owner as "оборвано, скупо, плоско". Root cause: Usborne *First Reading* is an early-**decoding** reader (child reads it), not our genre. Our genre is **parent-read-aloud illustrated storybook**.
- **New north star: Сутеев / Russian folk-tale read-aloud voice** (portal `deti-online.com/skazki/dlya-detey-4-5-let`). Rich, warm, musical: warm narrator ("Жил-был…"), folk rhythm/inversion, gentle humour, natural dialogue, real feeling, lesson emerging once. Enemy is two-sided — flat summary AND adult preciousness; **richness of voice is the GOAL**.

**Done (committed `46e5cc5`):**
- All 6 gold exemplars rebuilt to the Сутеев register (5–6 band). Converged via tight loop on ONE (Гриша) until product owner approved ("это подходит"), then propagated. tsc 0, prompt tests 11/11, lint 0.
- ADR-0005 amended (register correction + age bands); CONTEXT.md `Gold Exemplar` / `Prose Pass` wording corrected.

**Decisions (new):**
- **Age bands: 3–4 and 5–6; drop 7–8** (independent readers, different product). **5–6 = flagship** (both arcs, Сутеев). **3–4 = simpler, repetition-driven, virtue-only** (flaw "Расплата" too heavy for 3–4). Register/exemplars/template caps become **per band**.
- "More text" = **more pages** (page stays short + image), not denser pages; the Plan phase spreads the arc across age-capped pages.
- **Personalization** (user supplies interests / motifs / soft words / child's likes → more personal, less generic) = **separate workstream, deferred**, needs its own discussion → likely its own issue. Seeds feed the Plan phase; words are SOFT (weave-if-natural), never hard constraints (avoid recreating vocab-injection flattening). Directly attacks banality (generic input → generic output).

**Next:**
1. (When postgres is up) `eval:text` a flaw + virtue goal to see generation under the new exemplars (judge still register-blind — eyeball only).
2. Build `registerMatch` judge: split schema (Guardrail gates + Craft), judge prompt shows exemplars, two-sided. Then the prose signal stops being averaged away.
3. Generation decomposition (`StoryPlan` → Plan/Prose/Edit); choose Prose model via `eval:text` under the new meter.
4. 3–4 band profile (simpler exemplars + smaller template caps) after 5–6 is solid.
5. Personalization: brainstorm → spec → issue.

**Blockers:** postgres/docker stack was down at end of session (`eval:text` needs it); user runs the stack themselves.

---

## 2026-06-27 (cont. 2) — registerMatch judge built + model A/B done

**Done (committed):**
- `e872a3c` — **`registerMatch` judge**: split criteria into Guardrails (gates) + Craft; judge shows 2 exemplars and scores register **two-sided**; accept = guardrails ≥ floor (6) AND registerMatch ≥ threshold (7); `computeFinalScore` = registerMatch (no mean). Replaces single-sided `engagement`. Acceptance: text that scored a flat 9.43 (praising "туча заволокла солнце") now scores 7–8 with register-specific reasoning. tsc 0, ai tests 96/96, lint 0.
- **Model A/B under the new meter** (3 runs × {gpt-4o, gpt-5, gpt-4.1} × {Смелость, Честность}): registerMatch means 7.5 / 7.83 / 8.0 — all within noise. **gpt-4.1 disqualified** (passed 1/6 — overflows page caps). **Decision: stay on gpt-4o** — model is NOT the lever; the ~7–8 ceiling is set by the overloaded single call. Recorded in `docs/process/ai-text-quality-evolution.md` (Глава 2).

**Next:** generation **decomposition** (`StoryPlanSchema` + Plan/Prose/Edit) — the last big lever, now measurable. Then revisit Prose-phase model under the meter; then 3–4 band; then personalization.

**Blockers:** none (docker up).

---

## 2026-06-27 (cont. 3) — decomposition built; the lever is Plan + gpt-5 prose

**Done (committed):**
- `0a3cfec` — **decomposition Plan → Prose** (ADR-0005): `StoryPlanSchema` (bible: hero/name, page layout, per-page beat+intent, lesson, questions) + `plan.prompt` (structure, gpt-4o) → `prose.prompt` (voice, gpt-5) rendering the plan in the Сутеев register. `StoryGeneratorService.generateStory` runs both, traced separately. Model split `PLAN_MODEL=gpt-4o` / `PROSE_MODEL=gpt-5`.
- `f3a75a3` — lint fix. **`./init.sh` exit 0** (backend + frontend tsc/lint/test all green).
- Journal Глава 2 / Эксп. 9 updated (`docs/process/ai-text-quality-evolution.md`).

**Key result (measured under registerMatch):** the lever is the **combination** — decomposition alone on gpt-4o stays flat (6–8); gpt-5 alone on the old single call was noise; **gpt-5 on the isolated Prose phase** finally delivers warm, show-don't-tell prose (rm 7–8, judge: "warm, avoids both flatness and ornamentation"). This *revises* cont.2's "stay on gpt-4o" — that held for the single call; for the decomposed Prose phase gpt-5 wins.

**Next:**
1. **Push branch + open PR** (per plan: build decomposition first, then one PR). Branch `issue/193-…` now carries RAG-phase1 + ADR-0005 + exemplars + judge + decomposition + process docs → PR `Closes #193`; also close #190.
2. Edit pass (optional) if registerMatch dips; raise threshold over time.
3. 3–4 band profile; personalization workstream; delete legacy mega-prompt.

**Blockers:** none.

---

## 2026-06-28/29 — Railway deploy: LIVE ✅

**StoryGrow is deployed and generating books in production.**

**Stack:** Railway — backend (NestJS) + frontend (Next.js) + Postgres (pgvector) + Redis. Cloudflare R2 for S3 (images/PDF). LangFuse off. Google OAuth login working. Full custom-flow verified end-to-end: login → create child → generate book (Plan→Prose gpt-5 → judge → Gemini images in R2 → PDF).

**Domains:**
- API: `https://storygrow-production.up.railway.app`
- Web: `https://storygrow-web-production.up.railway.app`

**Deploy bugs found and fixed (all in main):**
- `#203` — backend Docker build: prisma schema before install, tsconfig.base.json, system Chromium, pnpm deploy --legacy, packages/ workspace, dummy DATABASE_URL for prisma generate.
- `#205` — frontend Dockerfile: NEXT_PUBLIC_API_URL as build ARG; Railway deploy guide `docs/deploy-railway.md`.
- `#207` — prisma CLI in prod image for in-container migrate deploy.
- `#209` — prisma client emits `.js` imports (not `.ts`); dockerignore src/generated so builds regenerate consistently.
- `#211` — bind API to `0.0.0.0` (Node binds IPv6-only by default in container → Railway proxy 502).
- **Railway-specific gotcha:** Railway injects `PORT=8080`, not the app's default (3001/3000). Domain **Target Port must = 8080**. Pre-Deploy Command: `prisma migrate deploy && seed scripts`.

**Seeds:** LearningGoal (20), Template (5) — idempotent, safe to keep in Pre-Deploy. fast-illustrations skipped (requires real R2 + Gemini; re-run manually when needed).

**Next open workstreams:**
1. Text quality follow-ups: #196 (3–4 age band), #197 (personalization).
2. Drop dead VocabularyEntry/vector schema → plain Postgres (no pgvector required).
3. LangFuse Cloud (add keys, remove LANGFUSE_ENABLED=false).
4. Stripe real keys when payments needed.
5. Custom domain (optional).

**Blockers:** none.

---

## 2026-07-07 — quality/UX hardening pass; MVP at a shippable, complete state ✅

All work below shipped to `main` and auto-deployed to Railway (backend + frontend live, `/health` ok, `/books` 200).

**Structural fixes (schema/data-flow, not prompt whack-a-mole):**
- `#217` (#216) — **appearance → images only.** Appearance leaked into the Plan and drove plot/title (a hair-bow became a magic gimmick). Now derived separately into `characterProfile` (image-only); Plan/Prose see only name+gender. Removed redundant prose rule 4a.
- `#219` (#218) — **Plan templates constrained by age.** `buildStoryPlanSchema(childAge)` restricts the template enum to `templatesForAge()`, so an age-invalid template (`text-focus`@6) can't be emitted → no more `structural=false` fails.
- `#222` (#221) — **cover title length gated in `StorySchema`** (single-sourced from `PAGE_TEMPLATES.cover.maxChars.title`); over-length cover titles can't be emitted.
- `#224` (#223) — **companion anchor.** Named pets/toys (`belongings`) had no visual anchor → drifted (cat→plush, name→person). Isolated `deriveCompanions` step yields English descriptors; Prose names companions by descriptor verbatim in every illustrationPrompt.

**Features:**
- `#220` (#197) — **personalization seeds** (interests/motifs/favoriteWords/belongings) on `Book`, fed SOFT into the Plan (flavour the hero's world, never change premise/conflict/lesson). Form fields (custom mode), `eval:text` seed flags. CONTEXT.md updated.
- `#226` (#225) — **delete a book** (DELETE endpoint + S3 cleanup + detail-page button).
- `#228`/`#229` (#227) — delete from gallery card (overlay-link pattern; button top-left, reveal on hover).
- `#231` (#230) — **persistent `AppHeader`** on all app pages (was: `(app)` layout was only an auth guard → generation screen trapped the user); **generation screen redesigned** into the design system with friendly Russian statuses (fixed raw `generating` leak).

**Verdict (agreed with user):** the core product is a **complete, deployed MVP** that fulfils its promise — personalized, pedagogically-grounded children's books with quality control. Text quality reached the north star ("genuinely good, showable"): the Тёма/честность book reads as a real Сутеев-register story. Remaining items are **optional polish/hardening/growth, not missing core functionality.**

**Known-but-deferred quality items (optional, not blockers):**
- Title quality — Plan sometimes emits abstract titles that name the value («…с честностью») despite rule 9; needs a stronger structural nudge.
- **Story-entity drift** — recurring *plot* animals (the rescued kitten changed colour black→ginger) aren't anchored; `#223` only covers user-supplied `belongings`. Generalize the companion anchor to recurring story entities.
- Prose content quality — occasional weak beat (e.g. an absurd tall-tale that collides with the climax animal); a variance/selection concern, not systemic flatness.
- #196 (3–4 age band), PDF discussion-question double-numbering, "Волшебная история" generic label.

**Explicitly rejected this pass:** best-of-N selection (user preference).

**Blockers:** none.

---

## 2026-07-08/13 — remaining quality items closed; ultra-review; docs-currency audit

All shipped to `main`, auto-deployed to Railway.

**Quality items closed (both deferred items from the 2026-07-07 pass):**
- `#236` (#232) — **concrete titles.** Plan's title kept naming the abstract learning value («…с честностью») despite rule 9. New isolated `deriveTitle` step runs *after* Prose, titling from the finished concrete story; `isConcreteTitle` validator gates it (rejects value-naming/dull-template titles, ≤3 retries). Verified: «Алиса и рыжий кот на вершине горки» etc.
- `#237` (#233) — **story-entity anchor.** `#223` anchored user-supplied `belongings` but not animals invented by Prose itself (the rescued kitten drifted black→ginger). New prose rule 8: any recurring non-hero animal gets one fixed descriptor at first appearance, reused verbatim in every illustrationPrompt. Verified: same kitten descriptor across all 4 pages it appears on.
- `#239` (#238) — PDF polish: strip LLM-supplied «N.»/«N)» prefixes from discussion questions (were double-numbered against the template's own CSS counter); cover eyebrow «Волшебная история» → «Персональная история».

**Ultra-review of #231 (AppHeader + progress screen) found 2 real regressions, both fixed in `#235`:**
- `AppHeader` used undefined Tailwind v4 `@theme` tokens (`border-border`, `font-head`) that silently drop — fixed to `border-border-subtle` / `font-display`.
- Progress bar snapped to 0% on SSE reconnect mid-generation (backend replays a bare `{type:'generating'}` with no `progress` on reconnect) — now reads the last log entry with a numeric progress.

**Docs-currency audit (`#241`):** found and fixed real drift accumulated across `#197`/`#223`/`#232` and the Railway migration, none of which updated living docs:
- `CONTEXT.md` — `Story`/`Story Structure` described a pre-ADR-0005 schema shape; `Custom Flow` named classes never built and omitted the Title/Companions phases; added a `Companion Descriptor` glossary term (previously undocumented).
- `docs/ARCHITECTURE.md` — pipeline diagram missing Title/Companions; `Book` Prisma sketch missing the `#197` seed columns; **Deployment section still described Hetzner+Dokploy — the app is actually live on Railway** (the most significant gap).
- `CLAUDE.md` — required env vars missing `GOOGLE_GENERATIVE_AI_API_KEY` (required — Gemini is the default image provider) and `IMAGE_PROVIDER`.

**Verdict:** every known quality gap from the PDF book review is now closed. The MVP-complete verdict from 2026-07-07 stands and is now also true of the docs.

**Blockers:** none.

---

## 2026-07-13 — belongings seed: found broken in prod, fixed, then removed (net simplification)

User reported a personalized pet (`belongings`) didn't appear in a prod-generated book — asked whether that's expected.

**Diagnosis (`#243`):** reproduced with `eval:text --belongings` — the named pet was present in only ~1 of 3 generations. Root cause: the honesty/flaw exemplar's [Расплата] beat requires the hero to discover an **unfamiliar stray** creature — the "nobody believes it's real" tension only works if the animal is a stranger, not the hero's own pet. The seeds instruction was fully soft ("use where it fits"), so the model inconsistently guessed how to reconcile a given pet with that beat.

**Fix shipped (`#244`):** split `belongings` out of the soft seeds block into a firm standalone instruction (must appear on ≥2 pages; the stray-creature beat, if present, must use a different character). Verified 3/3 completed runs — companion present every page.

**Then reversed (`#246`), per user judgment call:** the fix was validated against only ONE exemplar; with ~20 learning goals × 2 arc types, other exemplars likely have similar hidden conflicts — meaning `#243` wasn't a one-time fix, it was the start of a per-exemplar whack-a-mole category. `belongings` was also the only seed requiring its own sub-pipeline (derivation call, schema, prose rule, firm-presence carve-out) versus `interests`/`motifs`/`favoriteWords`, which are simple soft text with zero issues since `#197`. Removed entirely: Prisma column + migration, `companions.prompt.ts`, `deriveCompanions`, prose rule for named descriptors, the form field, docs. `#237` (story-invented recurring character anchor — the rescued-kitten fix) is **independent and unchanged** — it's about animals the story itself invents, not user-supplied pets.

**Lesson:** a fix validated against one test case can still be the wrong call if the underlying mechanism (soft data conflicting with exemplar-specific plot beats) will keep recurring per-exemplar. Recognizing "this fix works but doesn't generalize cheaply" and cutting scope is sometimes better than shipping a narrow patch.

**Next task (queued, not started): `#196` — 3–4 age-band profile.**
- [ ] 3–4 template caps profile in `page-templates.config` (shorter pages than 5–6)
- [ ] Simpler, repetition/refrain-driven exemplars for 3–4, **virtue arcs only** (flaw's "Расплата" beat is too heavy for this age)
- [ ] Per-band exemplar/register selection wired through Plan/Prose + judge calibration
- [ ] Frontend: lift the current `childAge.min(5)` form restriction (added in `#214` specifically because 3–4/7–8 had no template/exemplar support) once 3–4 is real
- Branch before editing: `git switch -c issue/196-...` first (per house rule)

**Blockers:** none.
