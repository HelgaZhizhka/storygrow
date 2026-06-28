# syntax=docker/dockerfile:1

# ---- Stage 1: install deps + build ----
FROM node:22-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
WORKDIR /app

# Don't download Chromium during install — the runtime stage installs system
# Chromium via apt (pnpm 10 blocks dependency download scripts anyway).
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy workspace manifests first for layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
# Root base tsconfig — backend/tsconfig.json extends ../tsconfig.base.json
# (provides skipLibCheck etc.); without it nest build type-checks dependency .d.ts.
COPY tsconfig.base.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
# Workspace package referenced by backend's devDeps (@storygrow/eslint-config);
# pnpm must resolve it even for a --prod deploy.
COPY packages ./packages
# Prisma schema must exist before install: backend's postinstall runs
# `prisma generate`, which needs backend/prisma/schema.prisma.
COPY backend/prisma ./backend/prisma
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
# Bundle backend + its production node_modules into a self-contained dir.
# pnpm 10 requires --legacy to deploy without injected workspace packages.
# deploy re-runs `prisma generate`, and prisma.config.ts requires DATABASE_URL to
# load (no DB connection happens here), so a dummy URL satisfies config loading.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    pnpm --filter=backend deploy --prod --legacy /deploy


# ---- Stage 3: runtime ----
FROM node:22-slim AS runner

# System Chromium for Puppeteer (+ fonts incl. Cyrillic coverage). More reliable
# than puppeteer's bundled download, which pnpm 10 blocks during install.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-dejavu \
      fonts-noto-color-emoji \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
# Containers run as root without a user namespace, so --no-sandbox is needed
# (read by pdf-render.service). Point Puppeteer at the apt-installed Chromium.
ENV PUPPETEER_NO_SANDBOX=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Production node_modules (flat, from pnpm deploy).
COPY --from=pruner /deploy/node_modules ./node_modules
# Compiled NestJS app.
COPY --from=builder /app/backend/dist ./dist
# Prisma schema + migrations + config (for `prisma migrate deploy` in the container;
# prisma ships in prod deps so the CLI is present).
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/prisma.config.ts ./prisma.config.ts

EXPOSE 3001
CMD ["node", "dist/main"]
