import { z } from 'zod';

/**
 * WholeStory — the author's output in the whole-story text pipeline (ADR-0008,
 * spec 2026-09-23 §4 stage 2). One tale as natural paragraphs; the author is
 * given NO layout constraint, so there is deliberately no per-paragraph cap
 * here — length is gated on the whole text (word range per band), and pages
 * are derived later by a split that never re-emits the text.
 *
 * Used by the STO-15 research harness (`eval:whole-story`); not wired into the
 * production generator yet.
 */
export const WholeStorySchema = z.object({
  title: z.string().min(1).max(120).describe('Название сказки, по-русски.'),
  paragraphs: z
    .array(z.string().min(1))
    .min(3)
    .describe(
      'Абзацы сказки по порядку. Реплика диалога может быть отдельным абзацем. Только текст сказки: без страниц, вопросов и пояснений.',
    ),
});

export type WholeStory = z.infer<typeof WholeStorySchema>;

/** The tale as one string — the declared joiner the page split must reconstruct against. */
export const WHOLE_TEXT_JOINER = '\n\n';

export const wholeText = (story: Pick<WholeStory, 'paragraphs'>): string =>
  story.paragraphs.join(WHOLE_TEXT_JOINER);
