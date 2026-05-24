# Local development — Docker services

`docker-compose.yml` brings up everything the backend needs locally:

| Service                | Port(s)         | Notes                                       |
| ---------------------- | --------------- | ------------------------------------------- |
| `postgres` (pgvector)  | `5432`          | Hosts both `storygrow` and `langfuse` DBs.  |
| `redis`                | `6379`          | BullMQ queues, generation cache.            |
| `minio`                | `9000` / `9001` | API / console. Console login: `S3_*` creds. |
| `minio-create-buckets` | —               | One-shot init; exits after bucket is ready. |
| `langfuse`             | `3030`          | UI at `http://localhost:3030`.              |

Application processes (not in compose):

| Process               | Port   |
| --------------------- | ------ |
| `frontend` (Next.js)  | `3000` |
| `backend` (NestJS)    | `3001` |

## First-run

```bash
cp .env.example .env.local            # fill in real OPENAI/GOOGLE/STRIPE keys
docker compose up -d                  # ~30s on a warm cache
docker compose ps                     # confirm all services healthy
```

Visit:

- `http://localhost:9001` — MinIO console (login with `S3_ACCESS_KEY` / `S3_SECRET_KEY` from `.env.local`)
- `http://localhost:3030` — LangFuse UI (login with `LANGFUSE_INIT_USER_EMAIL` / `LANGFUSE_INIT_USER_PASSWORD`). Then create a project and copy its public/secret keys into `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` in `.env.local`.

## Common commands

```bash
docker compose up -d                  # start everything
docker compose down                   # stop, keep volumes
docker compose down -v                # stop and WIPE all data (postgres, minio, redis)
docker compose logs -f langfuse       # tail one service
docker compose exec postgres psql -U storygrow storygrow   # interactive psql
```

## Resetting just one service

```bash
docker compose rm -sfv langfuse       # drop the langfuse container + volume
docker compose up -d langfuse         # recreate clean
```

## Notes

- `LANGFUSE_NEXTAUTH_SECRET` and `LANGFUSE_SALT` default to placeholders — rotate before any real deployment.
- The first-run `LANGFUSE_INIT_*` vars only take effect on the very first start of an empty `langfuse` database. Reset the LangFuse volume to change them.
- The `langfuse` DB is created by `infra/postgres/init/01-create-langfuse-db.sql` on first start of the `postgres` volume. To re-run the init script, `docker compose down -v` (wipes everything).
