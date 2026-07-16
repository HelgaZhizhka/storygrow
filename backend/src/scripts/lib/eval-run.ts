/**
 * Shared single-run text-eval logic (#162) — used by both the single-run
 * harness (eval-text.ts) and the batch harness (eval-batch.ts).
 *
 * Runs ONLY VocabularyRag → StoryGenerator → StoryEvaluator (no images, no PDF,
 * no DB writes; bookId 'dry-run'). One generation attempt, no regeneration loop —
 * the batch metric is FIRST-ATTEMPT quality.
 *
 * Services are instantiated manually (NOT via NestFactory): tsx/esbuild does not
 * emit `emitDecoratorMetadata`, so Nest DI cannot resolve constructor params here.
 */
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { VocabularyRagService } from '../../ai/rag/vocabulary-rag.service';
import { StoryGeneratorService } from '../../ai/story-generator/story-generator.service';
import {
  StoryEvaluatorService,
  type EvalCheckResult,
} from '../../ai/story-generator/story-evaluator.service';
import { ageToGradeLevel } from '../../ai/rag/age-grade.map';
import type { Story } from '../../ai/schemas';
import type { StorySeeds } from '../../ai/prompts/story-generator.prompt';

const configShim = {
  getOrThrow: (key: string): string => {
    const value = process.env[key];
    if (value == null || value === '') throw new Error(`Missing env: ${key}`);
    return value;
  },
  get: (key: string): string | undefined => process.env[key],
} as unknown as ConfigService;

export interface EvalServices {
  prisma: PrismaService;
  vocab: VocabularyRagService;
  generator: StoryGeneratorService;
  evaluator: StoryEvaluatorService;
}

export const createEvalServices = async (): Promise<EvalServices> => {
  const prisma = new PrismaService();
  await prisma.onModuleInit();
  return {
    prisma,
    vocab: new VocabularyRagService(prisma, configShim),
    generator: new StoryGeneratorService(configShim),
    evaluator: new StoryEvaluatorService(configShim),
  };
};

export interface RunTextEvalInput {
  goalTitle: string;
  age: number;
  mode: 'child' | 'observer';
  model?: string;
  appearance?: string;
  seeds?: StorySeeds;
}

export interface TextEvalOutcome {
  story: Story;
  checks: EvalCheckResult;
  arcType: 'virtue' | 'flaw';
  avgChars: number;
  maxChars: number;
}

export const runTextEval = async (
  services: EvalServices,
  input: RunTextEvalInput,
): Promise<TextEvalOutcome> => {
  const goal = await services.prisma.learningGoal.findFirst({
    where: { title: input.goalTitle },
    select: { title: true, description: true, arcType: true },
  });
  const topic = goal?.title ?? input.goalTitle;
  const learningGoal = goal?.description ?? input.goalTitle;
  const arcType = goal?.arcType ?? 'virtue';

  const corpusWords = await services.vocab.listByGrade(ageToGradeLevel(input.age));

  const story = await services.generator.generateStory({
    bookId: 'dry-run',
    childName: 'Алиса',
    childAge: input.age,
    topic,
    learningGoal,
    protagonistMode: input.mode,
    arcType,
    appearance: input.appearance,
    seeds: input.seeds,
    model: input.model,
  });

  const checks = await services.evaluator.evaluate({
    story,
    childAge: input.age,
    learningGoal,
    bookId: 'dry-run',
    corpusWords,
  });

  const lengths = story.pages.filter((p) => p.text != null).map((p) => (p.text as string).length);
  const avgChars =
    lengths.length === 0 ? 0 : Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const maxChars = lengths.length === 0 ? 0 : Math.max(...lengths);

  return { story, checks, arcType, avgChars, maxChars };
};
