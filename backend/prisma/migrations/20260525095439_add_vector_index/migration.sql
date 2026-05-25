-- CreateIndex: HNSW index on VocabularyEntry.embedding for fast cosine similarity search.
-- Used by VocabularyRagService to retrieve age-appropriate vocabulary by grade level.
-- HNSW chosen over IVFFlat: no training step needed (no rows yet), better recall at low ef_search.
CREATE INDEX "VocabularyEntry_embedding_hnsw_idx"
  ON "VocabularyEntry"
  USING hnsw ("embedding" vector_cosine_ops);