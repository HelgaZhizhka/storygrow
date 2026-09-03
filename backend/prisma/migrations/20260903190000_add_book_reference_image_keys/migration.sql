-- Visual Bible reference sheets (#348, PR 2): S3 keys of generated location and
-- cast reference images, so book deletion can clean them up.
ALTER TABLE "Book" ADD COLUMN     "referenceImageKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
