import { z } from 'zod';
import {
  PAGE_TEMPLATES,
  TEMPLATE_NAMES,
  type AgeBand,
  type TemplateName,
} from '../../pdf/page-templates/page-templates.config';
import { DESCRIPTOR_MAX_CHARS, DISCUSSION_QUESTIONS_COUNT, PAGE_COUNT_BY_BAND } from '../ai.config';
import { SceneSchema, VisualBibleSchema } from './visual-bible.schema';

/**
 * ProsePageSchema — one page AS EMITTED BY THE PROSE PHASE. It carries no visual
 * bible / scene: those are decided in the Plan and merged into the persisted
 * Story in code (#348), never re-emitted by the prose LLM.
 *
 * `template` drives layout in the PDF renderer; `illustrationPrompt` is the
 * page's ACTION (what the characters do) — appearance and place are added from
 * the Visual Bible downstream; `text` and `title` are ALSO checked against
 * template.maxChars in BookPlanValidator after generation (belt-and-braces).
 */
export const ProsePageSchema = z.object({
  template: z.enum([...TEMPLATE_NAMES] as [TemplateName, ...TemplateName[]]),
  /** Narrative body text for this page. Null only for cover template. */
  text: z.string().min(1).nullable(),
  /** Title text — required for 'cover' template; null for all other templates. */
  title: z.string().min(1).nullable(),
  /**
   * The page's ACTION in English — what the hero and any cast are doing, poses
   * and expressions, one composition hint. NOT appearance or place (those are
   * fixed in the Visual Bible and added by the illustration-prompt assembler).
   */
  illustrationPrompt: z.string().min(1),
});

/**
 * PageSchema — one page in the PERSISTED Story. Adds the optional `scene` (the
 * bible selection merged in after Prose). Optional so pre-#348 books and Fast
 * Flow stories, which have no scene, still parse.
 */
export const PageSchema = ProsePageSchema.extend({ scene: SceneSchema.optional() });

export type Page = z.infer<typeof PageSchema>;

/**
 * baseProseSchema — the book shape the Prose phase emits: no visualBible. Used to
 * build the `generateObject` output schema so the prose model is never asked to
 * reproduce the bible.
 */
const baseProseSchema = z.object({
  /**
   * Book title — stored in the database and shown in the app UI.
   * The cover page has its own `pages[0].title` field for display.
   */
  title: z.string().min(1).max(120),

  /**
   * Visual description of the protagonist in English for the image generator,
   * kept as the existing consistency anchor and the photo-flow discriminator.
   */
  characterProfile: z.string().min(1).max(DESCRIPTOR_MAX_CHARS),

  /** Exactly five open-ended questions for parent–child discussion. */
  discussionQuestions: z.array(z.string().min(1)).length(DISCUSSION_QUESTIONS_COUNT),

  pages: z.array(ProsePageSchema),
});

/**
 * baseStorySchema — the PERSISTED story: prose output plus the optional Visual
 * Bible and per-page scenes merged in from the Plan (#348). The bible/scene are
 * optional so a story generated before #348 (or by Fast Flow) still validates.
 */
const baseStorySchema = baseProseSchema.extend({
  pages: z.array(PageSchema),
  visualBible: VisualBibleSchema.optional(),
});

/**
 * buildProseSchema — age-band-narrowed schema handed to the Prose phase's
 * `generateObject` (cover-title cap + page-count bounds per band). Emits NO
 * bible/scene.
 */
export const buildProseSchema = (ageBand: AgeBand): typeof baseProseSchema => {
  const coverTitleMax = PAGE_TEMPLATES.cover.maxChars[ageBand].title ?? 60;
  const { min, max } = PAGE_COUNT_BY_BAND[ageBand];
  return baseProseSchema.extend({
    pages: z
      .array(ProsePageSchema.extend({ title: z.string().min(1).max(coverTitleMax).nullable() }))
      .min(min)
      .max(max),
  });
};

/**
 * buildStorySchema — age-band-narrowed schema for the PERSISTED story (prose
 * caps + optional bible/scene). This is the contract the image generator and PDF
 * renderer read; Fast Flow imports `StorySchema` (the 5-6 result) directly.
 */
export const buildStorySchema = (ageBand: AgeBand): typeof baseStorySchema => {
  const coverTitleMax = PAGE_TEMPLATES.cover.maxChars[ageBand].title ?? 60;
  const { min, max } = PAGE_COUNT_BY_BAND[ageBand];
  return baseStorySchema.extend({
    pages: z
      .array(PageSchema.extend({ title: z.string().min(1).max(coverTitleMax).nullable() }))
      .min(min)
      .max(max),
  });
};

/**
 * StorySchema — the 5-6-band persisted story schema, kept as a stable named
 * export because Fast Flow imports it directly and is OUT OF SCOPE for AgeBand
 * awareness (#196). Fast Flow stories simply carry no visualBible/scene.
 */
export const StorySchema = buildStorySchema('5-6');

export type Story = z.infer<typeof StorySchema>;
