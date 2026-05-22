---
status: Accepted
date: 2026-05-22
---

# ADR 0001 — Git workflow

## Context

StoryGrow is a solo project built largely by AI agents over 5 weeks. It will be defended as a portfolio piece on the RS School AI-SaaS course and stays a public repo (`HelgaZhizhka/storygrow`). We need a git workflow that (a) produces a readable history for defense and review, (b) gives clear rollback points per feature, (c) is cheap enough not to slow down a single developer + agents, (d) leaves room for CI on PRs later.

GitHub Issues is the task source of truth (Milestones = weeks, labels = areas + priority). The workflow has to map cleanly onto that.

## Decision

**1. Feature branches, one branch per GitHub Issue.**

- Branch name: `issue/<N>-<short-kebab-title>` (e.g. `issue/1-pnpm-workspace`).
- Branched from the latest `main`.
- Lives until the corresponding PR is merged, then deleted.

**2. Every change reaches `main` through a Pull Request.**

- PR title mirrors a Conventional Commits subject (see point 4).
- PR body uses `Closes #N` to auto-close the issue on merge.
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
- ~30 seconds of overhead per issue (branch + PR + merge).
- The intermediate commit history on feature branches is lost after squash — not a problem for this project, but documented here so we don't expect to mine it later.

**Out of scope (deliberately deferred).**
- Required CI checks on PRs — will be added when we have CI to require.
- Required reviewers — not meaningful for a solo project.
- Auto-merge / merge queue — not warranted at this scale.
