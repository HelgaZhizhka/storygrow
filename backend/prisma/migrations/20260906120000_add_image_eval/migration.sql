-- CreateTable
CREATE TABLE "ImageEval" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "scores" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "failures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reasoning" TEXT,
    "judgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageEval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageEval_bookId_idx" ON "ImageEval"("bookId");

-- AddForeignKey
ALTER TABLE "ImageEval" ADD CONSTRAINT "ImageEval_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
