# Issue tracker: Linear

Issues and PRDs for this repo live in the **Linear** workspace [storygrow](https://linear.app/storygrow), team `StoryGrow`, ticket prefix `STO-`. Agents operate it through the Linear MCP server, not the `gh` CLI.

GitHub keeps code, PRs and CI. It is **not** the task tracker — the migration happened on 2026-09-23 (STO-5). The 164 closed GitHub issues stay in GitHub as history, so a `#N` reference in `progress.md`, an ADR or an older doc means a GitHub issue or PR and still resolves; a `STO-N` reference means a Linear ticket.

## Connecting

The MCP server is registered **per project** (local scope, `~/.claude.json` under `/Users/mac/Projects/storygrow`), so it exists only in this repo's sessions:

```bash
claude mcp add --scope local --transport http linear-storygrow https://mcp.linear.app/mcp
```

Tools are then named `mcp__linear-storygrow__*`. Authentication is a one-time OAuth flow: `/mcp` → `linear-storygrow` → `Authenticate`, selecting the **StoryGrow** workspace. If tool calls fail with an auth error, re-run that flow — do not fall back to `gh issue`.

## Conventions

- **Create a ticket**: `save_issue` with `team: "StoryGrow"`, a Conventional-Commits-shaped `title` (`feat(ai): ...`), a markdown `description`, and labels. Omit `id` when creating.
- **Read a ticket**: `get_issue` with the identifier (`STO-8`). Comments come from `list_comments`.
- **List tickets**: `list_issues` with `team: "StoryGrow"` plus `state`, `label`, `assignee` or `priority` filters. Use `fields` to keep the response small — e.g. `["id", "title", "status", "labels", "priority"]`.
- **Comment**: `save_comment` with the issue identifier and `body`.
- **Labels**: `save_issue` `addLabels` / `removeLabels` for incremental changes; `labels` replaces the whole set. `list_issue_labels` shows the vocabulary.
- **Move a ticket**: `save_issue` with `id` and `state` — `Backlog`, `Todo`, `In Progress`, `In Review`, `Done`, `Canceled`, `Duplicate`.
- **Close**: set `state: "Done"`. Abandoned work goes to `Canceled`, not `Done`.

Send markdown with real newlines, never escaped `\n`.

## Statuses

| Status | Meaning |
| ------------- | -------------------------------------------------------------- |
| `Backlog` | Not scheduled. Roadmap items, `post-defense` work. |
| `Todo` | Ready to pick up. |
| `In Progress` | A branch exists. Set when you start, not when you finish. |
| `In Review` | PR open. The GitHub integration sets this automatically. |
| `Done` | Definition of Done in [CLAUDE.md](../../CLAUDE.md) is met. |
| `Canceled` | Will not be actioned — the old `wontfix` label. |

## Priority

Linear has a native priority field, so there are no `priority:*` labels. The old GitHub labels map to it: `priority:high` → `High` (2), `priority:medium` → `Medium` (3), `priority:low` → `Low` (4), no label → `No priority` (0). `Urgent` (1) is reserved for production breakage.

## Linking a PR to a ticket

Branch `issue/sto-<N>-<short-kebab>` and `Fixes STO-<N>` in the PR body. The Linear ↔ GitHub integration then moves the ticket to `In Review` when the PR opens and to `Done` when it merges. Full rules: [docs/adr/0001-git-workflow.md](../adr/0001-git-workflow.md).

If the integration is ever disconnected, the ticket will not move on its own — set the status with `save_issue` as part of the session-end checklist.

## When a skill says "publish to the issue tracker"

Create a Linear ticket with `save_issue`.

## When a skill says "fetch the relevant ticket"

`get_issue` for the body, then `list_comments` for the discussion.
