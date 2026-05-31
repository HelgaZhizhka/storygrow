-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
