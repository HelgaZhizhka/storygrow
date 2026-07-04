-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "belongings" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "favoriteWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "motifs" TEXT[] DEFAULT ARRAY[]::TEXT[];
