# StoryGrow

Personalized children's books, generated per-child with age-adapted vocabulary and an LLM-as-judge quality gate. Monorepo: NestJS backend + Next.js frontend, PostgreSQL/pgvector, BullMQ/Redis, Stripe billing.

Live: [storygrow-web-production.up.railway.app](https://storygrow-web-production.up.railway.app)

## Quick start

```bash
pnpm install
docker compose up -d              # Postgres, Redis, MinIO, LangFuse — see docs/local-dev.md
pnpm --filter backend dev         # http://localhost:3001
pnpm --filter frontend dev        # http://localhost:3000
```

Run `./init.sh` before committing — it's the smoke check (tsc + lint + tests) that CI also runs.

## Where to go next

| Topic | Doc |
|---|---|
| Hard constraints, workflow, quick commands | [CLAUDE.md](CLAUDE.md) |
| Domain glossary (read before touching prompts/schemas) | [CONTEXT.md](CONTEXT.md) |
| System design, AI pipeline, deployment | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Local infra (Docker services, ports) | [docs/local-dev.md](docs/local-dev.md) |
| Last verified state, what's in progress | [progress.md](progress.md) |
| Original scope, roadmap, budget | [PROJECT_PLAN.md](PROJECT_PLAN.md) |

Git workflow: one GitHub Issue → one branch → one PR → squash-merge to `main`. Details in [docs/adr/0001-git-workflow.md](docs/adr/0001-git-workflow.md).
