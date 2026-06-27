# Production Deploy Checklist (Hetzner + Dokploy)

Work through these steps in order. Each section is independent enough to pause and resume.
Check off `[ ]` items as you go.

---

## 1. Hetzner — provision VPS

- [ ] Create account at hetzner.com, add payment method
- [ ] Create server: **CX32** (4 vCPU, 8 GB RAM, 80 GB SSD) or larger
  - Location: Nuremberg or Falkenstein (EU, GDPR-friendly)
  - Image: **Ubuntu 24.04**
  - Add your SSH public key (`~/.ssh/id_rsa.pub`) during creation
- [ ] Note the server's IPv4 address (`<VPS_IP>`)
- [ ] SSH in to verify: `ssh root@<VPS_IP>`

---

## 2. Domain + DNS

- [ ] Buy or point an existing domain (e.g. `storygrow.app`)
- [ ] In your DNS provider, add:
  ```
  A    @              <VPS_IP>
  A    api            <VPS_IP>
  A    langfuse       <VPS_IP>   (optional — for LangFuse subdomain)
  ```
  TTL 300 is fine for initial setup.
- [ ] Verify DNS propagation: `dig +short storygrow.app`

---

## 3. Install Dokploy on VPS

```bash
ssh root@<VPS_IP>
curl -sSL https://dokploy.com/install.sh | sh
```

- [ ] Dokploy installed and running
- [ ] Open `http://<VPS_IP>:3000` in browser, complete Dokploy first-run setup (create admin user)
- [ ] In Dokploy → **Settings → Traefik**: enable Let's Encrypt, enter your email

---

## 4. Connect GitHub repository to Dokploy

- [ ] Dokploy → **Git** → connect `HelgaZhizhka/storygrow` via GitHub OAuth or deploy key
- [ ] Verify the repo appears in Dokploy's source list

---

## 5. Create Dokploy services

Create **two** application services. For each, set **Build type = Dockerfile** and **Docker context = repository root (`.`)**.

### 5a. Backend

| Field | Value |
|-------|-------|
| Name | `storygrow-api` |
| Dockerfile path | `backend/Dockerfile` |
| Docker context | `.` (repo root) |
| Port | `3001` |
| Domain | `api.storygrow.app` |

### 5b. Frontend

| Field | Value |
|-------|-------|
| Name | `storygrow-web` |
| Dockerfile path | `frontend/Dockerfile` |
| Docker context | `.` (repo root) |
| Port | `3000` |
| Domain | `storygrow.app` |

- [ ] Both services created in Dokploy (do not deploy yet — set env vars first)

---

## 6. Managed services (Postgres, Redis, MinIO, LangFuse)

Recommended: use Dokploy's **Compose** tab and paste the repo's `docker-compose.yml` directly.
This deploys Postgres + Redis + MinIO + ClickHouse + LangFuse (v3) + LangFuse worker in one shot,
with the correct inter-service networking.

Steps:
1. Dokploy → **Compose** → New → paste the contents of `docker-compose.yml`
2. Remove the `ports:` bindings for Postgres (5432), Redis (6379), and MinIO (9100/9101) — they should only be reachable internally; Traefik does not need to route to them
3. Add a Traefik domain for LangFuse: `langfuse.storygrow.app` → container port `3000`
4. Set required env vars for the compose stack (see step 7 below)
5. Deploy the compose stack

> Service hostnames within the compose network are the **service names** from `docker-compose.yml`:
> `postgres`, `redis`, `minio`, `clickhouse`, `langfuse`.
> Use these in `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, etc.

- [ ] Compose stack deployed and all services healthy

---

## 7. Environment variables

Set these in Dokploy → `storygrow-api` → **Environment Variables**.
Replace every `<...>` placeholder with a real value.

### Database / Cache / Storage

```env
DATABASE_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/storygrow
REDIS_URL=redis://redis:6379
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=<minio_root_user>
S3_SECRET_KEY=<minio_root_password>
S3_BUCKET=storygrow
```

> Hostnames are the Docker Compose **service names** (`postgres`, `redis`, `minio`),
> not the `container_name` values.

### AI

```env
OPENAI_API_KEY=sk-proj-...
```

> The key MUST have access to **`gpt-5`** — since ADR-0005 the Prose phase runs on
> `PROSE_MODEL=gpt-5` (the Plan phase uses `gpt-4o`, the judge `gpt-4o-mini`).
> Models are set in `backend/src/ai/ai.config.ts`, not via env.

### LangFuse (app credentials — from LangFuse UI after first login)

```env
LANGFUSE_HOST=https://langfuse.storygrow.app
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
```

### LangFuse compose stack env vars (set in the Compose stack, not in storygrow-api)

```env
LANGFUSE_NEXTAUTH_SECRET=<generate: openssl rand -hex 32>
LANGFUSE_SALT=<generate: openssl rand -hex 32>
LANGFUSE_ENCRYPTION_KEY=<generate: openssl rand -hex 64>
CLICKHOUSE_PASSWORD=<generate a strong password>
LANGFUSE_INIT_USER_EMAIL=<your email>
LANGFUSE_INIT_USER_PASSWORD=<secure password>
```

### Auth

```env
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_CALLBACK_URL=https://api.storygrow.app/auth/google/callback
JWT_SECRET=<generate: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate: openssl rand -hex 32>
FRONTEND_URL=https://storygrow.app
```

### Stripe (test mode initially)

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_PREMIUM=price_...
```

