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
