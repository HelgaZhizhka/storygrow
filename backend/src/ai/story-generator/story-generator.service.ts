import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { StorySchema, type Story } from '../schemas';
import { STORY_SYSTEM_PROMPT, buildStoryUserPrompt } from '../prompts/story-generator.prompt';
import { createTelemetry } from '../telemetry';
import { GENERATION_MODEL } from '../ai.config';

export interface GenerateStoryInput {
  childName: string;
  childAge: number;
  topic: string;
  learningGoal: string;
  bookId: string;
  allowedWords: readonly string[];
  feedback?: string;
}

@Injectable()
export class StoryGeneratorService {
  private readonly openai: OpenAIProvider;

  constructor(config: ConfigService) {
    this.openai = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
  }

  async generateStory(input: GenerateStoryInput): Promise<Story> {
    const { object } = await generateObject({
      model: this.openai(GENERATION_MODEL),
      schema: StorySchema,
      system: STORY_SYSTEM_PROMPT,
      prompt: buildStoryUserPrompt(input),
      experimental_telemetry: createTelemetry('story-generator', {
        childAge: input.childAge,
        topic: input.topic,
        bookId: input.bookId,
      }),
    });
    return object;
  }
}
