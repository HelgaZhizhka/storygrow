import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { z } from 'zod';
import {
  buildProseSchema,
  buildStoryPlanSchema,
  type Story,
  type StoryPlan,
  renderAppearance,
  toStoryBible,
} from '../schemas';
import { ensureHeroGender, normalizeVisualBible } from '../validators';
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
  private readonly logger = new Logger(StoryGeneratorService.name);
  private readonly openai: OpenAIProvider;

  constructor(config: ConfigService) {
    this.openai = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
  }

  async generateStory(input: GenerateStoryInput): Promise<Story> {
    const ageBand = ageToAgeBand(input.childAge);
    const plan = await this.generatePlan(input);
    // The hero's look never comes from the model's free-text characterProfile
    // (#360): it is rendered from the structured appearance (no name, no prose)
    // or, in child mode with a parent-given appearance, derived in an isolated
    // step so a hair-bow can't become plot. Prose carries it forward verbatim.
    const heroLook = ensureHeroGender(plan.visualBible.hero.appearance, input.gender);
    plan.characterProfile =
      input.protagonistMode === 'child' && input.appearance
        ? await this.deriveCharacterProfile(input)
        : renderAppearance(heroLook);
    const prose = await this.generateProse(plan, input, ageBand);
    // Merge the Visual Bible + per-page scenes into the persisted Story in code
    // (#348) — the prose model is never asked to reproduce them.
    const story = this.mergeVisualBible(prose, plan, input.bookId);
    // Title from the finished, concrete story — not the abstract plan (#232).
    const title = await this.deriveTitle({ story, heroName: plan.heroName, input, ageBand });
    return this.applyTitle(story, title);
  }

  /**
   * Derive a concrete, playful title from the written story, regenerating while
   * the title names the learning value or matches a dull template. Falls back to
   * the last attempt after TITLE_MAX_ATTEMPTS (the concrete-title prompt makes
   * even the worst attempt better than the plan's value-naming default).
   */
  private async deriveTitle({
    story,
    heroName,
    input,
    ageBand,
  }: {
    story: Story;
    heroName: string;
    input: GenerateStoryInput;
    ageBand: AgeBand;
  }): Promise<string> {
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
    const { plan, repairs } = normalizeVisualBible(object);
    if (repairs > 0) {
      this.logger.warn(`Book ${input.bookId}: Visual Bible repaired (${repairs} fixes)`);
    }
    return plan;
  }

  /**
   * Merge the Plan's Visual Bible and per-page scenes into the persisted Story
   * (#348). The hero descriptor comes from `characterProfile` (the derived /
   * placeholder anchor) so one hero description drives text and image alike; the
   * photo path overrides it again at image time (#128). Pages align 1:1 with the
   * plan (Prose follows the plan exactly); a missing scene stays undefined.
   */
  private mergeVisualBible(story: Story, plan: StoryPlan, bookId: string): Story {
    if (story.pages.length !== plan.pages.length) {
      // Prose is instructed to follow the plan exactly; if it drifted, scenes
      // align by index and any trailing page falls back to the legacy prompt.
      this.logger.warn(
        `Book ${bookId}: prose emitted ${story.pages.length} pages, plan has ${plan.pages.length}; scenes align by index`,
      );
    }
    const visualBible = toStoryBible(plan.visualBible, plan.characterProfile);
    const pages = story.pages.map((page, i) => ({ ...page, scene: plan.pages[i]?.scene }));
    // The hero look is the plan's (rendered / derived) profile, set in code —
    // never the prose model's copy of it (#360).
    return { ...story, characterProfile: plan.characterProfile, visualBible, pages };
  }

  private async generateProse(
    plan: StoryPlan,
    input: GenerateStoryInput,
    ageBand: AgeBand,
  ): Promise<Story> {
    const { object } = await generateObject({
      model: this.openai(input.model ?? PROSE_MODEL),
      schema: buildProseSchema(ageBand),
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
