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
