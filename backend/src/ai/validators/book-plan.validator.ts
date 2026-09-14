import { Page } from '../schemas/story.schema';
import { PAGE_TEMPLATES, ageToAgeBand } from '../../pdf/page-templates/page-templates.config';
import { CheckResult } from './check-result';

/**
 * validateBookPlan — deterministic post-generation validator.
 *
 * Checks every page in the LLM's output against the template catalogue:
 * - Structure: first page must be 'cover', last must be 'final'.
 * - Text length: `text` and `title` must not exceed the template's maxChars
 *   for the child's age band (#196).
 * - Age suitability: template must be in the suitableFor list for this child.
 *
 * Returns all errors, not just the first — the caller uses this to build
 * regeneration feedback that fixes all violations at once.
 */
export const validateBookPlan = (
  pages: Page[],
  childAge: number,
  opts: { expectScenes?: boolean } = {},
): CheckResult => {
  if (pages.length === 0) {
    return { passed: false, errors: ['Page list is empty'] };
  }
  const ageBand = ageToAgeBand(childAge);
  const errors = [
    ...structureErrors(pages, opts),
    ...pages.flatMap((page, index) => pageErrors(page, index, { childAge, ageBand })),
  ];

  return { passed: errors.length === 0, errors };
};

// #378: a story written against a Plan must carry the plan's scene on every
// page; a page without one means Prose changed the template the plan fixed.
const structureErrors = (pages: Page[], opts: { expectScenes?: boolean }): string[] => {
  const errors: string[] = [];
  if (opts.expectScenes) {
    pages.forEach((page, index) => {
      if (!page.scene)
        errors.push(
          `[page:${index}] does not follow the plan (template changed) — keep the plan's page order and templates`,
        );
    });
  }
  if (pages[0].template !== 'cover') {
    errors.push(`First page must use the 'cover' template, got '${pages[0].template}'`);
  }
  const last = pages[pages.length - 1];
  if (last.template !== 'final') {
    errors.push(`Last page must use the 'final' template, got '${last.template}'`);
  }
  return errors;
};

const pageErrors = (
  page: Page,
  index: number,
  child: { childAge: number; ageBand: ReturnType<typeof ageToAgeBand> },
): string[] => {
  const config = PAGE_TEMPLATES[page.template];
  if (!config) return [`[page:${index}] Unknown template '${page.template}'`];
  const errors: string[] = [];
  if (!config.suitableFor.includes(child.childAge)) {
    errors.push(
      `[page:${index}] Template '${page.template}' is not suitable for age ${child.childAge} (suitable for ages: ${config.suitableFor.join(', ')})`,
    );
  }
  const maxChars = config.maxChars[child.ageBand];
  if (page.text != null && maxChars.text !== undefined && page.text.length > maxChars.text) {
    errors.push(
      `[page:${index}] Text is ${page.text.length} chars; template '${page.template}' allows ${maxChars.text}`,
    );
  }
  if (page.title != null && maxChars.title !== undefined && page.title.length > maxChars.title) {
    errors.push(
      `[page:${index}] Title is ${page.title.length} chars; template '${page.template}' allows ${maxChars.title}`,
    );
  }
  return errors;
};
