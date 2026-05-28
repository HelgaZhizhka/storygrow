-- DropIndex
DROP INDEX "VocabularyEntry_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "StoryEval" ADD COLUMN     "judgeReasoning" TEXT,
ADD COLUMN     "passed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vocabularyCompliance" DOUBLE PRECISION;
