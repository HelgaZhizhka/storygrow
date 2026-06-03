-- pgvector HNSW index on VocabularyEntry.embedding for cosine similarity search.
-- Managed OUTSIDE Prisma migrations: Prisma cannot represent
-- `USING hnsw (embedding vector_cosine_ops)` in schema.prisma, so tracking it in
-- a migration causes perpetual drift (Prisma re-proposes DROP on every migrate dev).
-- Idempotent — safe to run after every migrate/reset/deploy. See prisma:migrate
-- wrapper and the db:hnsw-index script.
CREATE INDEX IF NOT EXISTS "VocabularyEntry_embedding_hnsw_idx"
  ON "VocabularyEntry"
  USING hnsw ("embedding" vector_cosine_ops);
