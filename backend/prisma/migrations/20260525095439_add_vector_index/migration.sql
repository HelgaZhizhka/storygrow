-- The HNSW index on VocabularyEntry.embedding used to live here. It moved OUT of
-- Prisma migration history into prisma/sql/hnsw-index.sql, applied via the
-- db:hnsw-index script (and the prisma:migrate wrapper). Reason: Prisma cannot
-- represent `USING hnsw (... vector_cosine_ops)` in schema.prisma, so tracking it
-- in a migration made every `migrate dev` re-propose a spurious DROP INDEX.
-- Intentionally a no-op; kept to preserve migration history order.
SELECT 1;
