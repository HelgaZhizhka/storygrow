# ADR-0003: Ship Chromium inside the API container

**Status:** Accepted
**Date:** 2026-06-04

## Context

StoryGrow generates PDFs server-side using Puppeteer (headless Chromium). In production the backend runs inside a Docker container. Two options exist for supplying the Chromium binary:

**Option A — Puppeteer-bundled Chromium in the API container**
Puppeteer downloads a pinned, tested Chromium revision during `pnpm install`. The binary lives in the Puppeteer cache directory and is referenced by `puppeteer.launch()` automatically. The API image includes the required shared libraries (`libnss3`, `libgbm1`, etc.) from Debian packages.

**Option B — Separate render service**
A dedicated container (e.g., `browserless/chrome`) exposes a WebSocket endpoint. Puppeteer connects remotely via `browserOptions.browserWSEndpoint`. Adds one more service, one more port, and cross-service networking to manage.

## Decision

Use **Option A**. At course-project scale the operational simplicity of a single API container outweighs the isolation benefit of a separate renderer. The image will be larger (~300 MB for Chromium) but only one service needs to be deployed and monitored.

## Consequences

- `backend/Dockerfile` installs the Debian Chromium runtime libraries in the runner stage.
- `PUPPETEER_NO_SANDBOX=true` is set in the container environment (root user inside Docker without a user namespace cannot use the browser sandbox).
- `PUPPETEER_CACHE_DIR` is set to a project-local path so the pre-downloaded binary is copied from the builder stage to the runner stage — no re-download at runtime.
- The backend Docker image is ~650 MB uncompressed. Acceptable for a VPS deploy.
- If PDF rendering is ever extracted to a dedicated worker, revisit Option B.
