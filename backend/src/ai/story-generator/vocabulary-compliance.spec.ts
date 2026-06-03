import { checkCompliance } from './vocabulary-compliance';
import { COMPLIANCE_THRESHOLD } from '../ai.config';
import type { Story, Page } from '../schemas';

const p = (template: Page['template'], overrides: Partial<Page> = {}): Page => ({
  template,
  text: null,
  title: null,
  illustrationPrompt: 'x',
  ...overrides,
});

const coverPage = {
  template: 'cover' as const,
  text: null,
  title: 'Кот и мяч',
  illustrationPrompt: 'A cat with a ball, watercolour',
};
const finalPage = {
  template: 'final' as const,
  text: 'Кот научился дружить',
  title: null,
  illustrationPrompt: 'Cat smiling, watercolour',
};
const makeStory = (overrides: Partial<Story> = {}): Story => ({
  title: 'Кот и мяч',
  pages: [
    coverPage,
    p('image-top', { text: 'Кот прыгал', illustrationPrompt: 'Cat jumping' }),
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
    expect(result.passed).toBe(true);
    expect(result.outOfCorpus).toEqual([]);
  });

  it('returns compliant=false when meaningful tokens are absent from corpus', () => {
    const story = makeStory({
      pages: [
        coverPage,
        p('image-top', {
          text: 'бегемот слон жираф крокодил носорог зебра пингвин антилопа',
          illustrationPrompt: 'Animals',
        }),
        finalPage,
      ],
    });
    const result = checkCompliance(story, ['кот', 'мяч']);
    expect(result.passed).toBe(false);
    expect(result.outOfCorpus).toContain('бегемот');
    expect(result.outOfCorpus).toContain('слон');
    expect(result.outOfCorpus).toContain('жираф');
  });

  it('excludes stop words from the compliance check', () => {
    const story = makeStory({
      pages: [
        coverPage,
        p('image-top', { text: 'и в на кот', illustrationPrompt: 'Cat' }),
        finalPage,
      ],
    });
    // "и", "в", "на" are stop words — only "кот" is meaningful
    const result = checkCompliance(story, ['кот', 'мяч', 'научился', 'дружить']);
    expect(result.score).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('does NOT check illustrationPrompt text (English, for DALL-E)', () => {
    const story = makeStory({
      pages: [
        coverPage,
        p('image-top', { text: 'кот', illustrationPrompt: 'elephant giraffe hippo' }),
        p('final', { text: 'кот', illustrationPrompt: 'watercolour illustration' }),
      ],
    });
    // English words from illustrationPrompt must not be counted
    const result = checkCompliance(story, ['кот', 'мяч', 'научился', 'дружить']);
    expect(result.score).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('computes fractional score for partial corpus matches', () => {
    const story: Story = {
      title: 'кот',
      pages: [
        p('cover', { title: 'тест', illustrationPrompt: 'test' }),
        p('image-top', { text: 'кот прыгал бегемот слон' }),
        p('final', { text: 'кот' }),
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

  it('matches inflected story words against base-form corpus entries (stemming)', () => {
    const story: Story = {
      title: 'кот',
      pages: [
        p('cover', { title: 'кот' }),
        // inflected forms; corpus holds only base forms
        p('image-top', { text: 'котом кота играла дружбы' }),
        p('final', { text: 'кот' }),
      ],
      discussionQuestions: ['?', '?', '?', '?', '?'],
    };
    const result = checkCompliance(story, ['кот', 'играть', 'дружба']);
    expect(result.score).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('marks result compliant when score >= COMPLIANCE_THRESHOLD', () => {
    expect(COMPLIANCE_THRESHOLD).toBe(0.4);
    const story: Story = {
      title: 'один',
      pages: [
        p('cover', { title: 'один' }),
        p('image-top', { text: 'два три четыре пять шесть семь восемь девять десять' }),
        p('final', { text: 'одиннадцать' }),
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
    expect(result.passed).toBe(true);
  });

  it('handles pages that have no text or title (illustration-only)', () => {
    const story: Story = {
      title: 'кот',
      pages: [p('cover'), p('image-top'), p('final', { text: 'кот' })],
      discussionQuestions: ['?', '?', '?', '?', '?'],
    };
    const result = checkCompliance(story, ['кот']);
    expect(result.passed).toBe(true);
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
