-- #376: structured English appearance from the photo descriptor, for pages and the judge.
ALTER TABLE "Book" ADD COLUMN "characterAppearance" JSONB;
