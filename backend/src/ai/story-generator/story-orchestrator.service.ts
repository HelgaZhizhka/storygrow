import { Injectable } from '@nestjs/common';
import { startActiveObservation } from '@langfuse/tracing';
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
  protagonistMode: 'child' | 'observer';
  arcType: 'virtue' | 'flaw';
  gender?: string;
  appearance?: string;
}

export interface GenerateStoryResult {
  story: Story;
  evalId: string;
  attempts: number;
}

interface LoopContext {
  opts: GenerateStoryOptions;
  corpusWords: readonly string[];
  maxAttempts: number;
}

@Injectable()
export class StoryOrchestratorService {
  constructor(
    private readonly generator: StoryGeneratorService,
    private readonly evaluator: StoryEvaluatorService,
    private readonly vocabularyRag: VocabularyRagService,
    private readonly prisma: PrismaService,
  ) {}

  async generate(opts: GenerateStoryOptions): Promise<GenerateStoryResult> {
    return startActiveObservation(`story-generation`, async (span) => {
      span.update({
        input: { bookId: opts.bookId, childName: opts.childName, topic: opts.topic },
        metadata: { bookId: opts.bookId, childAge: opts.childAge, learningGoal: opts.learningGoal },
      });

      const gradeLevel = ageToGradeLevel(opts.childAge);
      // Phase 1: the lexicon is no longer constrained at generation time (the
      // allowed-words injection flattened prose). corpusWords still feeds the
      // informational vocabularyCompliance metric; it does not limit generation.
      const corpusWords = await this.vocabularyRag.listByGrade(gradeLevel);
      const rawRetries = parseInt(process.env['EVAL_MAX_RETRIES'] ?? '', 10);
      const maxRetries = Number.isNaN(rawRetries) ? EVAL_MAX_RETRIES_DEFAULT : rawRetries;
      const result = await this.runLoop({
        opts,
        corpusWords,
        maxAttempts: maxRetries + 1,
      });

      span.update({
        output: {
          attempts: result.attempts,
          evalId: result.evalId,
        },
      });

      return result;
    });
  }

  private async runLoop(ctx: LoopContext): Promise<GenerateStoryResult> {
    let feedback: string | undefined;
    for (let attempt = 1; attempt <= ctx.maxAttempts; attempt++) {
      const story = await this.generator.generateStory({
        ...ctx.opts,
        feedback,
      });
      const checks = await this.evaluator.evaluate({
        story,
        childAge: ctx.opts.childAge,
        learningGoal: ctx.opts.learningGoal,
        bookId: ctx.opts.bookId,
        corpusWords: ctx.corpusWords,
      });
      const eval_ = await this.writeEval(ctx.opts.bookId, checks, attempt);
      if (checks.passed) return { story, evalId: eval_.id, attempts: attempt };
      if (attempt < ctx.maxAttempts) {
        feedback = buildRegenerationFeedback(checks.judgeResult, checks.structuralErrors);
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
