import { checkCompliance, COMPLIANCE_THRESHOLD } from './vocabulary-compliance';
import type { Story } from '../schemas';

const coverPage = {
  template: 'cover' as const,
  title: 'Кот и мяч',
  illustrationPrompt: 'A cat with a ball, watercolour',
};
const finalPage = {
  template: 'final' as const,
  text: 'Кот научился дружить',
  illustrationPrompt: 'Cat smiling, watercolour',
};
const makeStory = (overrides: Partial<Story> = {}): Story => ({
  title: 'Кот и мяч',
  pages: [
    coverPage,
    { template: 'image-top', text: 'Кот прыгал', illustrationPrompt: 'Cat jumping' },
    finalPage,
  ],
  discussionQuestions: ['?', '?', '?', '?', '?'],
  ...overrides,
});

describe('checkCompliance', () => {
  it('returns score=1 and compliant=true when all meaningful tokens are in corpus', () => {
    const story = makeStory();
    const result = checkCompliance(story, ['кот', 'мяч', 'прыгал', 'научился', 'дружить']);
    expect(result.score).toBe(1);
    expect(result.compliant).toBe(true);
    expect(result.outOfCorpus).toEqual([]);
  });

  it('returns compliant=false when meaningful tokens are absent from corpus', () => {
    const story = makeStory({
      pages: [
        coverPage,
        { template: 'image-top', text: 'бегемот слон жираф', illustrationPrompt: 'Animals' },
        finalPage,
      ],
    });
    const result = checkCompliance(story, ['кот', 'мяч']);
    expect(result.compliant).toBe(false);
    expect(result.outOfCorpus).toContain('бегемот');
    expect(result.outOfCorpus).toContain('слон');
    expect(result.outOfCorpus).toContain('жираф');
  });

  it('excludes stop words from the compliance check', () => {
    const story = makeStory({
      pages: [
        coverPage,
        { template: 'image-top', text: 'и в на кот', illustrationPrompt: 'Cat' },
        finalPage,
      ],
    });
    // "и", "в", "на" are stop words — only "кот" is meaningful
    const result = checkCompliance(story, ['кот', 'мяч', 'научился', 'дружить']);
    expect(result.score).toBe(1);
    expect(result.compliant).toBe(true);
  });

  it('does NOT check illustrationPrompt text (English, for DALL-E)', () => {
    const story = makeStory({
      pages: [
        coverPage,
        { template: 'image-top', text: 'кот', illustrationPrompt: 'elephant giraffe hippo' },
        { template: 'final', text: 'кот', illustrationPrompt: 'watercolour illustration' },
      ],
    });
    // English words from illustrationPrompt must not be counted
    const result = checkCompliance(story, ['кот', 'мяч', 'научился', 'дружить']);
    expect(result.score).toBe(1);
    expect(result.compliant).toBe(true);
  });

  it('computes fractional score for partial corpus matches', () => {
    const story: Story = {
      title: 'кот',
      pages: [
        { template: 'cover', title: 'тест', illustrationPrompt: 'test' },
        { template: 'image-top', text: 'кот прыгал бегемот слон', illustrationPrompt: 'x' },
        { template: 'final', text: 'кот', illustrationPrompt: 'x' },
      ],
      discussionQuestions: ['?', '?', '?', '?', '?'],
    };
    // Meaningful: кот (×3), тест, прыгал, бегемот, слон = 7 tokens
    // In corpus: кот (×3), тест, прыгал = 5 tokens → score = 5/7
    const result = checkCompliance(story, ['кот', 'прыгал', 'тест']);
    expect(result.score).toBeCloseTo(5 / 7);
    expect(result.outOfCorpus).toContain('бегемот');
    expect(result.outOfCorpus).toContain('слон');
  });

  it('marks result compliant when score >= COMPLIANCE_THRESHOLD', () => {
    expect(COMPLIANCE_THRESHOLD).toBe(0.85);
    const story: Story = {
      title: 'один',
      pages: [
        { template: 'cover', title: 'один', illustrationPrompt: 'x' },
        {
          template: 'image-top',
          text: 'два три четыре пять шесть семь восемь девять десять',
          illustrationPrompt: 'x',
        },
        { template: 'final', text: 'одиннадцать', illustrationPrompt: 'x' },
      ],
      discussionQuestions: ['?', '?', '?', '?', '?'],
    };
    // Meaningful: один (×2), два, три, четыре, пять, шесть, семь, восемь, девять, десять, одиннадцать
    // All 12 tokens in corpus → score = 1 >= 0.85
    const corpus = [
      'один',
      'два',
      'три',
      'четыре',
      'пять',
      'шесть',
      'семь',
      'восемь',
      'девять',
      'десять',
      'одиннадцать',
    ];
    const result = checkCompliance(story, corpus);
    expect(result.score).toBeGreaterThanOrEqual(COMPLIANCE_THRESHOLD);
    expect(result.compliant).toBe(true);
  });

  it('handles pages that have no text or title (illustration-only)', () => {
    const story: Story = {
      title: 'кот',
      pages: [
        { template: 'cover', illustrationPrompt: 'x' },
        { template: 'image-top', illustrationPrompt: 'x' },
        { template: 'final', text: 'кот', illustrationPrompt: 'x' },
      ],
      discussionQuestions: ['?', '?', '?', '?', '?'],
    };
    const result = checkCompliance(story, ['кот']);
    expect(result.compliant).toBe(true);
  });

  it('checks story.title and discussionQuestions as well as page text', () => {
    const story: Story = {
      title: 'необычный заголовок',
      pages: [coverPage, finalPage],
      discussionQuestions: ['странный вопрос?', '?', '?', '?', '?'],
    };
    const result = checkCompliance(story, ['кот', 'научился', 'дружить']);
    // "необычный", "заголовок", "странный", "вопрос" are not in corpus
    expect(result.outOfCorpus).toContain('необычный');
    expect(result.outOfCorpus).toContain('заголовок');
  });
});
