import { buildStorySchema, StorySchema } from './story.schema';

const coverPage = (title: string): unknown => ({
  template: 'cover',
  text: null,
  title,
  illustrationPrompt: 'A girl with a cat',
});

describe('buildStorySchema cover title length gate — per band', () => {
  it('5-6: rejects a cover title longer than 60 chars', () => {
    const result = buildStorySchema('5-6').shape.pages.element.safeParse(coverPage('А'.repeat(61)));
    expect(result.success).toBe(false);
  });

  it('5-6: accepts a cover title at exactly 60 chars', () => {
    const result = buildStorySchema('5-6').shape.pages.element.safeParse(coverPage('А'.repeat(60)));
    expect(result.success).toBe(true);
  });

  it('3-4: rejects a cover title longer than 40 chars (would pass 5-6)', () => {
    const title = 'А'.repeat(50); // >40 (3-4) but <=60 (5-6)
    const result3to4 = buildStorySchema('3-4').shape.pages.element.safeParse(coverPage(title));
    expect(result3to4.success).toBe(false);

    const result5to6 = buildStorySchema('5-6').shape.pages.element.safeParse(coverPage(title));
    expect(result5to6.success).toBe(true);
  });
});

describe('StorySchema (default export) — unchanged for Fast Flow', () => {
  it('still enforces the 60-char 5-6 cover cap directly, with no ageBand argument', () => {
    const result = StorySchema.shape.pages.element.safeParse(coverPage('А'.repeat(61)));
    expect(result.success).toBe(false);
  });
});
