import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { OpenAIProvider } from '@ai-sdk/openai';
import {
  LearningGoalSafetySchema,
  type LearningGoalSafetyResult,
} from '../schemas/learning-goal-safety.schema';
import {
  LEARNING_GOAL_SAFETY_SYSTEM,
  buildLearningGoalSafetyPrompt,
} from '../prompts/learning-goal-safety.prompt';
import { createTelemetry } from '../telemetry';
import { GENERATION_MODEL } from '../ai.config';

@Injectable()
export class LearningGoalSafetyService {
  private readonly openai: OpenAIProvider;

  constructor(config: ConfigService) {
    this.openai = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
  }

  async check(text: string, userId: string): Promise<LearningGoalSafetyResult> {
    const { object } = await generateObject({
      model: this.openai(GENERATION_MODEL),
      schema: LearningGoalSafetySchema,
      system: LEARNING_GOAL_SAFETY_SYSTEM,
      prompt: buildLearningGoalSafetyPrompt(text),
      experimental_telemetry: createTelemetry('learning-goal-safety', { userId }),
    });
    return object;
  }
}
