#!/usr/bin/env python3
"""PreToolUse gate on `gh pr merge` (harness audit 2026-07-16, rec #3).

Mechanically enforces the AGENTS.md rule "bundle the progress.md session entry
into the feature PR": blocks merging an `issue/*`-branch PR whose diff does not
touch progress.md. Docs/chore branches are exempt (the rule's own exception).

Blocking works via exit code 2 — stderr is fed back to the agent, which can add
the entry, push, and retry. Any uncertainty (can't parse, gh fails, no PR found)
fails OPEN (exit 0): this is a reminder-with-teeth, not a wall.
"""

import json
import re
import subprocess
import sys


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    if payload.get("tool_name") != "Bash":
        return 0
    command = payload.get("tool_input", {}).get("command", "")
    if not re.search(r"\bgh\s+pr\s+merge\b", command):
        return 0

    # Which PR? Explicit number/URL argument wins; otherwise the current branch's PR.
    match = re.search(r"gh\s+pr\s+merge\s+(\d+)", command)
    selector = [match.group(1)] if match else []
    try:
        out = subprocess.run(
            ["gh", "pr", "view", *selector, "--json", "headRefName,files"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if out.returncode != 0:
            return 0  # fail open — no PR context available
        pr = json.loads(out.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, OSError):
        return 0

    head = pr.get("headRefName", "")
    if not head.startswith("issue/"):
        return 0  # docs/chore branches are exempt by the AGENTS.md rule itself

    files = {f.get("path", "") for f in pr.get("files", [])}
    if "progress.md" in files:
        return 0

    print(
        f"BLOCKED by pre-merge gate: PR branch '{head}' is a feature branch "
        "(issue/*) but its diff does not touch progress.md.\n"
        "AGENTS.md rule: bundle the progress.md session entry INTO the feature PR.\n"
        "Fix: append the session entry to progress.md, commit to this branch, "
        "push, then retry the merge.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
