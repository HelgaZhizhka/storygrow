# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker — the Linear workspace [storygrow](https://linear.app/storygrow), team `StoryGrow` (see [issue-tracker.md](issue-tracker.md)).

| Label in mattpocock/skills | Label in our tracker           | Meaning                                  |
| -------------------------- | ------------------------------ | ---------------------------------------- |
| `needs-triage`             | `needs-triage`                 | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`                   | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`              | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`              | Requires human implementation            |
| `wontfix`                  | the `Canceled` status, no label | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

`wontfix` is the one role without a label: Linear models "will not be actioned" as a status, so move the ticket to `Canceled` instead of labelling it. Everything else is a real Linear label, created in the `StoryGrow` team on 2026-09-23 with the same names the GitHub tracker used, so existing doc references still read correctly.

Area labels (`area:ai`, `area:frontend`, `area:backend`, `area:eval`, `area:rag`, `area:books`, `area:pdf`, `area:auth`, `area:payments`, `area:infra`, `area:deploy`, `area:seo`, `area:admin`) and the deferral labels (`post-defense`, `review-2026-09`) carried over unchanged. Priority did not: it is a native Linear field now, not a label — see [issue-tracker.md](issue-tracker.md#priority).

Edit the right-hand column to match whatever vocabulary you actually use.
