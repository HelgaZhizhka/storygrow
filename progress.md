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
