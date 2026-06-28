# syntax=docker/dockerfile:1

# ---- Stage 1: install deps + build ----
FROM node:22-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
# Root base tsconfig — frontend/tsconfig.json extends ../tsconfig.base.json.
COPY tsconfig.base.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
# Workspace package referenced by frontend's devDeps (@storygrow/eslint-config).
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter=frontend...

COPY frontend ./frontend
RUN pnpm --filter frontend build


# ---- Stage 2: runtime ----
# next build --standalone copies only the necessary files, so the image is minimal.
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Standalone output is fully self-contained (no node_modules copy needed).
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

EXPOSE 3000
# next start is replaced by the standalone server.js
CMD ["node", "frontend/server.js"]
