# AGENTS.md

Session continuity guidance for AI coding agents working on StoryGrow.

---

## Session Start Workflow

Before writing any code, always do this:

1. Run `pwd` — confirm you're in `/Users/mac/Projects/storygrow`.
2. Read [progress.md](progress.md) — last verified state + next step.
3. If [session-handoff.md](session-handoff.md) is **non-empty** — read it first. Previous session was interrupted mid-feature.
4. Check **GitHub Issues** — pick the highest-priority open issue in the current week's milestone (`gh issue list --milestone "Week N"`).
5. Run `git log --oneline -5` — see recent commits.
6. Run `./init.sh` — smoke-check (TypeScript + lint + unit tests).

**If smoke check fails — fix it first.** Do not start new feature work on a broken base.

---

## Working Rules

- **One issue → one branch → one PR → squash-merge to `main`.** Branch `issue/<N>-<short-kebab>`, PR title in Conventional Commits, body `Closes #N`. Full rules: [docs/adr/0001-git-workflow.md](docs/adr/0001-git-workflow.md).
- **One issue at a time.** Finish before picking the next.
- **Don't "also refactor" issue B while implementing issue A.** Unrelated bugs → new issue.
- **Narrow exception:** a 1-2 line fix that unblocks your work is allowed — mention it in the commit message.
- **Don't mark an issue closed just because code was added.** Close only when Definition of Done (see [CLAUDE.md](CLAUDE.md)) is met.
- **Don't silently change verification rules** during implementation.
- **Prefer durable repository artifacts over chat summaries.** When a decision is made, write it: `progress.md` for session-level, `docs/adr/` for architectural, `docs/superpowers/specs/` for feature-level.
- **AI-pipeline code requires extra scrutiny.** It's the substance of the defense — don't auto-generate it uncritically. Pair with TDD (`superpowers:test-driven-development`) and verify traces in LangFuse before closing the issue.

---

## Skill Workflow Map

| Phase | Skill to invoke | Output / artefact |
|---|---|---|
| Before a major feature | `superpowers:brainstorming` or `grill-me` | Conversation; possibly an issue in GitHub |
| Decision touches domain language / architecture | `grill-with-docs` | Updated [CONTEXT.md](CONTEXT.md) and/or new ADR in `docs/adr/` |
| Turn discussion into a written spec | `superpowers:writing-plans` | `docs/superpowers/specs/YYYY-MM-DD-feature-name-design.md` |
| Break a spec into actionable issues | `to-issues` | GitHub issues with labels + milestone |
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
2. **Update GitHub Issue status** — close completed issues with a comment referencing the commit/PR.
3. **Run `./init.sh`** — must exit 0.
4. **Commit any clean-state changes** with a descriptive message.
5. **If interrupted mid-feature** — fill `session-handoff.md` before stopping. Clear it when the feature is done.

---

## Context Management

- If a feature touches more than 10 files → break it into sub-issues.
- If context feels heavy → start a fresh session and pass state via `session-handoff.md` + the relevant GitHub Issue.
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
| **GitHub Issues** | **Task source of truth.** Milestones = weeks. Labels = areas + priority. |

---

## Deliberate non-files

We deliberately do **not** maintain `feature_list.json`. GitHub Issues is the task source of truth; `progress.md` is the session log. If you ever feel like adding `feature_list.json`, re-read this section — that path was considered and rejected to avoid dual sources of truth.
