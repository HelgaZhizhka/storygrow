import { validateBookPlan } from './book-plan.validator';
import { Page } from '../schemas/story.schema';

const makePage = (template: Page['template'], overrides: Partial<Page> = {}): Page => ({
  template,
  illustrationPrompt: 'A friendly bear in a forest',
  ...overrides,
});

const validPages: Page[] = [
  makePage('cover', { title: 'Мишка и дружба' }),
  makePage('image-top', { text: 'Жил-был медвежонок.' }),
  makePage('image-bottom', { text: 'Он нашёл нового друга.' }),
  makePage('image-left', { text: 'Вместе они играли весь день.' }),
  makePage('image-bottom', { text: 'Медвежонок понял ценность дружбы.' }),
  makePage('final', { text: 'Дружба — это главное.' }),
];

describe('validateBookPlan', () => {
  describe('structure rules', () => {
    it('passes a valid page sequence', () => {
      const result = validateBookPlan(validPages, 6);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('errors when first page is not cover', () => {
      const pages: Page[] = [makePage('image-top'), ...validPages.slice(1)];
      const result = validateBookPlan(pages, 6);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => /cover/i.test(e))).toBe(true);
    });

    it('errors when last page is not final', () => {
      const pages: Page[] = [...validPages.slice(0, -1), makePage('image-left')];
      const result = validateBookPlan(pages, 6);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => /final/i.test(e))).toBe(true);
    });

    it('errors when page list is empty', () => {
      const result = validateBookPlan([], 6);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toMatch(/empty/i);
    });
  });

  describe('maxChars validation', () => {
    it('errors when text exceeds template maxChars.text', () => {
      const longText = 'А'.repeat(121); // image-top allows 120
      const pages: Page[] = [
        validPages[0],
        makePage('image-top', { text: longText }),
        ...validPages.slice(2),
      ];
      const result = validateBookPlan(pages, 6);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => /120/.test(e))).toBe(true);
    });

    it('passes when text is exactly at the limit', () => {
      const exactText = 'А'.repeat(120); // image-top allows 120
      const pages: Page[] = [
        validPages[0],
        makePage('image-top', { text: exactText }),
        ...validPages.slice(2),
      ];
      const result = validateBookPlan(pages, 6);
      expect(result.passed).toBe(true);
    });

    it('errors when title exceeds template maxChars.title', () => {
      const longTitle = 'А'.repeat(61); // cover allows 60
      const pages: Page[] = [makePage('cover', { title: longTitle }), ...validPages.slice(1)];
      const result = validateBookPlan(pages, 6);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => /60/.test(e))).toBe(true);
    });

    it('ignores text check when template has no maxChars.text defined', () => {
      // cover has no maxChars.text — text field present but not limited
      const pages: Page[] = [
        makePage('cover', {
          title: 'Мишка',
          text: 'very long text that covers do not limit at all',
        }),
        ...validPages.slice(1),
      ];
      const result = validateBookPlan(pages, 6);
      expect(result.passed).toBe(true);
    });
  });

  describe('age suitability', () => {
    it('errors when template is not suitable for the child age', () => {
      // text-focus is only for ages 7–8; using it for age 5 is invalid
      const pages: Page[] = [
        validPages[0],
        makePage('text-focus', { text: 'Короткий текст.' }),
        ...validPages.slice(2),
      ];
      const result = validateBookPlan(pages, 5);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => /age/i.test(e))).toBe(true);
    });

    it('passes text-focus for age 7', () => {
      const pages: Page[] = [
        validPages[0],
        makePage('text-focus', { text: 'Короткий текст.' }),
        makePage('image-left', { text: 'Продолжение.' }),
        makePage('image-left', { text: 'Ещё страница.' }),
        makePage('image-left', { text: 'Финальная страница текста.' }),
        makePage('final', { text: 'Мораль истории.' }),
      ];
      const result = validateBookPlan(pages, 7);
      expect(result.errors.some((e) => /age/i.test(e))).toBe(false);
    });
  });

  describe('collects multiple errors', () => {
    it('reports all violations, not just the first', () => {
      const longText = 'А'.repeat(200); // exceeds image-top (120) and image-bottom (120)
      const pages: Page[] = [
        makePage('image-top', { text: longText }), // error: not cover + text too long
        makePage('image-bottom', { text: longText }), // error: text too long
        makePage('image-left', { text: 'ok' }),
        makePage('image-left', { text: 'ok' }),
        makePage('image-left', { text: 'ok' }),
        makePage('image-top', { text: 'ok' }), // error: last page not final
      ];
      const result = validateBookPlan(pages, 7);
      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('unknown template guard', () => {
    it('errors when a page has an unknown template name', () => {
      const pages = [
        makePage('cover', { title: 'Title' }),
        // force an unknown template via cast
        { template: 'nonexistent' as Page['template'], illustrationPrompt: 'x' },
        makePage('image-left', { text: 'text' }),
        makePage('image-left', { text: 'text' }),
        makePage('image-left', { text: 'text' }),
        makePage('final', { text: 'moral' }),
      ];
      const result = validateBookPlan(pages, 7);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => /nonexistent/.test(e))).toBe(true);
    });
  });
});
