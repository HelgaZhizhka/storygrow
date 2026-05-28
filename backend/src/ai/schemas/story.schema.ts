import { z } from 'zod';
import { TEMPLATE_NAMES, type TemplateName } from '../../pdf/page-templates/page-templates.config';

export const DISCUSSION_QUESTIONS_COUNT = 5;
export const PAGES_MIN = 6;
export const PAGES_MAX = 12;

/**
 * PageSchema — one page in the book.
 *
 * `template` drives layout in the PDF renderer; `illustrationPrompt` goes to
 * DALL-E; `text` and `title` are validated against template.maxChars in
 * BookPlanValidator after generation.
 */
export const PageSchema = z.object({
  template: z.enum([...TEMPLATE_NAMES] as [TemplateName, ...TemplateName[]]),
  /** Narrative body text for this page. Required for all non-cover templates. */
  text: z.string().optional(),
  /** Title text — required for 'cover', unused on most other templates. */
  title: z.string().optional(),
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
  /** Book title — also used as the cover page title. */
  title: z.string().min(1).max(120),

  /**
   * Exactly five open-ended questions for parent–child discussion.
   * Rendered on the final page alongside the moral.
   */
  discussionQuestions: z.array(z.string().min(1)).length(DISCUSSION_QUESTIONS_COUNT),

  /**
   * Ordered list of pages composing the book.
   * Min 6 (cover + 4 content + final), max 12.
   */
  pages: z.array(PageSchema).min(PAGES_MIN).max(PAGES_MAX),
});

export type Story = z.infer<typeof StorySchema>;
