-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "characterDescriptor" TEXT,
ADD COLUMN     "childPhotoKey" TEXT,
ADD COLUMN     "photoConsent" BOOLEAN NOT NULL DEFAULT false;
