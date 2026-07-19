import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { z } from 'zod';
import { buildStorySchema, buildStoryPlanSchema, type Story, type StoryPlan } from '../schemas';
import { ageToAgeBand, type AgeBand } from '../../pdf/page-templates/page-templates.config';
import { PLAN_SYSTEM_PROMPT, buildPlanPrompt } from '../prompts/plan.prompt';
import { buildProseSystemPrompt, buildProsePrompt } from '../prompts/prose.prompt';
import {
  CHARACTER_PROFILE_SYSTEM,
  buildCharacterProfilePrompt,
} from '../prompts/character-profile.prompt';
import { buildTitleSystem, buildTitlePrompt, isConcreteTitle } from '../prompts/title.prompt';
import type { StorySeeds } from '../prompts/story-generator.prompt';
import { createTelemetry } from '../telemetry';
import { PLAN_MODEL, PROSE_MODEL, GENERATION_MODEL } from '../ai.config';

const CharacterProfileSchema = z.object({ characterProfile: z.string() });
const TitleSchema = z.object({ title: z.string() });
const TITLE_MAX_ATTEMPTS = 3;

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
  seeds?: StorySeeds;
  feedback?: string;
  /** Override the model (e.g. for text-only A/B via eval:text). Defaults to STORY_MODEL. */
  model?: string;
}

/**
 * StoryGeneratorService — decomposed generation (ADR-0005): Plan → Prose → Title.
 *
 * The Plan phase resolves structure, arc, safe conflict and hero identity into a
 * StoryPlan; the Prose phase renders that plan into the target read-aloud
 * register; the Title phase names the finished story. AgeBand (#196) is derived
 * ONCE from `input.childAge` at the top of `generateStory` and threaded through
 * every phase that needs it — no phase re-derives it independently.
 */
@Injectable()
export class StoryGeneratorService {
  private readonly openai: OpenAIProvider;

  constructor(config: ConfigService) {
    this.openai = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
  }

  async generateStory(input: GenerateStoryInput): Promise<Story> {
    const ageBand = ageToAgeBand(input.childAge);
    const plan = await this.generatePlan(input);
    // Appearance is image-only: the Plan never sees it (so a hair-bow can't
    // become plot). We derive the visual characterProfile separately here and
    // override the plan's placeholder before the Prose phase carries it forward.
    if (input.protagonistMode === 'child' && input.appearance) {
      plan.characterProfile = await this.deriveCharacterProfile(input);
    }
    const story = await this.generateProse(plan, input, ageBand);
    // Title from the finished, concrete story — not the abstract plan (#232).
    const title = await this.deriveTitle(story, plan.heroName, input, ageBand);
    return this.applyTitle(story, title);
  }

  /**
   * Derive a concrete, playful title from the written story, regenerating while
   * the title names the learning value or matches a dull template. Falls back to
   * the last attempt after TITLE_MAX_ATTEMPTS (the concrete-title prompt makes
   * even the worst attempt better than the plan's value-naming default).
   */
  private async deriveTitle(
    story: Story,
    heroName: string,
    input: GenerateStoryInput,
    ageBand: AgeBand,
  ): Promise<string> {
    let candidate = story.title;
    for (let attempt = 0; attempt < TITLE_MAX_ATTEMPTS; attempt++) {
      const { object } = await generateObject({
        model: this.openai(input.model ?? PLAN_MODEL),
        schema: TitleSchema,
        system: buildTitleSystem(ageBand),
        prompt: buildTitlePrompt(heroName, story, input.topic),
        experimental_telemetry: createTelemetry('story-title', {
          childAge: input.childAge,
          topic: input.topic,
          bookId: input.bookId,
        }),
      });
      candidate = object.title.trim();
      if (isConcreteTitle(candidate, input.topic, ageBand)) return candidate;
    }
    return candidate;
  }

  /** Apply the derived title to both the book title and the cover page. */
  private applyTitle(story: Story, title: string): Story {
    return {
      ...story,
      title,
      pages: story.pages.map((p) => (p.template === 'cover' ? { ...p, title } : p)),
    };
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

  private async generateProse(
    plan: StoryPlan,
    input: GenerateStoryInput,
    ageBand: AgeBand,
  ): Promise<Story> {
    const { object } = await generateObject({
      model: this.openai(input.model ?? PROSE_MODEL),
      schema: buildStorySchema(ageBand),
      system: buildProseSystemPrompt(ageBand),
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
