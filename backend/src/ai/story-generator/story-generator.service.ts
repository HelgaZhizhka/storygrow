import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import {
  StorySchema,
  JudgeSchema,
  computeFinalScore,
  type Story,
  type JudgeResult,
} from '../schemas';
import {
  STORY_SYSTEM_PROMPT,
  buildStoryUserPrompt,
  buildRegenerationFeedback,
} from '../prompts/story-generator.prompt';
import { JUDGE_SYSTEM_PROMPT, buildJudgePrompt } from '../prompts/judge.prompt';
import { VocabularyRagService } from '../rag/vocabulary-rag.service';
import { ageToGradeLevel } from '../rag/age-grade.map';
import { PrismaService } from '../../prisma/prisma.service';
import {
  validateBookPlan,
  type ValidationResult,
} from '../../pdf/page-templates/book-plan.validator';
import { checkCompliance, type ComplianceResult } from './vocabulary-compliance';
import { StoryGenerationFailedError } from './errors';

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

interface PostCheckResult {
  passed: boolean;
  judgeResult: JudgeResult;
  computedFinalScore: number;
  outOfCorpus: readonly string[];
  structuralErrors: readonly string[];
  vocabularyCompliance: number;
}

interface LoopContext {
  opts: GenerateStoryOptions;
  allowedWords: readonly string[];
  maxAttempts: number;
}

const GENERATION_MODEL = 'gpt-4o-mini';

@Injectable()
export class StoryGeneratorService {
  private readonly logger = new Logger(StoryGeneratorService.name);
  private readonly openai = createOpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  constructor(
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
    const maxRetries = parseInt(process.env['EVAL_MAX_RETRIES'] ?? '2', 10);
    return this.runLoop({ opts, allowedWords, maxAttempts: maxRetries + 1 });
  }

  private async runLoop(ctx: LoopContext): Promise<GenerateStoryResult> {
    let feedback: string | undefined;
    for (let attempt = 1; attempt <= ctx.maxAttempts; attempt++) {
      const story = await this.generateStory(ctx.opts, ctx.allowedWords, feedback);
      const checks = await this.runPostChecks(story, ctx.opts, ctx.allowedWords);
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

  private async generateStory(
    opts: GenerateStoryOptions,
    allowedWords: readonly string[],
    feedback?: string,
  ): Promise<Story> {
    const { object } = await generateObject({
      model: this.openai(GENERATION_MODEL),
      schema: StorySchema,
      system: STORY_SYSTEM_PROMPT,
      prompt: buildStoryUserPrompt({ ...opts, allowedWords, feedback }),
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'story-generator',
        metadata: { childAge: opts.childAge, topic: opts.topic, bookId: opts.bookId },
      },
    });
    return object;
  }

  private async runPostChecks(
    story: Story,
    opts: GenerateStoryOptions,
    allowedWords: readonly string[],
  ): Promise<PostCheckResult> {
    const validation: ValidationResult = validateBookPlan(story.pages, opts.childAge);
    const compliance: ComplianceResult = checkCompliance(story, allowedWords);
    const judgeResult = await this.judgeStory({
      story,
      childAge: opts.childAge,
      learningGoal: opts.learningGoal,
      bookId: opts.bookId,
    });
    const computedFinalScore = computeFinalScore(judgeResult.scores);
    const evalThreshold = parseFloat(process.env['EVAL_THRESHOLD'] ?? '7.0');
    const passed = validation.valid && compliance.compliant && computedFinalScore >= evalThreshold;
    if (!passed) {
      this.logger.warn(
        `Attempt failed: structural=${validation.valid} compliance=${compliance.score.toFixed(2)} judge=${computedFinalScore}`,
      );
    }
    return {
      passed,
      judgeResult,
      computedFinalScore,
      outOfCorpus: compliance.outOfCorpus,
      structuralErrors: validation.errors.map((e) => e.message),
      vocabularyCompliance: compliance.score,
    };
  }

  private async judgeStory({
    story,
    childAge,
    learningGoal,
    bookId,
  }: {
    story: Story;
    childAge: number;
    learningGoal: string;
    bookId: string;
  }): Promise<JudgeResult> {
    const { object } = await generateObject({
      model: this.openai(GENERATION_MODEL),
      schema: JudgeSchema,
      system: JUDGE_SYSTEM_PROMPT,
      prompt: buildJudgePrompt(story, childAge, learningGoal),
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'story-evaluator',
        metadata: { childAge, learningGoal, bookId },
      },
    });
    return object;
  }

  private async writeEval(
    bookId: string,
    checks: PostCheckResult,
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
