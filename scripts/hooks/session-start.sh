#!/usr/bin/env bash
# SessionStart hook — injects a compact session orientation into the agent's
# context automatically (harness audit 2026-07-16, rec #3: lifecycle was fully
# manual). Replaces the "read progress.md / check handoff / git log" steps of
# the AGENTS.md startup workflow with a mechanical, always-on version.
# Output is deliberately bounded (~15 lines) — orientation, not a data dump.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

echo "=== StoryGrow session orientation (auto-injected by SessionStart hook) ==="
echo "Branch: $(git branch --show-current 2>/dev/null || echo '?') | uncommitted files: $(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
echo
echo "Recent commits:"
git log --oneline -5 2>/dev/null || echo "  (git unavailable)"
echo
echo "Recent progress.md entries (read the file tail for details):"
grep '^## ' progress.md 2>/dev/null | tail -3 | sed 's/^/  /'
echo
# The empty template keeps a filled-in EXAMPLE inside an HTML comment — strip
# comments before checking, or the template itself reads as "interrupted".
if sed '/<!--/,/-->/d' session-handoff.md 2>/dev/null | grep -qE '^## Feature:'; then
  echo "!! session-handoff.md is NON-EMPTY — previous session was interrupted mid-feature. Read it FIRST."
else
  echo "session-handoff.md: empty (no interrupted work)."
fi
echo
echo "Workflow: AGENTS.md | Hard constraints: CLAUDE.md | Run ./init.sh before feature work."
