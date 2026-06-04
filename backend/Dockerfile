# syntax=docker/dockerfile:1

# ---- Stage 1: install deps + build ----
FROM node:22-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
WORKDIR /app

# Cache Puppeteer's Chromium inside the build context so we can copy it later.
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer-cache

# Copy workspace manifests first for layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
# Install all deps (postinstall: prisma generate + puppeteer downloads Chromium).
RUN pnpm install --frozen-lockfile --filter=backend...

# Copy source and compile.
COPY backend ./backend
RUN pnpm --filter backend build


# ---- Stage 2: prune to production deps ----
FROM node:22-slim AS pruner
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
WORKDIR /app
COPY --from=builder /app ./
# pnpm deploy copies packages from the store without re-running lifecycle scripts,
# so Puppeteer does NOT re-download Chromium here (we'll bring the cache from builder).
RUN pnpm --filter=backend deploy --prod /deploy


# ---- Stage 3: runtime ----
FROM node:22-slim AS runner

# Chromium shared libraries required by Puppeteer's bundled browser.
# See: https://pptr.dev/troubleshooting#running-puppeteer-on-linux
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 \
      libatk-bridge2.0-0 \
      libcups2 \
      libdrm2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libgbm1 \
      libpango-1.0-0 \
      libcairo2 \
      libasound2 \
      libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
# Required: containers run as root without a user namespace, so --no-sandbox is needed.
ENV PUPPETEER_NO_SANDBOX=true
# Tell Puppeteer where the pre-downloaded Chromium lives.
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer-cache

# Production node_modules (flat, from pnpm deploy).
COPY --from=pruner /deploy/node_modules ./node_modules
# Pre-downloaded Chromium binary from builder.
COPY --from=builder /app/.puppeteer-cache ./.puppeteer-cache
# Compiled NestJS app.
COPY --from=builder /app/backend/dist ./dist
# Prisma schema + migrations (needed for prisma migrate deploy in CI/CD).
COPY --from=builder /app/backend/prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/main"]
