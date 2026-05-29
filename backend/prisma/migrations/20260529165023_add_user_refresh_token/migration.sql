-- DropIndex
DROP INDEX "VocabularyEntry_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "refreshToken" TEXT;
