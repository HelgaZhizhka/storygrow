-- #374: a retry after images_failed is a new generation run; attempts are numbered per run.
ALTER TABLE "ImageEval" ADD COLUMN "run" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "ImageEval_bookId_run_idx" ON "ImageEval"("bookId", "run");
