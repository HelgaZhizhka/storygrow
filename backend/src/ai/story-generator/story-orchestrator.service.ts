import { Injectable } from '@nestjs/common';
import { type Story } from '../schemas';
import { buildRegenerationFeedback } from '../prompts/story-generator.prompt';
import { VocabularyRagService } from '../rag/vocabulary-rag.service';
import { ageToGradeLevel } from '../rag/age-grade.map';
import { PrismaService } from '../../prisma/prisma.service';
import { StoryGeneratorService } from './story-generator.service';
import { StoryEvaluatorService, type EvalCheckResult } from './story-evaluator.service';
import { StoryGenerationFailedError } from './errors';
import { EVAL_MAX_RETRIES_DEFAULT } from '../ai.config';

export interface GenerateStoryOptions {
  bookId: string;
  childName: string;
  childAge: number;
  topic: string;
  learningGoal: string;
}

export interface GenerateStoryResult {
  story: Story;
  evalId: string;
  attempts: number;
}

interface LoopContext {
  opts: GenerateStoryOptions;
  allowedWords: readonly string[];
  maxAttempts: number;
}

@Injectable()
export class StoryOrchestrator {
  constructor(
    private readonly generator: StoryGeneratorService,
    private readonly evaluator: StoryEvaluatorService,
    private readonly vocabularyRag: VocabularyRagService,
    private readonly prisma: PrismaService,
  ) {}

  async generate(opts: GenerateStoryOptions): Promise<GenerateStoryResult> {
    const gradeLevel = ageToGradeLevel(opts.childAge);
    const allowedWords = await this.vocabularyRag.retrieve({
      topic: opts.topic,
      learningGoal: opts.learningGoal,
      gradeLevel,
    });
    const maxRetries = parseInt(
      process.env['EVAL_MAX_RETRIES'] ?? String(EVAL_MAX_RETRIES_DEFAULT),
      10,
    );
    return this.runLoop({ opts, allowedWords, maxAttempts: maxRetries + 1 });
  }

  private async runLoop(ctx: LoopContext): Promise<GenerateStoryResult> {
    let feedback: string | undefined;
    for (let attempt = 1; attempt <= ctx.maxAttempts; attempt++) {
      const story = await this.generator.generateStory({
        ...ctx.opts,
        allowedWords: ctx.allowedWords,
        feedback,
      });
      const checks = await this.evaluator.evaluate({
        story,
        childAge: ctx.opts.childAge,
        learningGoal: ctx.opts.learningGoal,
        bookId: ctx.opts.bookId,
        allowedWords: ctx.allowedWords,
      });
      const eval_ = await this.writeEval(ctx.opts.bookId, checks, attempt);
      if (checks.passed) return { story, evalId: eval_.id, attempts: attempt };
      if (attempt < ctx.maxAttempts) {
        feedback = buildRegenerationFeedback(
          checks.outOfCorpus,
          checks.judgeResult,
          checks.structuralErrors,
        );
      }
    }
    throw new StoryGenerationFailedError(ctx.opts.bookId, ctx.maxAttempts);
  }

  private async writeEval(
    bookId: string,
    checks: EvalCheckResult,
    attempt: number,
  ): Promise<{ id: string }> {
    return this.prisma.storyEval.create({
      data: {
        bookId,
        judgeScores: checks.judgeResult.scores,
        judgeReasoning: checks.judgeResult.reasoning,
        finalScore: checks.computedFinalScore,
        vocabularyCompliance: checks.vocabularyCompliance,
        passed: checks.passed,
        attempt,
      },
      select: { id: true },
    });
  }
}
