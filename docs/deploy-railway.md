# Production Deploy — Railway

The chosen deploy target (Railway account already provisioned). Simpler than the
Hetzner + Dokploy path in [deploy-checklist.md](deploy-checklist.md), which remains
as an alternative.

**Stack on Railway:** backend (Dockerfile) · frontend (Dockerfile) · Postgres
(pgvector) · Redis. **External:** Cloudflare R2 for object storage. **LangFuse:**
off for the first deploy (the backend boots without it).

Both Dockerfiles are validated (`docker build` green) — see PR #203.

---

## 0. Accounts / secrets you need

- Railway (paid ✓)
- Cloudflare (free) — for R2 object storage
- OpenAI API key **with `gpt-5` access** (Prose phase uses `PROSE_MODEL=gpt-5`)
- Google OAuth client (Cloud Console) — for login
- Stripe keys (test mode is fine to start)
- A domain (optional — Railway gives `*.up.railway.app` URLs to start)

---

## 1. Railway project + repo

- [ ] New Railway project → **Deploy from GitHub repo** → `HelgaZhizhka/storygrow`
- [ ] Connect the repo (Railway GitHub app)

## 2. Postgres (with pgvector)

The Prisma schema still declares the `vector` extension (migrations enable it),
so the database must support **pgvector**.

- [ ] Add a **Postgres** service. Use a **pgvector-capable** image/template
  (Railway's `pgvector` template, or a Postgres plugin where `CREATE EXTENSION
  vector` succeeds). Verify later that `migrate deploy` runs without an extension
  error.
- [ ] Note: vocab-RAG is removed (ADR-0005); pgvector is only needed because the
  schema still carries the (unused) `embedding` column. A follow-up will drop it,
  after which plain Postgres suffices.

## 3. Redis

- [ ] Add a **Redis** service (BullMQ queue + SSE).

## 4. Cloudflare R2 (object storage)

- [ ] Cloudflare dashboard → R2 → **Create bucket** `storygrow`
- [ ] Create an **R2 API token** (Access Key ID + Secret). Note the **S3 API
  endpoint** `https://<accountid>.r2.cloudflarestorage.com`
- [ ] (For public PDF/image URLs) enable a public bucket URL or an `images.<domain>`
  custom domain — or keep private and serve via signed URLs (see step 9).

## 5. Backend service (`storygrow-api`)

Settings:

| Field | Value |
|---|---|
| Source | the repo |
| Root directory | `/` (repo root — the Docker build context) |
| Dockerfile path | `backend/Dockerfile` |
| Exposed port | `3001` |

Environment variables (Railway → service → Variables). Use Railway **references**
(`${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`) where possible:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

OPENAI_API_KEY=sk-proj-...            # must have gpt-5 access

# Cloudflare R2 (S3-compatible)
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_ACCESS_KEY=<r2_access_key_id>
S3_SECRET_KEY=<r2_secret>
S3_BUCKET=storygrow

# Auth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://<api-domain>/auth/google/callback
JWT_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
FRONTEND_URL=https://<web-domain>

# Stripe (test to start)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_PREMIUM=price_...

# Eval
EVAL_THRESHOLD=7.0
EVAL_MAX_RETRIES=2

# LangFuse OFF for first deploy (backend boots without keys)
LANGFUSE_ENABLED=false
```

## 6. Frontend service (`storygrow-web`)

| Field | Value |
|---|---|
| Root directory | `/` |
| Dockerfile path | `frontend/Dockerfile` |
| Exposed port | `3000` |

`NEXT_PUBLIC_API_URL` is inlined at **build** time, so set it as a **build
variable / build arg** (not just a runtime var):

```env
NEXT_PUBLIC_API_URL=https://<api-domain>
```

## 7. Domains

- [ ] Give each service a domain (Railway-generated `*.up.railway.app` to start,
  or custom). Set the backend's domain as `<api-domain>` and the frontend's as
  `<web-domain>`, and plug them into the env vars above (FRONTEND_URL,
  GOOGLE_CALLBACK_URL, NEXT_PUBLIC_API_URL).

## 8. Database migrations + seed

The `prisma` CLI ships in the production image (it is a prod dependency), and the
schema + `prisma.config.ts` are present — so migrations run directly in the
container (a Railway one-off, or a pre-deploy command). `DATABASE_URL` must be set
(it is, from the Postgres service).

```bash
# in the backend container / Railway one-off (WORKDIR /app):
node_modules/.bin/prisma migrate deploy
# seed reference data (NOT vocabulary — removed in ADR-0005):
node dist/scripts/seed-learning-goals.js
node dist/scripts/seed-fast-flow-templates.js
node dist/scripts/seed-fast-illustrations.js
```

- [ ] Migrations applied
- [ ] `LearningGoal` (20) + `Template` (5) present

## 9. External integrations

- [ ] Google OAuth → add `https://<api-domain>/auth/google/callback` to authorised
  redirect URIs.
- [ ] Stripe → webhook endpoint `https://<api-domain>/api/stripe/webhooks`
  (events: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`) → copy signing secret to `STRIPE_WEBHOOK_SECRET`.

## 10. Smoke test

- [ ] `https://<web-domain>` loads
- [ ] `https://<api-domain>/health` → `{"status":"ok"}`
- [ ] Google login round-trips
- [ ] Create a book (fast flow) → SSE progress → `ready` → PDF downloads
- [ ] Create a custom book → Plan→Prose→judge runs → images → PDF

## Known follow-ups
- Drop the dead `VocabularyEntry`/`vector` schema → plain Postgres (no pgvector).
- Turn on LangFuse Cloud (set `LANGFUSE_PUBLIC_KEY`/`SECRET_KEY`/`HOST`, remove
  `LANGFUSE_ENABLED=false`).
