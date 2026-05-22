# CLAUDE.md

**Start here:** read this file fully (5 min), then `AGENTS.md` for session workflow.

---

## ⛔ Hard Constraints (NEVER violate)

1. ❌ Use `any` (use `unknown` + Zod parse or explicit type guard)
2. ❌ Use `npm` or `yarn` (only `pnpm`)
3. ❌ Use `@ts-ignore`, `console.log` in commits (use `logger` service)
4. ❌ Class components in Next.js (only arrow function components)
5. ❌ Inline styles (only Tailwind classes)
6. ❌ Index as key in dynamic lists (use stable id)
7. ❌ Direct push to `main` or force push to `main` (all changes via PR; see [docs/adr/0001-git-workflow.md](docs/adr/0001-git-workflow.md))
8. ❌ Add dependencies without discussing first (especially AI-related)
9. ❌ Raw LLM calls without a Zod schema — all generation goes through `generateObject` (Vercel AI SDK)
10. ❌ AI output without a `StoryEval` row or LangFuse trace (no silent generation)
11. ❌ Magic numbers / magic prompt fragments — extract to constants in `backend/src/ai/prompts/`
12. ❌ Files larger than 400 lines (split before commit)
13. ❌ Functions longer than 30 lines or with more than 3 parameters (use an object-parameter)
14. ❌ Nesting deeper than 3 levels (early return / extract helper)
15. ❌ Secrets in code (only via `ConfigService` from env)
16. ❌ Mutating function parameters or state directly (immutable updates)
17. ❌ Skip verification (`./init.sh`) before claiming a feature is done
18. ❌ Squash-merge PR with a title that isn't Conventional Commits (`feat|fix|chore|docs|refactor|test|perf|ci(area)?: ...`)

**Why:** maintainability, defensibility on course defense, AI-pipeline traceability, security.

---

## Project Overview

**StoryGrow** — pedagogically-grounded генератор персонализированных детских книг с возрастной адаптацией лексики (RAG) и автоматическим контролем качества (LLM-as-judge).

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for full concept, scope, roadmap, and budget.

**Architecture:** monorepo (`backend/` NestJS, `frontend/` Next.js) — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**Domain language:** see [CONTEXT.md](CONTEXT.md) — read before writing prompts, schemas, or types.

**Code style:** see [docs/CODE_STYLE.md](docs/CODE_STYLE.md) — adapted RS School clean-code checklist.

---

## Tech Stack (canonical)

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router) |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL + `pgvector` |
| Queue | BullMQ + Redis |
| Storage | S3 / MinIO |
| AI SDK | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `zod`) — **not LangChain** |
| LLM | OpenAI `gpt-4o-mini` (text + judge), `text-embedding-3-small`, `dall-e-3` |
| Observability | LangFuse (self-hosted) |
| PDF | Puppeteer |
| Payments | Stripe |
| Notifications | SSE |
| Deploy | Dokploy on Hetzner VPS |
| Package manager | `pnpm` (workspaces) |

---

## Quick Commands

```bash
# Repo root
./init.sh                      # Smoke-check (tsc + lint + tests)
pnpm install                   # Install all workspace deps

# Backend (NestJS)
pnpm --filter backend dev      # Dev server
pnpm --filter backend build    # Production build
pnpm --filter backend test     # Unit tests
pnpm --filter backend lint:fix

# Frontend (Next.js)
pnpm --filter frontend dev     # Dev server (port 3000)
pnpm --filter frontend build
pnpm --filter frontend test
pnpm --filter frontend lint:fix

# Database
pnpm --filter backend prisma:migrate    # Apply migrations
pnpm --filter backend prisma:studio     # Prisma Studio UI

# Infrastructure
docker compose up -d           # Postgres + Redis + MinIO + LangFuse
docker compose down            # Stop everything
```

---

## Git Workflow (canonical)

Full rationale: [docs/adr/0001-git-workflow.md](docs/adr/0001-git-workflow.md). Day-to-day rules:

- **One GitHub Issue → one branch → one PR → squash-merge into `main`.**
- Branch name: `issue/<N>-<short-kebab-title>`.
- PR body: `Closes #<N>` so the issue auto-closes on merge.
- PR title and squash-commit subject follow **Conventional Commits**: `type(area): short imperative subject`.
  Types: `feat | fix | chore | docs | refactor | test | perf | ci`.
- `main` is protected — no direct push, no force push.
- Self-merge OK after `./init.sh` is green and Definition of Done is met.

```bash
# Typical loop
gh issue list --milestone "Week 1" --state open
git switch -c issue/1-pnpm-workspace
# ...work, commit incrementally...
git push -u origin issue/1-pnpm-workspace
gh pr create --title "chore(repo): scaffold pnpm workspace" --body "Closes #1"
# after ./init.sh is green
gh pr merge --squash --delete-branch
```

---

## Where to Find Everything

### Session start
1. **[progress.md](progress.md)** — last verified state, what was done, what's next
2. **[session-handoff.md](session-handoff.md)** — if non-empty, previous session was interrupted; read first
3. **GitHub Issues** — task source of truth (filter by milestone for current week)
4. Run `./init.sh` — verify clean base

### Code rules & patterns
| Topic | Document |
|---|---|
| Domain glossary | [CONTEXT.md](CONTEXT.md) |
| Code style rules | [docs/CODE_STYLE.md](docs/CODE_STYLE.md) |
| Architecture & AI pipeline | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Architectural decisions | [docs/adr/](docs/adr/) |
| Feature specs (from `superpowers:writing-plans`) | [docs/superpowers/specs/](docs/superpowers/specs/) |
| Implementation plans | [docs/superpowers/plans/](docs/superpowers/plans/) |

---

## AI-Pipeline Discipline (StoryGrow-specific)

These are not optional. The AI pipeline is the substance of the project defense.

1. **All LLM calls use `generateObject` from Vercel AI SDK** with a typed Zod schema. No raw `chat.completions.create`.
2. **Every generation creates a `StoryEval` row** with judge scores and `attempt` number, even if the first attempt passes.
3. **Every LLM call is traced in LangFuse** via `experimental_telemetry: { isEnabled: true, functionId, metadata }`.
4. **Prompts live in `backend/src/ai/prompts/`** as exported constants — not inline strings in services.
5. **Schemas live in `backend/src/ai/schemas/`** — single source of truth for both runtime validation and TypeScript types.
6. **No silent regeneration** — if a story fails judge threshold, the previous `StoryEval` row stays, a new one is created, and the user sees attempt progress.

---

## Required Environment Variables

See `.env.example` (created when scaffolding). Minimum set:

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
OPENAI_API_KEY=sk-...
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
LANGFUSE_HOST=http://localhost:3001
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=storygrow
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
JWT_SECRET=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
EVAL_THRESHOLD=7.0
EVAL_MAX_RETRIES=2
```

---

## Definition of Done

A feature is `done` only when **all** are true:

- ✅ Target behavior implemented
- ✅ `./init.sh` exits 0 (tsc + lint + tests pass)
- ✅ For AI-pipeline features: traces visible in LangFuse, `StoryEval` rows written
- ✅ GitHub Issue closed with reference to commit/PR
- ✅ `progress.md` updated with verified state
- ✅ Repo clean (`git status` empty) or WIP commit with explicit note

---

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`HelgaZhizhka/storygrow`). Agents use the `gh` CLI for all operations. See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

### Triage labels

Default label vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See [docs/agents/domain.md](docs/agents/domain.md).

---

**Questions?** Re-read this file. Still unclear? Add an entry to `progress.md` and ask the user.
