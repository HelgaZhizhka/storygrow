import { z } from 'zod';
import {
  PAGE_TEMPLATES,
  TEMPLATE_NAMES,
  type AgeBand,
  type TemplateName,
} from '../../pdf/page-templates/page-templates.config';
import { DISCUSSION_QUESTIONS_COUNT, PAGE_COUNT_BY_BAND } from '../ai.config';

/**
 * PageSchema — one page in the book. `title`'s length is NOT capped here —
 * the cap is age-band-dependent (only the cover template has a title, and its
 * cap differs 3-4 vs 5-6) and is applied per-request by `buildStorySchema`,
 * mirroring how `buildStoryPlanSchema` narrows `PlanPageSchema`'s template enum.
 *
 * `template` drives layout in the PDF renderer; `illustrationPrompt` goes to
 * the image generator; `text` and `title` are ALSO checked against
 * template.maxChars in BookPlanValidator after generation (belt-and-braces).
 */
export const PageSchema = z.object({
  template: z.enum([...TEMPLATE_NAMES] as [TemplateName, ...TemplateName[]]),
  /** Narrative body text for this page. Null only for cover template. */
  text: z.string().min(1).nullable(),
  /** Title text — required for 'cover' template; null for all other templates. */
  title: z.string().min(1).nullable(),
  /** Detailed illustration-generator prompt describing the visual scene. */
  illustrationPrompt: z.string().min(1),
});

export type Page = z.infer<typeof PageSchema>;

/**
 * baseStorySchema — the shape shared by every band, WITHOUT a page-count or
 * cover-title-length constraint (those are band-dependent, applied by
 * `buildStorySchema` below). Not exported: nothing should validate against
 * this directly, only against a band-narrowed result.
 */
const baseStorySchema = z.object({
  /**
   * Book title — stored in the database and shown in the app UI.
   * The cover page has its own `pages[0].title` field for display.
   * These may differ: the book title can be longer; the cover title is a concise
   * display version. Both are validated independently.
   */
  title: z.string().min(1).max(120),

  /**
   * Visual description of the protagonist in English for the image generator.
   * Generated once and prepended to every illustrationPrompt to maintain
   * character consistency across all pages.
   */
  characterProfile: z.string().min(1).max(120),

  /**
   * Exactly five open-ended questions for parent–child discussion.
   * Rendered on the final page alongside the moral.
   */
  discussionQuestions: z.array(z.string().min(1)).length(DISCUSSION_QUESTIONS_COUNT),

  pages: z.array(PageSchema),
});

/**
 * Age-band-constrained story schema (#196) — narrows the cover title's max
 * length and the page-count bounds to the given band, so the model cannot
 * emit an over-length 3-4 cover title or a 5-6-length 3-4 book. Cover-first
 * and final-last structural constraints are enforced downstream by
 * BookPlanValidator, not by this schema.
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
 * StorySchema — the 5-6-band story schema, kept as a stable named export
 * specifically because Fast Flow (`fast-flow.service.ts`) imports it directly
 * and is explicitly OUT OF SCOPE for AgeBand awareness (#196) — its templates
 * aren't age-filtered and it was never designed with per-band caps. This is
 * NOT a separate/uncapped schema: it IS `buildStorySchema('5-6')`, so Fast
 * Flow's validation behaviour is byte-for-byte unchanged by this refactor
 * (still exactly a 60-char cover cap, 6-12 pages).
 */
export const StorySchema = buildStorySchema('5-6');

export type Story = z.infer<typeof StorySchema>;
