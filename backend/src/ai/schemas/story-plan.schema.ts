import { z } from 'zod';
import {
  TEMPLATE_NAMES,
  ageToAgeBand,
  templatesForAge,
  type TemplateName,
} from '../../pdf/page-templates/page-templates.config';
import { DISCUSSION_QUESTIONS_COUNT, PAGE_COUNT_BY_BAND } from '../ai.config';

/**
 * StoryPlan — the first-class "bible" produced by the Plan phase (ADR-0005).
 *
 * It resolves everything EXCEPT the wording: hero identity (the consistency
 * anchor), the page layout (template + arc beat per page), what happens on each
 * page (intent — NOT the final sentence), the one-line lesson, and the
 * discussion questions. The Prose phase then renders each page's `intent` into
 * the target read-aloud register without having to invent structure, arc, or
 * safe conflict. Keeping voice and structure in separate calls is what removes
 * the single-call overload that flattened the prose.
 */

/** One planned page: layout + which beat it carries + what happens (not the wording). */
export const PlanPageSchema = z.object({
  template: z.enum([...TEMPLATE_NAMES] as [TemplateName, ...TemplateName[]]),
  /** Arc beat this page carries, e.g. "Завязка", "Расплата" (from the beat sheet). */
  beat: z.string().min(1),
  /**
   * What happens on this page, in Russian — content and emotional beat, NOT the
   * final sentence. The Prose phase turns this into the actual read-aloud text.
   * For the cover page, describe the scene the title sits on.
   */
  intent: z.string().min(1),
});

export type PlanPage = z.infer<typeof PlanPageSchema>;

export const StoryPlanSchema = z.object({
  /** Book title (Russian). Carried verbatim into the final Story. */
  title: z.string().min(1).max(120),

  /** The hero's name — fixed here so it can never drift across pages. */
  heroName: z.string().min(1),

  /**
   * English visual description of the protagonist (the image-consistency anchor),
   * prepended to every illustration prompt downstream. Carried into the Story.
   */
  characterProfile: z.string().min(1).max(120),

  /** One short Russian sentence — the moral, stated only on the final page. */
  lesson: z.string().min(1),

  /** Exactly five open-ended parent–child discussion questions (Russian). */
  discussionQuestions: z.array(z.string().min(1)).length(DISCUSSION_QUESTIONS_COUNT),

  /**
   * Ordered page layout: first page 'cover', last page 'final', content pages in
   * between carrying the arc beats in order. Templates must be age-appropriate.
   * Structural constraints are enforced downstream by BookPlanValidator.
   */
  pages: z
    .array(PlanPageSchema)
    .min(PAGE_COUNT_BY_BAND['5-6'].min)
    .max(PAGE_COUNT_BY_BAND['5-6'].max),
});

export type StoryPlan = z.infer<typeof StoryPlanSchema>;

/**
 * Age-constrained plan schema — restricts each page's `template` enum to the
 * templates pedagogically valid for `childAge`. Used by the Plan phase so the
 * model cannot emit an age-invalid template (e.g. `text-focus` for age 6),
 * which would otherwise fail BookPlanValidator with `structural=false`.
 *
 * Falls back to the full template set if the age has no dedicated templates
 * (z.enum requires a non-empty list); such ages are rejected upstream anyway.
 */
export const buildStoryPlanSchema = (childAge: number): typeof StoryPlanSchema => {
  const allowed = templatesForAge(childAge);
  const names = allowed.length > 0 ? allowed : [...TEMPLATE_NAMES];
  const templateEnum = z.enum(names as [TemplateName, ...TemplateName[]]);
  const { min, max } = PAGE_COUNT_BY_BAND[ageToAgeBand(childAge)];
  return StoryPlanSchema.extend({
    pages: z
      .array(PlanPageSchema.extend({ template: templateEnum }))
      .min(min)
      .max(max),
  });
};
