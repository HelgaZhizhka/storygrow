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
  template: z
    .enum([...TEMPLATE_NAMES] as [TemplateName, ...TemplateName[]])
    .describe('The template of this page — exactly as in the plan.'),
  text: z
    .string()
    .min(1)
    .nullable()
    .describe('Russian read-aloud body text for this page; null only on the cover.'),
  title: z.string().min(1).nullable().describe('Cover title (short); null on every other page.'),
  illustrationPrompt: z
    .string()
    .min(1)
    .describe(
      'The page ACTION in English: what "the child" and any listed characters are doing, poses, one composition hint. No appearance, no place, no name.',
    ),
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
  title: z.string().min(1).max(120).describe("Book title, Russian — the plan's title verbatim."),

  /**
   * Visual description of the protagonist in English for the image generator,
   * kept as the existing consistency anchor and the photo-flow discriminator.
   * Set in code from the Plan; the Prose output schema omits it.
   */
  characterProfile: z.string().min(1).max(DESCRIPTOR_MAX_CHARS),

  discussionQuestions: z
    .array(z.string().min(1))
    .length(DISCUSSION_QUESTIONS_COUNT)
    .describe("The plan's five discussion questions, verbatim."),

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
// The hero's look is set in code from the Plan (#363/#367); the Prose model
// neither sees nor echoes it.
const proseOutputSchema = baseProseSchema.omit({ characterProfile: true });
export type ProseOutput = z.infer<typeof proseOutputSchema>;

/**
 * The Plan owns the page count (#378): Prose must return exactly `pageCount`
 * pages, so scenes never have to be aligned by index or fall back.
 */
export const buildProseSchema = (ageBand: AgeBand, pageCount: number): typeof proseOutputSchema => {
  const coverTitleMax = PAGE_TEMPLATES.cover.maxChars[ageBand].title ?? 60;
  return proseOutputSchema.extend({
    pages: z
      .array(ProsePageSchema.extend({ title: z.string().min(1).max(coverTitleMax).nullable() }))
      .length(pageCount),
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