### Eval pipeline

```env
EVAL_THRESHOLD=7.0
EVAL_MAX_RETRIES=2
```

> `PUPPETEER_NO_SANDBOX=true` is already set in the backend Dockerfile — no need to add it here.

### Frontend env vars (Dokploy → `storygrow-web`)

```env
NEXT_PUBLIC_API_URL=https://api.storygrow.app
```

- [ ] All backend env vars set
- [ ] All frontend env vars set

---

## 8. Google OAuth — add production callback URL

- [ ] Open [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → your OAuth 2.0 Client
- [ ] Under **Authorised redirect URIs**, add:
  ```
  https://api.storygrow.app/auth/google/callback
  ```
- [ ] Save

---

## 9. Stripe — configure webhook

- [ ] Stripe Dashboard → Webhooks → Add endpoint:
  - URL: `https://api.storygrow.app/api/stripe/webhooks`
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Copy the signing secret → update `STRIPE_WEBHOOK_SECRET` in Dokploy

---

## 10. Deploy

- [ ] Dokploy → `storygrow-api` → **Deploy** → watch build logs
- [ ] Dokploy → `storygrow-web` → **Deploy** → watch build logs
- [ ] Both services reach **Running** status

---

## 11. Run database migrations

After the backend container is running, exec into it:

```bash
# Find the container name in Dokploy or via:
docker ps | grep storygrow-api

docker exec -it <container_id> npx prisma migrate deploy
```

- [ ] Migrations applied (`Applied N migrations` in output)

---

## 12. Seed reference data

```bash
docker exec -it <container_id> node dist/scripts/seed-learning-goals.js
docker exec -it <container_id> node dist/scripts/seed-fast-flow-templates.js
docker exec -it <container_id> node dist/scripts/seed-fast-illustrations.js
```

> These scripts are compiled to `dist/scripts/` by `nest build` and require `DATABASE_URL`
> to be set in the container environment (handled by Dokploy env vars).
>
> **ADR-0005:** vocabulary-RAG is removed from the pipeline, so `seed-vocabulary`
> is **no longer required** (age-fit lives in the judge). Skip it — and step 13.

- [ ] `LearningGoal` rows present (20)
- [ ] `Template` rows present (5)

---

## 13. HNSW index — SKIP (ADR-0005)

> No longer required: vocabulary-RAG is removed from the pipeline, so there is no
> vector search on `VocabularyEntry.embedding` to index. Skip this step.

---

## 14. Smoke test

- [ ] `https://storygrow.app` loads (landing page)
- [ ] `https://api.storygrow.app/health` returns `{"status":"ok"}`
- [ ] Google OAuth login works (redirects back to app)
- [ ] Create a book (fast flow) → progress page shows SSE events → book reaches `ready`
- [ ] PDF download works
- [ ] LangFuse traces visible at `https://langfuse.storygrow.app`

---

## 15. Tighten up

- [ ] MinIO: switch from anonymous-download policy to private + signed URLs for PDF downloads (or keep open for the demo)
- [ ] Postgres backups: enable Dokploy snapshots or set up `pg_dump` cron
- [ ] Set up Dokploy auto-deploy on push to `main` (optional but useful)

---

## Quick reference

```bash
# Check running containers
docker ps

# Tail backend logs
docker logs -f <api_container_id>

# Re-deploy after a push
# → Dokploy → app → Deploy  (or enable auto-deploy)

# Rollback
# → Dokploy → Deployments → pick previous → Rollback
```
