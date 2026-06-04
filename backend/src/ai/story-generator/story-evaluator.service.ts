import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { JudgeSchema, computeFinalScore, type Story, type JudgeResult } from '../schemas';
import { JUDGE_SYSTEM_PROMPT, buildJudgePrompt } from '../prompts/judge.prompt';
import { validateBookPlan } from '../validators/book-plan.validator';
import { checkCompliance, checkLanguagePurity } from './vocabulary-compliance';
import { createTelemetry } from '../telemetry';
import { GENERATION_MODEL, EVAL_THRESHOLD_DEFAULT } from '../ai.config';

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
  private readonly openai = createOpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  async evaluate(input: EvaluateInput): Promise<EvalCheckResult> {
    const { story, childAge, learningGoal, bookId, corpusWords } = input;
    const structural = validateBookPlan(story.pages, childAge);
    const languagePurity = checkLanguagePurity(story);
    const compliance = checkCompliance(story, corpusWords);
    const judgeResult = await this.judgeStory({ story, childAge, learningGoal, bookId });
    const computedFinalScore = computeFinalScore(judgeResult.scores);
    const rawThreshold = parseFloat(process.env['EVAL_THRESHOLD'] ?? '');
    const evalThreshold = Number.isNaN(rawThreshold) ? EVAL_THRESHOLD_DEFAULT : rawThreshold;
    const passed =
      structural.passed &&
      languagePurity.passed &&
      compliance.passed &&
      computedFinalScore >= evalThreshold;

    if (!passed) {
      this.logger.warn(
        `Attempt failed: structural=${structural.passed} languagePurity=${languagePurity.passed} compliance=${compliance.score.toFixed(2)} judge=${computedFinalScore}`,
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
