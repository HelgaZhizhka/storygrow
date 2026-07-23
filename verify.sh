#!/usr/bin/env bash
# StoryGrow release verification — builds, Docker builds, Prisma drift, and one
# authenticated e2e happy-path. Heavier and slower than init.sh (which stays the
# fast per-PR gate) — this runs only on merge to main (#155).
#
# Requires: Docker, a real OPENAI_API_KEY in the environment.
# Exits 0 on success. Non-zero on any failure.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

log() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
pass() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }

: "${OPENAI_API_KEY:?OPENAI_API_KEY must be set}"
: "${DATABASE_URL:?DATABASE_URL must be set}"

BACKEND_PID=""
FRONTEND_PID=""
cleanup() {
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

log "Backend build"
pnpm --filter backend build
pass "backend build"

log "Frontend build"
pnpm --filter frontend build
pass "frontend build"

log "Docker build: backend"
docker build -f backend/Dockerfile -t storygrow-backend-verify .
pass "backend Docker build"

log "Docker build: frontend"
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001}" \
  -t storygrow-frontend-verify .
pass "frontend Docker build"

log "Docker Compose services (postgres, redis, minio)"
docker compose up -d --wait postgres redis minio
pass "services healthy"

log "MinIO bucket init"
# minio-create-buckets is a one-shot job (exits 0 on success) -- `--wait` treats
# an exited container as unhealthy, so it can't be in the --wait list above.
# Running it without -d blocks until it actually exits, same effect.
docker compose up minio-create-buckets
pass "buckets ready"

log "Prisma migrate deploy"
pnpm --filter backend exec prisma migrate deploy
pass "migrations applied"

log "Prisma drift check"
pnpm --filter backend exec prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel backend/prisma/schema.prisma \
  --exit-code
pass "no schema drift"

log "Seed reference data"
pnpm --filter backend seed:learning-goals
pnpm --filter backend seed:templates
pnpm --filter backend seed:illustrations
pass "seeded"

log "Start backend (test mode)"
E2E_TEST_MODE=true pnpm --filter backend start:prod &
BACKEND_PID=$!
for _ in $(seq 1 30); do
  curl -sf http://localhost:3001/health >/dev/null && break
  sleep 1
done
curl -sf http://localhost:3001/health >/dev/null
pass "backend up"

log "Start frontend"
pnpm --filter frontend start &
FRONTEND_PID=$!
for _ in $(seq 1 30); do
  curl -sf http://localhost:3000 >/dev/null && break
  sleep 1
done
curl -sf http://localhost:3000 >/dev/null
pass "frontend up"

log "Authenticated e2e: create-book"
PW_REUSE_SERVER=true pnpm --filter frontend exec playwright test e2e/create-book.spec.ts
pass "e2e passed"

log "Release verification PASSED"
