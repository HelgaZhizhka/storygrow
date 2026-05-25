import { z } from 'zod';

export const DISCUSSION_QUESTIONS_COUNT = 5;
export const ILLUSTRATION_PROMPTS_MIN = 3;
export const ILLUSTRATION_PROMPTS_MAX = 8;

/**
 * StorySchema — Zod schema for the structured AI-generated content of a Book.
 *
 * Enforces the pedagogical structure: setup → conflict → lesson → resolution,
 * five discussion questions, and N illustration prompts.
 *
 * This is the direct output contract of StoryGenerator and the input contract
 * of PDFRenderer. Keep it stable — downstream services depend on its shape.
 */
export const StorySchema = z.object({
  /** Book title, age-appropriate and related to the learning goal. */
  title: z.string().min(1).max(120),

  /** Opening scene — introduces the protagonist and setting. */
  setup: z.string().min(1),

  /** Problem or challenge the protagonist faces. */
  conflict: z.string().min(1),

  /** How the protagonist learns and applies the learning goal. */
  lesson: z.string().min(1),

  /** Resolution — how the story ends, reinforcing the lesson. */
  resolution: z.string().min(1),

  /**
   * Exactly five open-ended questions for parent–child discussion.
   * Rendered on the last page of the PDF.
   */
  discussionQuestions: z.array(z.string().min(1)).length(DISCUSSION_QUESTIONS_COUNT),

  /**
   * One detailed illustration prompt per page (min 3, max 8).
   * Passed to ImageGenerator (DALL-E 3) in order.
   */
  illustrationPrompts: z
    .array(z.string().min(1))
    .min(ILLUSTRATION_PROMPTS_MIN)
    .max(ILLUSTRATION_PROMPTS_MAX),
});

export type Story = z.infer<typeof StorySchema>;
