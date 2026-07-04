import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { z } from 'zod';
import { StorySchema, buildStoryPlanSchema, type Story, type StoryPlan } from '../schemas';
import { PLAN_SYSTEM_PROMPT, buildPlanPrompt } from '../prompts/plan.prompt';
import { PROSE_SYSTEM_PROMPT, buildProsePrompt } from '../prompts/prose.prompt';
import {
  CHARACTER_PROFILE_SYSTEM,
  buildCharacterProfilePrompt,
} from '../prompts/character-profile.prompt';
import { createTelemetry } from '../telemetry';
import { PLAN_MODEL, PROSE_MODEL, GENERATION_MODEL } from '../ai.config';

const CharacterProfileSchema = z.object({ characterProfile: z.string() });

export interface GenerateStoryInput {
  childName: string;
  childAge: number;
  topic: string;
  learningGoal: string;
  bookId: string;
  protagonistMode: 'child' | 'observer';
  arcType: 'virtue' | 'flaw';
  gender?: string;
  appearance?: string;
  feedback?: string;
  /** Override the model (e.g. for text-only A/B via eval:text). Defaults to STORY_MODEL. */
  model?: string;
}

/**
 * StoryGeneratorService — decomposed generation (ADR-0005): Plan → Prose.
 *
 * The Plan phase resolves structure, arc, safe conflict and hero identity into a
 * StoryPlan; the Prose phase renders that plan into the target read-aloud
 * register. Splitting the work by concern removes the single-call overload that
 * flattened the prose. Both calls are traced separately in LangFuse.
 */
@Injectable()
export class StoryGeneratorService {
  private readonly openai: OpenAIProvider;

  constructor(config: ConfigService) {
    this.openai = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
  }

  async generateStory(input: GenerateStoryInput): Promise<Story> {
    const plan = await this.generatePlan(input);
    // Appearance is image-only: the Plan never sees it (so a hair-bow can't
    // become plot). We derive the visual characterProfile separately here and
    // override the plan's placeholder before the Prose phase carries it forward.
    if (input.protagonistMode === 'child' && input.appearance) {
      plan.characterProfile = await this.deriveCharacterProfile(input);
    }
    return this.generateProse(plan, input);
  }

  private async deriveCharacterProfile(input: GenerateStoryInput): Promise<string> {
    const { object } = await generateObject({
      model: this.openai(GENERATION_MODEL),
      schema: CharacterProfileSchema,
      system: CHARACTER_PROFILE_SYSTEM,
      prompt: buildCharacterProfilePrompt(input.appearance ?? '', input.childAge, input.gender),
      experimental_telemetry: createTelemetry('character-profile', {
        childAge: input.childAge,
        bookId: input.bookId,
      }),
    });
    return object.characterProfile;
  }

  private async generatePlan(input: GenerateStoryInput): Promise<StoryPlan> {
    const { object } = await generateObject({
      model: this.openai(input.model ?? PLAN_MODEL),
      schema: buildStoryPlanSchema(input.childAge),
      system: PLAN_SYSTEM_PROMPT,
      prompt: buildPlanPrompt(input),
      experimental_telemetry: createTelemetry('story-planner', {
        childAge: input.childAge,
        topic: input.topic,
        bookId: input.bookId,
      }),
    });
    return object;
  }

  private async generateProse(plan: StoryPlan, input: GenerateStoryInput): Promise<Story> {
    const { object } = await generateObject({
      model: this.openai(input.model ?? PROSE_MODEL),
      schema: StorySchema,
      system: PROSE_SYSTEM_PROMPT,
      prompt: buildProsePrompt(plan, input),
      experimental_telemetry: createTelemetry('story-prose', {
        childAge: input.childAge,
        topic: input.topic,
        bookId: input.bookId,
      }),
    });
    return object;
  }
}
