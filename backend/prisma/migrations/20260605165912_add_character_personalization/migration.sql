-- CreateEnum
CREATE TYPE "ProtagonistMode" AS ENUM ('child', 'observer');

-- CreateEnum
CREATE TYPE "ArtStyle" AS ENUM ('watercolor', 'cartoon', 'storybook', 'pixel', 'realistic');

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "artStyle" "ArtStyle" NOT NULL DEFAULT 'watercolor',
ADD COLUMN     "protagonistMode" "ProtagonistMode" NOT NULL DEFAULT 'child';

-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "appearance" TEXT;
