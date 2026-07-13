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

**Why:** maintainability, AI-pipeline traceability, security, and a product polished enough to ship.

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
| AI SDK | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/google`, `zod`) — **not LangChain** |
| LLM | OpenAI `gpt-4o` (story text), `gpt-4o-mini` (judge + fast flow), `text-embedding-3-small` |
| Image gen | Google `gemini-2.5-flash-image` (default, reference-portrait consistency) · OpenAI `gpt-image-1` (fallback via `IMAGE_PROVIDER`) |
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

# Infrastructure (see docs/local-dev.md for ports and bootstrap)
docker compose up -d           # Postgres + Redis + MinIO + LangFuse
docker compose down            # Stop everything
docker compose down -v         # Stop AND wipe data volumes
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

These are not optional. The AI pipeline is the heart of the product — its quality, traceability, and the ability to iterate on it are what make StoryGrow worth shipping. Each rule is stated as **Rule → Why → If missing** so you can judge edge cases instead of mechanically applying the rule.

1. **All LLM calls use `generateObject` from Vercel AI SDK** with a typed Zod schema. No raw `chat.completions.create`.
   - **Why:** structured output is a core AI-engineering differentiator; the schema is also the contract between backend, PDF renderer, and frontend.
   - **If missing:** unstructured text breaks the PDF render contract; no parse-error detection; pedagogical sections (setup/conflict/lesson/resolution) cannot be enforced.

2. **Every generation creates a `StoryEval` row** with judge scores and `attempt` number, even if the first attempt passes.
   - **Why:** the eval dashboard is how we see whether quality holds; without rows there is no metric.
   - **If missing:** quality drift becomes invisible; "% books passing on first attempt" is unmeasurable; the regeneration story has no evidence.

3. **Every LLM call is traced in LangFuse** via `experimental_telemetry: { isEnabled: true, functionId, metadata }`.
   - **Why:** observability is part of running the product; we must be able to see token cost, latency, and judge score on one screen.
   - **If missing:** debugging AI failures becomes archaeology; no evidence of pipeline behavior.

4. **Prompts live in `backend/src/ai/prompts/`** as exported constants — not inline strings in services.
   - **Why:** prompts are the most-iterated artefact in an AI system; version-controlled constants enable diff review and A/B comparison.
   - **If missing:** "magic" strings scattered across services; no review trail; impossible to A/B a prompt change.

5. **Schemas live in `backend/src/ai/schemas/`** — single source of truth for both runtime validation and TypeScript types.
   - **Why:** Zod schemas double as runtime guards and TS types via `z.infer`; one definition prevents drift between validator and type.
   - **If missing:** type definitions diverge from runtime validators; bugs sneak in at the JSON boundary; LLM output may parse but violate downstream expectations.

6. **No silent regeneration** — if a story fails judge threshold, the previous `StoryEval` row stays, a new one is created, and the user sees attempt progress.
   - **Why:** the retry loop is the demo-able value-add of the product; silent retry hides the loop from the user and the metrics.
   - **If missing:** we cannot show "this book regenerated twice before passing"; the regeneration loop becomes invisible to the user and to the dashboard.

---

## Required Environment Variables

See `.env.example` (created when scaffolding). Minimum set:

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...     # Gemini — DEFAULT image provider (IMAGE_PROVIDER=gemini)
IMAGE_PROVIDER=gemini                # 'gemini' (default) | 'openai' fallback
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
LANGFUSE_HOST=http://localhost:3030
S3_ENDPOINT=http://localhost:9100
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=storygrow
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
JWT_SECRET=...
JWT_REFRESH_SECRET=...
FRONTEND_URL=http://localhost:3000
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
