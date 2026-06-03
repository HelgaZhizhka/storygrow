// Wraps `prisma migrate dev` to keep the pgvector HNSW index out of Prisma's way.
//
// The index lives OUTSIDE migration history (prisma/sql/hnsw-index.sql) because
// Prisma cannot represent `USING hnsw (embedding vector_cosine_ops)` in
// schema.prisma. That means the live index always looks like drift to
// `migrate dev`, which then demands a full database reset. To avoid that, we
// drop the index first (so the dev DB matches migration history exactly), run
// migrate dev cleanly, then re-create the index from the canonical SQL file.
//
// Prod uses `migrate deploy` (no drift detection) plus the db:hnsw-index script,
// so the index is never dropped there. Env (DATABASE_URL) is loaded by the
// dotenv-cli wrapper in package.json.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const createIndexSql = readFileSync(new URL('./sql/hnsw-index.sql', import.meta.url), 'utf8');
const dropIndexSql = 'DROP INDEX IF EXISTS "VocabularyEntry_embedding_hnsw_idx";';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(dropIndexSql);
  run(`prisma migrate dev ${process.argv.slice(2).join(' ')}`.trim());
} finally {
  await pool.query(createIndexSql);
  await pool.end();
}
