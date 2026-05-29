import { Page } from '../schemas/story.schema';
import { PAGE_TEMPLATES } from '../../pdf/page-templates/page-templates.config';
import { CheckResult } from './check-result';

/**
 * validateBookPlan — deterministic post-generation validator.
 *
 * Checks every page in the LLM's output against the template catalogue:
 * - Structure: first page must be 'cover', last must be 'final'.
 * - Text length: `text` and `title` must not exceed the template's maxChars.
 * - Age suitability: template must be in the suitableFor list for this child.
 *
 * Returns all errors, not just the first — the caller uses this to build
 * regeneration feedback that fixes all violations at once.
 */
export const validateBookPlan = (pages: Page[], childAge: number): CheckResult => {
  const errors: string[] = [];

  if (pages.length === 0) {
    return { passed: false, errors: ['Page list is empty'] };
  }

  if (pages[0].template !== 'cover') {
    errors.push(`First page must use the 'cover' template, got '${pages[0].template}'`);
  }

  const lastIndex = pages.length - 1;
  if (pages[lastIndex].template !== 'final') {
    errors.push(`Last page must use the 'final' template, got '${pages[lastIndex].template}'`);
  }

  pages.forEach((page, index) => {
    const config = PAGE_TEMPLATES[page.template];
    if (!config) {
      errors.push(`[page:${index}] Unknown template '${page.template}'`);
      return;
    }

    if (!config.suitableFor.includes(childAge)) {
      errors.push(
        `[page:${index}] Template '${page.template}' is not suitable for age ${childAge} (suitable for ages: ${config.suitableFor.join(', ')})`,
      );
    }

    if (page.text != null && config.maxChars.text !== undefined) {
      if (page.text.length > config.maxChars.text) {
        errors.push(
          `[page:${index}] Text is ${page.text.length} chars; template '${page.template}' allows ${config.maxChars.text}`,
        );
      }
    }

    if (page.title != null && config.maxChars.title !== undefined) {
      if (page.title.length > config.maxChars.title) {
        errors.push(
          `[page:${index}] Title is ${page.title.length} chars; template '${page.template}' allows ${config.maxChars.title}`,
        );
      }
    }
  });

  return { passed: errors.length === 0, errors };
};
