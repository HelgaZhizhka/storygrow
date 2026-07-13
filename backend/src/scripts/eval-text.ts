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
 *
 * The arc type (virtue|flaw) is taken from the LearningGoal row, so a flaw goal
 * (e.g. Честность) is generated with the flaw beat sheet + exemplar automatically.
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
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const goalTitle = positional[0];
  const age = Number(positional[1] ?? '6');
  const mode = (positional[2] ?? 'child') as 'child' | 'observer';
  const modelFlag = process.argv.find((a) => a.startsWith('--model='));
  const model = modelFlag ? modelFlag.slice('--model='.length) : undefined;
  const appearanceFlag = process.argv.find((a) => a.startsWith('--appearance='));
  const appearance = appearanceFlag ? appearanceFlag.slice('--appearance='.length) : undefined;
  const seedFlag = (name: string): string[] => {
    const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
    return flag
      ? flag
          .slice(`--${name}=`.length)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  };
  const seeds = {
    interests: seedFlag('interests'),
    motifs: seedFlag('motifs'),
    favoriteWords: seedFlag('favoriteWords'),
  };
  if (!goalTitle) {
    console.error(
      'Usage: pnpm --filter backend eval:text "<goal>" <age> [child|observer] [--model=<id>]',
    );
    process.exit(1);
  }

  const prisma = new PrismaService();
  await prisma.onModuleInit();
  const vocab = new VocabularyRagService(prisma, configShim);
  const generator = new StoryGeneratorService(configShim);
  const evaluator = new StoryEvaluatorService(configShim);

  const goal = await prisma.learningGoal.findFirst({
    where: { title: goalTitle },
    select: { title: true, description: true, arcType: true },
  });
  const topic = goal?.title ?? goalTitle;
  const learningGoal = goal?.description ?? goalTitle;
  const arcType = goal?.arcType ?? 'virtue';

  const gradeLevel = ageToGradeLevel(age);
  const corpusWords = await vocab.listByGrade(gradeLevel);

  const story = await generator.generateStory({
    bookId: 'dry-run',
    childName: 'Алиса',
    childAge: age,
    topic,
    learningGoal,
    protagonistMode: mode,
    arcType,
    appearance,
    seeds,
    model,
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

  console.log(
    `\n=== "${story.title}" | goal=${goalTitle} | arc=${arcType} | age=${age} | mode=${mode} | model=${model ?? 'default'} ===\n`,
  );
  console.log(`characterProfile (image-only): ${story.characterProfile}\n`);
  story.pages.forEach((p, i) => {
    const len = p.text ? ` [${p.text.length}]` : '';
    console.log(`[${i + 1}] ${p.template}${len}\n    ${p.text ?? `(${p.template}, no text)`}`);
    console.log(`    IMG: ${p.illustrationPrompt}\n`);
  });
  console.log(
    `pages w/ text: ${lengths.length} | avg chars: ${avg} | max: ${Math.max(...lengths)}`,
  );
  console.log(`judge scores: ${JSON.stringify(checks.judgeResult.scores)}`);
  console.log(
    `registerMatch (finalScore): ${checks.computedFinalScore}/10 | passed: ${checks.passed}`,
  );
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
