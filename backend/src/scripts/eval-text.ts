/**
 * Text-only generation harness — iterate on story TEXT quality cheaply.
 *
 * Runs ONLY VocabularyRag → StoryGenerator → StoryEvaluator (no images, no PDF,
 * no DB writes). Costs cents (gpt-4o-mini text + judge), seconds to run.
 *
 * Services are instantiated manually (NOT via NestFactory): tsx/esbuild does not
 * emit `emitDecoratorMetadata`, so Nest DI cannot resolve constructor params here.
 *
 * Usage:
 *   pnpm --filter backend eval:text "<goal>" <age> [child|observer]
 * Example:
 *   pnpm --filter backend eval:text "Смелость" 6 child
 */
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { VocabularyRagService } from '../ai/rag/vocabulary-rag.service';
import { StoryGeneratorService } from '../ai/story-generator/story-generator.service';
import { StoryEvaluatorService } from '../ai/story-generator/story-evaluator.service';
import { ageToGradeLevel } from '../ai/rag/age-grade.map';

const configShim = {
  getOrThrow: (key: string): string => {
    const value = process.env[key];
    if (value == null || value === '') throw new Error(`Missing env: ${key}`);
    return value;
  },
  get: (key: string): string | undefined => process.env[key],
} as unknown as ConfigService;

const main = async (): Promise<void> => {
  const goalTitle = process.argv[2];
  const age = Number(process.argv[3] ?? '6');
  const mode = (process.argv[4] ?? 'child') as 'child' | 'observer';
  if (!goalTitle) {
    console.error('Usage: pnpm --filter backend eval:text "<goal>" <age> [child|observer]');
    process.exit(1);
  }

  const prisma = new PrismaService();
  await prisma.onModuleInit();
  const vocab = new VocabularyRagService(prisma, configShim);
  const generator = new StoryGeneratorService(configShim);
  const evaluator = new StoryEvaluatorService(configShim);

  const goal = await prisma.learningGoal.findFirst({
    where: { title: goalTitle },
    select: { title: true, description: true },
  });
  const topic = goal?.title ?? goalTitle;
  const learningGoal = goal?.description ?? goalTitle;

  const gradeLevel = ageToGradeLevel(age);
  const allowedWords = await vocab.retrieve({ topic, learningGoal, gradeLevel });
  const corpusWords = await vocab.listByGrade(gradeLevel);

  const story = await generator.generateStory({
    bookId: 'dry-run',
    childName: 'Тест',
    childAge: age,
    topic,
    learningGoal,
    allowedWords,
    protagonistMode: mode,
    arcType: 'virtue',
  });

  const checks = await evaluator.evaluate({
    story,
    childAge: age,
    learningGoal,
    bookId: 'dry-run',
    corpusWords,
  });

  const lengths = story.pages.filter((p) => p.text != null).map((p) => (p.text as string).length);
  const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);

  console.log(`\n=== "${story.title}" | goal=${goalTitle} | age=${age} | mode=${mode} ===\n`);
  story.pages.forEach((p, i) => {
    const len = p.text ? ` [${p.text.length}]` : '';
    console.log(`[${i + 1}] ${p.template}${len}\n    ${p.text ?? `(${p.template}, no text)`}\n`);
  });
  console.log(
    `pages w/ text: ${lengths.length} | avg chars: ${avg} | max: ${Math.max(...lengths)}`,
  );
  console.log(`judge scores: ${JSON.stringify(checks.judgeResult.scores)}`);
  console.log(`finalScore: ${checks.computedFinalScore} | passed: ${checks.passed}`);
  console.log(`vocabularyCompliance: ${checks.vocabularyCompliance.toFixed(2)}`);
  if (checks.structuralErrors.length > 0) console.log(`structural:`, checks.structuralErrors);
  if (checks.outOfCorpus.length > 0)
    console.log(
      `outOfCorpus (${checks.outOfCorpus.length}): ${checks.outOfCorpus.slice(0, 15).join(', ')}`,
    );
  console.log(`\njudge reasoning: ${checks.judgeResult.reasoning}\n`);

  await prisma.$disconnect();
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
