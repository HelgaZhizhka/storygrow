-- #379: page provenance on the judge row (model, prompt, reference labels) and the
-- image model on the book (portrait + sheets), so cost per provider and a bad page
-- are readable from the DB without LangFuse.
ALTER TABLE "ImageEval" ADD COLUMN "model" TEXT;
ALTER TABLE "ImageEval" ADD COLUMN "prompt" TEXT;
ALTER TABLE "ImageEval" ADD COLUMN "labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Book" ADD COLUMN "imageModel" TEXT;
