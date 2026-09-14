import {
  measureProse,
  measureBatchDiversity,
  summarizeMetrics,
  formatMetricsSummary,
} from './prose-metrics';
import type { Story } from '../../ai/schemas';

const page = (text: string | null, template = 'image-top'): Story['pages'][number] => ({
  template: template as Story['pages'][number]['template'],
  text,
  title: text === null ? 'Обложка' : null,
  illustrationPrompt: 'the child stands',
});

const story = (overrides: Partial<Story> = {}): Story => ({
  title: 'Алиса и мешок яблок',
  characterProfile: '6-year-old girl',
  discussionQuestions: ['1', '2', '3', '4', '5'],
  pages: [
    page(null, 'cover'),
    page('Набрала Алиса полный мешок яблок. «Карр! Безобразие!» — каркает Ворона.'),
    page('Идёт Алиса домой. «Дай яблочко, Косой!» — пищат бельчата. Идёт Алиса домой.'),
    page('Идёт Алиса домой. Дома все сели за стол.', 'final'),
  ],
  visualBible: {
    hero: { name: 'Алиса', descriptor: 'girl' },
    cast: [
      { id: 'vorona', name: 'Ворона', role: 'ворчунья', descriptor: 'crow' },
      { id: 'volk', name: 'Волк', role: 'антагонист', descriptor: 'wolf' },
    ],
    locations: [{ id: 'les', name: 'лесная тропинка', descriptor: 'path' }],
    props: [{ id: 'bag', name: 'мешок яблок', descriptor: 'bag' }],
    atmosphere: 'autumn',
  },
  ...overrides,
});

describe('measureProse', () => {
  it('counts words, sentences, dialogue share and hero-name density', () => {
    const m = measureProse(story());
    expect(m.words).toBeGreaterThan(20);
    expect(m.sentences).toBe(7);
    expect(m.dialogueShare).toBeGreaterThan(0.2);
    expect(m.dialogueShare).toBeLessThan(0.6);
    // "Алиса" appears 4 times over 7 sentences (stem "Алис" catches inflection).
    expect(m.heroNamePerSentence).toBeCloseTo(4 / 7, 1);
  });

  it('finds the refrain, the named cast, and no formula moral on a scene-final', () => {
    const m = measureProse(story());
    expect(m.refrainLines).toBe(1); // «Идёт Алиса домой.» ×3
    expect(m.castNamed).toBe(1); // Ворона in text, Волк only in the bible
    expect(m.castTotal).toBe(2);
    expect(m.moralFormulaOnFinal).toBe(false);
    expect(m.titleStopword).toBe(false);
  });

  it('flags the question tic in all three forms and the formula moral', () => {
    const s = story({
      title: 'Алиса и волшебная коробка',
      pages: [
        page(null, 'cover'),
        page('«Достать? Не достать?» — думает Алиса. «Помочь? Помочь?» Поделиться или нет?'),
        page('— Доброта — это когда мы помогаем, — сказала Алиса.', 'final'),
      ],
    });
    const m = measureProse(s);
    expect(m.questionTics).toBe(3);
    expect(m.moralFormulaOnFinal).toBe(true);
    expect(m.titleStopword).toBe(true);
  });

  it('uses the hero name passed by the harness over the bible', () => {
    const m = measureProse(story(), 'Ворона');
    expect(m.heroNamePerSentence).toBeCloseTo(1 / 7, 1);
  });

  it('handles a story without a bible or body text', () => {
    const m = measureProse({ ...story(), visualBible: undefined, pages: [page(null, 'cover')] });
    expect(m).toMatchObject({
      words: 0,
      sentences: 0,
      dialogueShare: 0,
      heroNamePerSentence: 0,
      castNamed: 0,
      castTotal: 0,
      refrainLines: 0,
    });
  });
});

describe('measureBatchDiversity', () => {
  it('reports props and locations shared by two or more stories, by head noun', () => {
    const withBox = (name: string): Story =>
      story({
        visualBible: {
          ...story().visualBible!,
          props: [{ id: 'p', name, descriptor: 'box' }],
          locations: [{ id: 'l', name: 'детская площадка', descriptor: 'yard' }],
        },
      });
    const d = measureBatchDiversity([withBox('коробка'), withBox('волшебная коробка'), story()]);
    expect(d.repeatedProps).toEqual([{ name: 'коробка', count: 2 }]);
    expect(d.repeatedLocations).toEqual([{ name: 'площадка', count: 2 }]);
  });
});

describe('summarizeMetrics', () => {
  it('averages numeric metrics and counts boolean symptoms', () => {
    const a = measureProse(story());
    const b = measureProse(story({ title: 'Секрет коробки' }));
    const s = summarizeMetrics([a, b]);
    expect(s.titleStopwordStories).toBe(1);
    expect(s.refrainStories).toBe(2);
    expect(s.words).toBe(a.words);
    expect(formatMetricsSummary(s, 2)).toContain('title stop-word 1/2');
  });
});
