import { Page } from '../../ai/schemas/story.schema';
import { PAGE_TEMPLATES } from './page-templates.config';

export interface ValidationError {
  pageIndex: number;
  field: 'text' | 'title' | 'template';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

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
export const validateBookPlan = (pages: Page[], childAge: number): ValidationResult => {
  const errors: ValidationError[] = [];

  if (pages.length === 0) {
    return {
      valid: false,
      errors: [{ pageIndex: 0, field: 'template', message: 'Page list is empty' }],
    };
  }

  if (pages[0].template !== 'cover') {
    errors.push({
      pageIndex: 0,
      field: 'template',
      message: `First page must use the 'cover' template, got '${pages[0].template}'`,
    });
  }

  const lastIndex = pages.length - 1;
  if (pages[lastIndex].template !== 'final') {
    errors.push({
      pageIndex: lastIndex,
      field: 'template',
      message: `Last page must use the 'final' template, got '${pages[lastIndex].template}'`,
    });
  }

  pages.forEach((page, index) => {
    const config = PAGE_TEMPLATES[page.template];

    if (!config.suitableFor.includes(childAge)) {
      errors.push({
        pageIndex: index,
        field: 'template',
        message: `Template '${page.template}' is not suitable for age ${childAge} (suitable for ages: ${config.suitableFor.join(', ')})`,
      });
    }

    if (page.text !== undefined && config.maxChars.text !== undefined) {
      if (page.text.length > config.maxChars.text) {
        errors.push({
          pageIndex: index,
          field: 'text',
          message: `Text on page ${index} is ${page.text.length} chars; template '${page.template}' allows ${config.maxChars.text}`,
        });
      }
    }

    if (page.title !== undefined && config.maxChars.title !== undefined) {
      if (page.title.length > config.maxChars.title) {
        errors.push({
          pageIndex: index,
          field: 'title',
          message: `Title on page ${index} is ${page.title.length} chars; template '${page.template}' allows ${config.maxChars.title}`,
        });
      }
    }
  });

  return { valid: errors.length === 0, errors };
};
