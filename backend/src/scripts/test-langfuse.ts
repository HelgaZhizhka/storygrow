/**
 * Temporary smoke-test script for LangFuse integration.
 * Run: pnpm --filter backend langfuse:test
 * Remove after confirming traces appear in LangFuse UI.
 */
import 'dotenv/config';
import { shutdownTelemetry } from '../instrument.js';

import { PrismaService } from '../prisma/prisma.service.js';
import { VocabularyRagService } from '../ai/rag/vocabulary-rag.service.js';
import { StoryGeneratorService } from '../ai/story-generator/story-generator.service.js';
import { StoryEvaluatorService } from '../ai/story-generator/story-evaluator.service.js';
import { StoryOrchestratorService } from '../ai/story-generator/story-orchestrator.service.js';

const TEST_USER_ID = 'test-langfuse-user';
const TEST_CHILD_ID = 'test-langfuse-child';
const TEST_GOAL_ID = 'test-langfuse-goal';
const TEST_BOOK_ID = 'test-langfuse-book';

async function seed(prisma: PrismaService): Promise<void> {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: { id: TEST_USER_ID, email: 'test-langfuse@example.internal' },
    update: {},
  });
  await prisma.child.upsert({
    where: { id: TEST_CHILD_ID },
    create: { id: TEST_CHILD_ID, name: 'Маша', age: 6, userId: TEST_USER_ID },
    update: {},
  });
  await prisma.learningGoal.upsert({
    where: { id: TEST_GOAL_ID },
    create: { id: TEST_GOAL_ID, title: 'Дружба', description: 'научиться дружить' },
    update: {},
  });
  await prisma.book.upsert({
    where: { id: TEST_BOOK_ID },
    create: {
      id: TEST_BOOK_ID,
      title: 'Test book',
      userId: TEST_USER_ID,
      childId: TEST_CHILD_ID,
      learningGoalId: TEST_GOAL_ID,
    },
    update: {},
  });
}

async function cleanup(prisma: PrismaService): Promise<void> {
  await prisma.storyEval.deleteMany({ where: { bookId: TEST_BOOK_ID } });
  await prisma.book.deleteMany({ where: { id: TEST_BOOK_ID } });
  await prisma.learningGoal.deleteMany({ where: { id: TEST_GOAL_ID } });
  await prisma.child.deleteMany({ where: { id: TEST_CHILD_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.onModuleInit();

  await cleanup(prisma);
  await seed(prisma);

  const vocabularyRag = new VocabularyRagService(prisma);
  const generator = new StoryGeneratorService();
  const evaluator = new StoryEvaluatorService();
  const orchestrator = new StoryOrchestratorService(generator, evaluator, vocabularyRag, prisma);

  console.log(`Generating story for bookId=${TEST_BOOK_ID}...`);

  try {
    const result = await orchestrator.generate({
      bookId: TEST_BOOK_ID,
      childName: 'Маша',
      childAge: 6,
      topic: 'дружба',
      learningGoal: 'научиться дружить',
    });

    console.log(`Done. attempts=${result.attempts} evalId=${result.evalId}`);
    console.log(`Check LangFuse: http://localhost:3030 → Traces → story-generation`);
  } finally {
    await cleanup(prisma);
    await prisma.$disconnect();
  }
}

let exitCode = 0;
main()
  .catch((err: unknown) => {
    console.error(err);
    exitCode = 1;
  })
  .finally(() => shutdownTelemetry().then(() => process.exit(exitCode)));
