#!/usr/bin/env bash
# StoryGrow smoke-check.
# Run at session start (verifies clean base) and before claiming a feature done.
#
# Exits 0 on success. Non-zero on any failure.
# Skips checks for packages that don't exist yet (backend/frontend may be empty at week 1).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

ok=true
log() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*"; ok=false; }
pass() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }

run_in_pkg() {
  local pkg="$1"; shift
  if [ ! -f "$pkg/package.json" ]; then
    printf '\033[1;33m· skipping %s — not scaffolded yet\033[0m\n' "$pkg"
    return 0
  fi
  log "$pkg: $*"
  if (cd "$pkg" && pnpm --silent "$@"); then
    pass "$pkg $*"
  else
    fail "$pkg $*"
  fi
}

log "Node + pnpm versions"
node --version
pnpm --version

# Skip workspace install on smoke runs — assume installed.

run_in_pkg backend  exec tsc --noEmit
run_in_pkg backend  lint
run_in_pkg backend  test --silent

run_in_pkg frontend exec tsc --noEmit
run_in_pkg frontend lint
run_in_pkg frontend test --silent

log "Git status (informational)"
if [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then
  printf '\033[1;33m· working tree has uncommitted changes\033[0m\n'
else
  pass "working tree clean"
fi

if $ok; then
  log "Smoke check PASSED"
  exit 0
else
  log "Smoke check FAILED"
  exit 1
fi
