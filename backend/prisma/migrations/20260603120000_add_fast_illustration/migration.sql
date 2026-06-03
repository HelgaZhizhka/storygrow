CREATE TABLE "FastIllustration" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FastIllustration_pkey" PRIMARY KEY ("id")
);
