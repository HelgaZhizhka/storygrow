import { Injectable, Logger } from '@nestjs/common';
import { startActiveObservation } from '@langfuse/tracing';
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
  type ProseOutput,
  AppearanceSchema,
  heroKind,
  type Appearance,
  impliedNounsAdded,
} from '../schemas';
import { normalizeVisualBible } from '../validators';
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
    // ONE source for the hero's look (#376): a structured Appearance resolved
    // here, written back into the bible and rendered into characterProfile, so
    // the portrait, every page prompt and the judge read the same words.
    const appearance = await this.resolveHeroAppearance(plan, input);
    plan.visualBible.hero.appearance = appearance;
    plan.characterProfile = renderAppearance(appearance);
    // Canary (#378): nouns the renderer had to add because the model dropped
    // them; should fall to zero now that the schema fields carry descriptions.
    const implied = impliedNounsAdded(appearance);
    if (implied > 0)
      this.logger.log(`Book ${input.bookId}: renderAppearance added ${implied} implied noun(s)`);
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

  // Child mode: the parent's description (when given) wins over the Plan's
  // invented look, and `kind` comes from age + gender the input already knows.
  // Observer mode: the Plan invented the hero, its look stands as is.
  private async resolveHeroAppearance(
    plan: StoryPlan,
    input: GenerateStoryInput,
  ): Promise<Appearance> {
    if (input.protagonistMode !== 'child') return plan.visualBible.hero.appearance;
    const base = input.appearance
      ? await this.deriveAppearance(input)
      : plan.visualBible.hero.appearance;
    return { ...base, kind: heroKind(input.childAge, input.gender) };
  }

  private async deriveAppearance(input: GenerateStoryInput): Promise<Appearance> {
    const { object } = await generateObject({
      model: this.openai(GENERATION_MODEL),
      schema: AppearanceSchema,
      system: CHARACTER_PROFILE_SYSTEM,
      prompt: buildCharacterProfilePrompt(input.appearance ?? '', input.childAge, input.gender),
      experimental_telemetry: createTelemetry('character-profile', {
        childAge: input.childAge,
        bookId: input.bookId,
      }),
    });
    return object;
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
    const { plan, repairs, repairKinds } = normalizeVisualBible(object);
    // Measured by kind (#378): each kind is a contract gap in the Plan output
    // worth closing at the schema, not papering over silently.
    await startActiveObservation('story-plan.normalize', (span) => {
      span.update({ metadata: { bookId: input.bookId }, output: { repairs, ...repairKinds } });
      return Promise.resolve();
    });
    if (repairs > 0) {
      this.logger.warn(
        `Book ${input.bookId}: Visual Bible repaired (${repairs}): ${JSON.stringify(repairKinds)}`,
      );
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
  private mergeVisualBible(story: ProseOutput, plan: StoryPlan, bookId: string): Story {
    const visualBible = toStoryBible(plan.visualBible, plan.characterProfile);
    // The schema fixes the page count to the plan's (#378); a page whose
    // template differs from the plan gets NO scene, and the structural check
    // turns that into a regeneration with feedback instead of a silent misfit.
    const pages = story.pages.map((page, i) => {
      const planned = plan.pages[i];
      if (planned.template !== page.template) {
        this.logger.warn(
          `Book ${bookId}: page ${i + 1} template ${page.template} differs from the plan's ${planned.template}`,
        );
        return page;
      }
      return { ...page, scene: planned.scene };
    });
    // The hero look is the plan's (rendered / derived) profile, set in code —
    // never the prose model's copy of it (#360).
    return { ...story, characterProfile: plan.characterProfile, visualBible, pages };
  }

  private async generateProse(
    plan: StoryPlan,
    input: GenerateStoryInput,
    ageBand: AgeBand,
  ): Promise<ProseOutput> {
    const { object } = await generateObject({
      model: this.openai(input.model ?? PROSE_MODEL),
      schema: buildProseSchema(ageBand, plan.pages.length),
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
