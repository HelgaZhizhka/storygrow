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
  # No --silent: it hides pnpm's own diagnostic output (e.g. a version-mismatch
  # rebuild attempt) behind a bare non-zero exit, which reads as a code failure
  # instead of an environment one.
  if (cd "$pkg" && pnpm "$@"); then
    pass "$pkg $*"
  else
    fail "$pkg $*"
  fi
}

log "Node + pnpm versions"
# engines.node (e.g. ">=22.0.0") is the real contract -- .nvmrc's exact patch
# is just a dev-convenience pin for nvm/fnm, not a hard requirement, and a
# newer Node satisfying the >= floor is expected to work.
MIN_NODE="$(node -pe "require('$REPO_ROOT/package.json').engines.node" 2>/dev/null | sed 's/^>=//')"
EXPECTED_PNPM="$(node -pe "require('$REPO_ROOT/package.json').packageManager" 2>/dev/null | sed 's/^pnpm@//')"
ACTUAL_NODE="$(node --version | sed 's/^v//')"
ACTUAL_PNPM="$(pnpm --version)"
echo "node: $ACTUAL_NODE (>= $MIN_NODE required) / pnpm: $ACTUAL_PNPM (expected $EXPECTED_PNPM)"

# Below the engines.node floor is a genuine environment_failure -- fail fast
# with one clear message rather than letting every downstream step report a
# misleading code-looking failure.
if [ -n "$MIN_NODE" ] && [ "$(printf '%s\n%s\n' "$MIN_NODE" "$ACTUAL_NODE" | sort -V | head -1)" != "$MIN_NODE" ]; then
  printf '\033[1;31m✗ environment_failure: Node >=%s required (package.json engines), found %s\033[0m\n' \
    "$MIN_NODE" "$ACTUAL_NODE"
  exit 1
fi
# A pnpm version different from the pinned packageManager is usually resolved
# transparently by corepack, but is the documented trigger for pnpm silently
# attempting to rebuild node_modules against the wrong toolchain (which can
# hang without a TTY) -- warn loudly rather than fail, since it hasn't
# actually broken anything observed so far.
if [ -n "$EXPECTED_PNPM" ] && [ "$ACTUAL_PNPM" != "$EXPECTED_PNPM" ]; then
  printf '\033[1;33m⚠ pnpm %s pinned (package.json), found %s -- if pnpm hangs or every step fails identically, this is likely why\033[0m\n' \
    "$EXPECTED_PNPM" "$ACTUAL_PNPM"
fi

# Skip workspace install on smoke runs — assume installed.

log "Format check"
if pnpm format:check; then
  pass "format:check"
else
  fail "format:check"
fi

run_in_pkg backend  exec tsc --noEmit
run_in_pkg backend  lint
run_in_pkg backend  test --silent

run_in_pkg frontend exec tsc --noEmit
run_in_pkg frontend lint
run_in_pkg frontend test --run --silent

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
