import { PageSchema } from './story.schema';
import { PAGE_TEMPLATES } from '../../pdf/page-templates/page-templates.config';

const coverMax = PAGE_TEMPLATES.cover.maxChars.title ?? 60;

const coverPage = (title: string): unknown => ({
  template: 'cover',
  text: null,
  title,
  illustrationPrompt: 'A girl with a cat',
});

describe('PageSchema cover title length gate', () => {
  it('rejects a cover title longer than the template cap', () => {
    const result = PageSchema.safeParse(coverPage('А'.repeat(coverMax + 1)));
    expect(result.success).toBe(false);
  });

  it('accepts a cover title at the template cap', () => {
    const result = PageSchema.safeParse(coverPage('А'.repeat(coverMax)));
    expect(result.success).toBe(true);
  });
});
