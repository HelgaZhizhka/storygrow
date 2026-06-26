-- CreateEnum
CREATE TYPE "LearningGoalArcType" AS ENUM ('virtue', 'flaw');

-- AlterTable
ALTER TABLE "LearningGoal" ADD COLUMN     "arcType" "LearningGoalArcType" NOT NULL DEFAULT 'virtue';

-- BackfillFlawGoals
UPDATE "LearningGoal"
SET "arcType" = 'flaw'
WHERE "title" IN (
  'Честность',
  'Ответственность',
  'Управление гневом',
  'Бережное отношение к вещам',
  'Терпение',
  'Делиться с другими'
);
