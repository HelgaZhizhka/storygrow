# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

This repo's GitHub instance supports native **sub-issues** and native
**issue dependencies** (verified: `gh api repos/HelgaZhizhka/storygrow/issues/<n>/sub_issues`
and `.../dependencies/blocked_by` both resolve). Wayfinder uses these
directly — no body-convention fallback needed.

- **Map**: a GitHub issue labelled `wayfinder:map`.
- **Ticket**: a GitHub issue labelled `wayfinder:<type>` (`research` |
  `prototype` | `grilling` | `task`), added as a **sub-issue** of the map:
  `gh api repos/{owner}/{repo}/issues/{map_number}/sub_issues -f sub_issue_id={ticket_node_or_number}`
  (use `gh issue view <n> --json id` for the numeric `sub_issue_id` the
  REST endpoint expects — it wants the issue's database id, not its
  display number; fetch via `gh api repos/{owner}/{repo}/issues/<display-number>Sql --jq .id`
  in practice: `gh api repos/{owner}/{repo}/issues/<n> --jq .id`).
- **List a map's children**: `gh api repos/{owner}/{repo}/issues/{map_number}/sub_issues`.
- **Blocking**: `gh api repos/{owner}/{repo}/issues/{ticket_number}/dependencies/blocked_by -f issue_id={blocker_id}`
  (again, the numeric id from `gh api .../issues/<n> --jq .id`, not the
  display number). Query what blocks a ticket:
  `gh api repos/{owner}/{repo}/issues/{ticket_number}/dependencies/blocked_by`.
- **Claim a ticket**: `gh issue edit <number> --add-assignee @me`. An open,
  unassigned ticket is unclaimed.
- **Frontier query**: open children of the map, unassigned, with an empty
  `blocked_by` list.
- **Resolve a ticket**: `gh issue comment <number> --body "..."` (the
  resolution), then `gh issue close <number>`.
