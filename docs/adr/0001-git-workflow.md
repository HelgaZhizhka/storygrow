---
status: Accepted
date: 2026-05-22
amended: 2026-09-23
---

# ADR 0001 — Git workflow

> **Amendment, 2026-09-23 (STO-5).** The task tracker moved from GitHub Issues to Linear (workspace `storygrow`, team `StoryGrow`, prefix `STO-`). The workflow shape is unchanged — one ticket, one branch, one PR, squash-merge — only the tracker and the two strings that name it: branches are now `issue/sto-<N>-<short-kebab-title>` and PR bodies say `Fixes STO-<N>` instead of `Closes #N`. Points 1 and 2 below are written in their amended form; the original GitHub-issue wording is in the git history of this file.

## Context

StoryGrow is a solo project built largely by AI agents over 5 weeks. It will be defended as a portfolio piece on the RS School AI-SaaS course and stays a public repo (`HelgaZhizhka/storygrow`). We need a git workflow that (a) produces a readable history for defense and review, (b) gives clear rollback points per feature, (c) is cheap enough not to slow down a single developer + agents, (d) leaves room for CI on PRs later.

Linear is the task source of truth (labels = areas + triage, priority is a native field). The workflow has to map cleanly onto that. Until 2026-09-23 this role was GitHub Issues, with milestones standing in for weeks; the 5-week roadmap was outgrown long before the tracker moved.

## Decision

**1. Feature branches, one branch per Linear ticket.**

- Branch name: `issue/sto-<N>-<short-kebab-title>` (e.g. `issue/sto-5-linear-tracker`). The `sto-<N>` segment is what the Linear GitHub integration matches on.
- Branched from the latest `main`.
- Lives until the corresponding PR is merged, then deleted.

**2. Every change reaches `main` through a Pull Request.**

- PR title mirrors a Conventional Commits subject (see point 4).
- PR body uses `Fixes STO-<N>`. The Linear ↔ GitHub integration moves the ticket to `In Review` when the PR opens and to `Done` when it merges. With the integration disconnected the ticket must be moved by hand — the session-end checklist in [AGENTS.md](../../AGENTS.md) covers that case.
- Self-merge after `./init.sh` is green and Definition of Done in [CLAUDE.md](../../CLAUDE.md) is met. Optional second opinion via `feature-dev:code-reviewer` or `superpowers:requesting-code-review` for substantial AI-pipeline work.
- Merge mode: **squash**. One PR → one clean commit on `main`. Branch is deleted on merge.

**3. `main` is protected.**

- No force push.
- No direct push — all changes via PR.
- No required reviewers (solo project), but PR is mandatory.

**4. Conventional Commits for PR titles and squash-merge commit messages.**

Allowed types:

| Type       | Use for                                        |
| ---------- | ---------------------------------------------- |
| `feat`     | A new user-facing feature                      |
| `fix`      | A bug fix                                      |
| `chore`    | Tooling, dependencies, repo housekeeping       |
| `docs`     | Documentation-only change                      |
| `refactor` | Internal change, no behavior change            |
| `test`     | Tests only                                     |
| `perf`     | Performance change                             |
| `ci`       | CI / build pipeline                            |

Format: `type(area): short imperative subject` (e.g. `feat(ai): add LLM-as-judge regeneration loop`). Area matches an `area:*` label when one fits, free-form otherwise. Inside the branch, intermediate commits are not required to follow the format — they are squashed away.

## Consequences

**Positive.**
- 30+ visible PRs in the repo timeline serve as a portfolio artefact and a defense narrative.
- Each PR is an independent revert point (`git revert <squash-sha>`).
- CI can later attach to PRs without changing the workflow.
- Conventional Commits enables auto-generated changelogs if we ever want them.
- Forced PR flow prevents accidental commits to `main`.

**Cost.**
- ~30 seconds of overhead per ticket (branch + PR + merge).
- Ticket status now depends on the Linear ↔ GitHub integration staying connected. When it isn't, PRs still work but tickets go stale silently — the only guard is the session-end checklist.
- Tracker and code live in different systems, so a `#N` in an old doc means GitHub and a `STO-N` means Linear. Both stay resolvable; the ambiguity is the price of not rewriting history.
- The intermediate commit history on feature branches is lost after squash — not a problem for this project, but documented here so we don't expect to mine it later.

**Out of scope (deliberately deferred).**
- Required CI checks on PRs — will be added when we have CI to require.
- Required reviewers — not meaningful for a solo project.
- Auto-merge / merge queue — not warranted at this scale.
