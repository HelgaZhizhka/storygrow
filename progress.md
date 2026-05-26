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
