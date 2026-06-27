import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { OpenAIProvider } from '@ai-sdk/openai';
import {
  JudgeSchema,
  computeFinalScore,
  passesGuardrails,
  type Story,
  type JudgeResult,
} from '../schemas';
import { JUDGE_SYSTEM_PROMPT, buildJudgePrompt } from '../prompts/judge.prompt';
import { validateBookPlan } from '../validators/book-plan.validator';
import { checkCompliance, checkLanguagePurity } from './vocabulary-compliance';
import { createTelemetry } from '../telemetry';
import { GENERATION_MODEL, EVAL_THRESHOLD_DEFAULT, GUARDRAIL_FLOOR_DEFAULT } from '../ai.config';

export interface EvaluateInput {
  story: Story;
  childAge: number;
  learningGoal: string;
  bookId: string;
  corpusWords: readonly string[];
}

export interface EvalCheckResult {
  passed: boolean;
  judgeResult: JudgeResult;
  computedFinalScore: number;
  outOfCorpus: readonly string[];
  structuralErrors: readonly string[];
  vocabularyCompliance: number;
}

@Injectable()
export class StoryEvaluatorService {
  private readonly logger = new Logger(StoryEvaluatorService.name);
  private readonly openai: OpenAIProvider;
  private readonly evalThreshold: number;

  constructor(config: ConfigService) {
    this.openai = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
    const raw = parseFloat(config.get<string>('EVAL_THRESHOLD') ?? '');
    this.evalThreshold = Number.isNaN(raw) ? EVAL_THRESHOLD_DEFAULT : raw;
  }

  async evaluate(input: EvaluateInput): Promise<EvalCheckResult> {
    const { story, childAge, learningGoal, bookId, corpusWords } = input;
    const structural = validateBookPlan(story.pages, childAge);
    const languagePurity = checkLanguagePurity(story);
    const compliance = checkCompliance(story, corpusWords);
    const judgeResult = await this.judgeStory({ story, childAge, learningGoal, bookId });
    // ADR-0005: craft (registerMatch) is gated on its own and is the headline
    // finalScore; guardrails are separate pass/fail gates. A high guardrail mean
    // can no longer mask flat or ornate prose.
    const computedFinalScore = computeFinalScore(judgeResult.scores);
    const craftPassed = computedFinalScore >= this.evalThreshold;
    const guardrailsPassed = passesGuardrails(judgeResult.scores, GUARDRAIL_FLOOR_DEFAULT);
    // Vocabulary compliance is a SOFT signal under the read-aloud model: still
    // computed, stored, and fed into regeneration feedback, but it no longer
    // hard-fails a book on its own. Hard gates: structure, language purity
    // (Russian-only), guardrail criteria, and the craft (registerMatch) score.
    const passed = structural.passed && languagePurity.passed && guardrailsPassed && craftPassed;

    if (!passed) {
      this.logger.warn(
        `Attempt failed: structural=${structural.passed} languagePurity=${languagePurity.passed} guardrails=${guardrailsPassed} registerMatch=${computedFinalScore} compliance=${compliance.score.toFixed(2)}`,
      );
    }

    return {
      passed,
      judgeResult,
      computedFinalScore,
      outOfCorpus: compliance.outOfCorpus,
      structuralErrors: [...structural.errors, ...languagePurity.errors],
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
      experimental_telemetry: createTelemetry('story-evaluator', {
        childAge,
        learningGoal,
        bookId,
      }),
    });
    return object;
  }
}
