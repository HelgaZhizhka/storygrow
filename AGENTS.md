# AGENTS.md

Session continuity guidance for AI coding agents working on StoryGrow.

---

## Session Start Workflow

> **Automation (2026-07-16):** a `SessionStart` hook (`scripts/hooks/session-start.sh`) auto-injects branch/status, recent commits, the latest `progress.md` entry titles, and the `session-handoff.md` state at every session start. Steps 2, 3 and 5 below are therefore pre-answered in your context — verify against the injected block instead of re-running them; the remaining steps are still yours.

Before writing any code, always do this:

1. Run `pwd` — confirm you're in `/Users/mac/Projects/storygrow`.
2. Read the **last 1–2 entries** of [progress.md](progress.md) (newest at the bottom) — last verified state + next step. Do NOT read the whole file or the archives in `docs/process/progress-archive-*.md`; they are history, not state.
3. If [session-handoff.md](session-handoff.md) is **non-empty** — read it first. Previous session was interrupted mid-feature.
4. Check **Linear** ([storygrow](https://linear.app/storygrow), team `StoryGrow`) via the `linear-storygrow` MCP server — `list_issues` with `state: "Todo"`. Pick the highest-priority ticket: prefer the `ready-for-agent` label, then explicit blockers/dependencies, then the native priority field. `Backlog` holds what is deliberately not scheduled (`post-defense`, roadmap items) — don't pull from there without asking.
5. Run `git log --oneline -5` — see recent commits.
6. Run `./init.sh` — smoke-check (TypeScript + lint + unit tests).

**If smoke check fails — fix it first.** Do not start new feature work on a broken base.

---

## Working Rules

- **One Linear ticket → one branch → one PR → squash-merge to `main`.** Branch `issue/sto-<N>-<short-kebab>`, PR title in Conventional Commits, body `Fixes STO-<N>`. Full rules: [docs/adr/0001-git-workflow.md](docs/adr/0001-git-workflow.md).
- **Bundle the `progress.md` session entry into the feature PR**, not a standalone PR. The session log lives with the work it describes. Exception: if a session ends without touching any feature branch (rare — pure planning/meta), then a standalone `docs(progress): …` PR is fine.
- **One ticket at a time.** Finish before picking the next.
- **Don't "also refactor" ticket B while implementing ticket A.** Unrelated bugs → a new Linear ticket.
- **Narrow exception:** a 1-2 line fix that unblocks your work is allowed — mention it in the commit message.
- **Don't move a ticket to `Done` just because code was added.** `Done` only when Definition of Done (see [CLAUDE.md](CLAUDE.md)) is met.
- **Don't silently change verification rules** during implementation.
- **Prefer durable repository artifacts over chat summaries.** When a decision is made, write it: `progress.md` for session-level, `docs/adr/` for architectural, `docs/superpowers/specs/` for feature-level.
- **AI-pipeline code requires extra scrutiny.** It's the heart of the product — don't auto-generate it uncritically. Pair with TDD (`superpowers:test-driven-development`) and verify traces in LangFuse before closing the issue.
- **AI-pipeline changes require at least one live `eval:text` run before the PR.** Unit tests on prompts are spec-mirroring — they catch regressions, not quality. The real check is a live generation read against the change's goal (this has been the de-facto practice since ADR-0005; codified 2026-07-16). Note: `eval:text`/`eval:batch` prove **prose quality** only — they run text-only, no DB writes (`bookId: "dry-run"`), and produce no `StoryEval` row. They are not a substitute for the product-integration evidence in "Done is not a mood" below.
- **Frontend issues: check for a visual contract first.** If a `docs/design/<issue>-*.png` mockup exists, read it via the multimodal `Read` tool to ground the implementation. If none exists and the issue is visually significant, ask the user before scaffolding default-Tailwind UI.

---

## Agent Behavior Contract

These rules govern *how* you work, regardless of which issue you're on. They override default LLM tendencies (vibe-completion, sycophancy, premature stopping).

### Done is not a mood
Don't claim completion without evidence. For code: `./init.sh` exits 0. For AI-pipeline features, two distinct claims need two distinct kinds of proof — don't conflate them:
- **Prose/prompt quality** — a live `eval:text`/`eval:batch` run + its LangFuse trace. This does not touch the database.
- **Product integration** (the feature actually works end-to-end) — a real generation through the real API (`POST /books` or the app UI), producing a genuine `StoryEval` row and its own LangFuse trace.

If you can't produce the proof, name what is missing — do not pretend completion.

### Right to disagree
When quality, truth, or safety is at risk, you are expected to push back. Format:
1. State the concrete risk in one line.
2. Propose the smallest safer alternative.
3. Continue any non-blocked work.

Polite compliance creates quiet failure. The user explicitly wants honest technical feedback (see global instructions), not validation.

### Don't stop at the first weak signal
A `grep` that returns nothing is "no result", not "doesn't exist". Before concluding something is absent:
- Try one alternative path (different filename, different identifier, different directory).
- Check whether the question itself assumed the wrong concept (see [CONTEXT.md](CONTEXT.md) semantic hygiene).
- If still empty, say "no evidence found after checking X, Y, Z", not "doesn't exist".

### Complaint-Driven Development (CDD)
If something in the harness slows you down — broken `init.sh`, ambiguous rule in `CLAUDE.md`, missing skill, friction in the workflow — **raise it, don't silently work around it**. Add to the current session entry in `progress.md`:

```
**Friction:**
- Problem: <one line — what went wrong>
- Impact: <one line — what it cost in time or correctness>
- Smallest fix: <1-3 bullets — what would prevent recurrence>
```

If the friction is blocking, surface it to the user before proceeding. If non-blocking, log it and keep moving. The harness improves only by feeding back actual usage friction.

---

## Skill Workflow Map

| Phase | Skill to invoke | Output / artefact |
|---|---|---|
| Before a major feature | `superpowers:brainstorming` or `grill-me` | Conversation; possibly a Linear ticket |
| Decision touches domain language / architecture | `grill-with-docs` | Updated [CONTEXT.md](CONTEXT.md) and/or new ADR in `docs/adr/` |
| Turn discussion into a written spec | `superpowers:writing-plans` | `docs/superpowers/specs/YYYY-MM-DD-feature-name-design.md` |
| Break a spec into actionable issues | `to-issues` | Linear tickets with labels + priority |
| Implementation | `superpowers:executing-plans` + `superpowers:test-driven-development` | Code + tests |
| Bug investigation | `diagnose` or `superpowers:systematic-debugging` | Diagnosis trace, possibly an ADR if architectural |
| Before commit | `superpowers:verification-before-completion` | `./init.sh` exits 0 |
| Before merging a PR | `code-review:code-review` | Review comments |
| Session interrupted mid-feature | `handoff` | Filled [session-handoff.md](session-handoff.md) |
| End of clean session | Manual update | New entry at the bottom of [progress.md](progress.md) |

---

## Session End Checklist

Before finishing any session:

1. **Update `progress.md`** — append one entry: `## YYYY-MM-DD — topic`, then `Done / Decisions / Next / Blockers`.
2. **Update the Linear ticket** — the GitHub integration moves it to `Done` on merge; if it hasn't (integration off, or the PR isn't merged yet), set the status with `save_issue` and leave a comment referencing the commit/PR.
3. **Run `./init.sh`** — must exit 0.
4. **Commit any clean-state changes** with a descriptive message.
5. **If interrupted mid-feature** — fill `session-handoff.md` before stopping. Clear it when the feature is done.

---

## Context Management

- If a feature touches more than 10 files → break it into sub-tickets.
- If context feels heavy → start a fresh session and pass state via `session-handoff.md` + the relevant Linear ticket.
- Prefer `session-handoff.md` over chat summaries for mid-feature continuity.

---

## Key Continuity Files

| File | Purpose |
|------|---------|
| `progress.md` | Multi-session log: what was done, decisions, next step, blockers. Newest entry at the bottom. |
| `session-handoff.md` | Filled only when interrupted mid-feature; cleared when feature is done. |
| `init.sh` | Standard smoke verification. |
| `CLAUDE.md` | Hard constraints, tech stack, quick commands, AI-pipeline discipline. |
| `CONTEXT.md` | Domain glossary — use these exact terms in code/docs/prompts. |
| `docs/CODE_STYLE.md` | Code style checklist (adapted from RS School clean-code). |
| `docs/ARCHITECTURE.md` | Monorepo layout, AI pipeline diagram, data flow. |
| `docs/adr/` | Architectural Decision Records — one file per major decision. |
| `docs/superpowers/specs/` | Feature design specs (from `superpowers:writing-plans`). |
| `docs/superpowers/plans/` | Implementation plans (from `superpowers:writing-plans`). |
| `PROJECT_PLAN.md` | High-level product vision, scope, 5-week roadmap, budget. |
| **[Linear](https://linear.app/storygrow)** | **Task source of truth.** Team `StoryGrow`, prefix `STO-`. Labels = areas + triage; priority is a native field. Driven via the `linear-storygrow` MCP server — see [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md). |

---

## Deliberate non-files

We deliberately do **not** maintain `feature_list.json`. Linear is the task source of truth; `progress.md` is the session log. If you ever feel like adding `feature_list.json`, re-read this section — that path was considered and rejected to avoid dual sources of truth.

For the same reason we do **not** keep open GitHub issues alongside the Linear tickets. When the tracker moved on 2026-09-23 the 8 open issues were migrated and their GitHub originals closed with a pointer; don't reopen them or file new ones.
