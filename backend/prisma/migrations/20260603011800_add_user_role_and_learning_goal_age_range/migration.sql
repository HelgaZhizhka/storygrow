-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- AlterTable
ALTER TABLE "LearningGoal" ADD COLUMN     "ageRangeMax" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "ageRangeMin" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'user';
