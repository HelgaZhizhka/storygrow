import { z } from 'zod';
import {
  PAGE_TEMPLATES,
  TEMPLATE_NAMES,
  type TemplateName,
} from '../../pdf/page-templates/page-templates.config';
import { DISCUSSION_QUESTIONS_COUNT, PAGES_MIN, PAGES_MAX } from '../ai.config';

// The cover is the only template with a title; its cap (single-sourced from the
// template config) is enforced here so the model cannot emit an over-length
// cover title that BookPlanValidator would later reject (structural=false).
const COVER_TITLE_MAX = PAGE_TEMPLATES.cover.maxChars.title ?? 60;

/**
 * PageSchema — one page in the book.
 *
 * `template` drives layout in the PDF renderer; `illustrationPrompt` goes to
 * DALL-E; `text` and `title` are validated against template.maxChars in
 * BookPlanValidator after generation.
 */
export const PageSchema = z.object({
  template: z.enum([...TEMPLATE_NAMES] as [TemplateName, ...TemplateName[]]),
  /** Narrative body text for this page. Null only for cover template. */
  text: z.string().min(1).nullable(),
  /** Title text — required for 'cover' template (≤ cover cap); null otherwise. */
  title: z.string().min(1).max(COVER_TITLE_MAX).nullable(),
  /** Detailed DALL-E prompt describing the illustration for this page. */
  illustrationPrompt: z.string().min(1),
});

export type Page = z.infer<typeof PageSchema>;

/**
 * StorySchema — full structured output of StoryGenerator.
 *
 * The narrative arc (setup → conflict → lesson → resolution) is encoded in
 * the order and template selection of `pages`, not as separate top-level
 * fields. The first page MUST use the 'cover' template; the last MUST use
 * the 'final' template. This is enforced by BookPlanValidator after generation.
 *
 * `discussionQuestions` are rendered on the 'final' page by the PDF renderer.
 */
export const StorySchema = z.object({
  /**
   * Book title — stored in the database and shown in the app UI.
   * The cover page has its own `pages[0].title` field for display (max 60 chars).
   * These may differ: the book title can be longer; the cover title is a concise
   * display version. Both are validated independently.
   */
  title: z.string().min(1).max(120),

  /**
   * Visual description of the protagonist in English for DALL-E.
   * Generated once and prepended to every illustrationPrompt to maintain
   * character consistency across all pages.
   * Example: "5-year-old girl with brown curly hair, blue eyes, red dress"
   */
  characterProfile: z.string().min(1).max(120),

  /**
   * Exactly five open-ended questions for parent–child discussion.
   * Rendered on the final page alongside the moral.
   */
  discussionQuestions: z.array(z.string().min(1)).length(DISCUSSION_QUESTIONS_COUNT),

  /**
   * Ordered list of pages composing the book.
   * Min 6 (cover + 4 content + final), max 12.
   * Cover-first and final-last structural constraints are enforced by BookPlanValidator,
   * not by this schema — Zod only validates shape and array length.
   */
  pages: z.array(PageSchema).min(PAGES_MIN).max(PAGES_MAX),
});

export type Story = z.infer<typeof StorySchema>;
