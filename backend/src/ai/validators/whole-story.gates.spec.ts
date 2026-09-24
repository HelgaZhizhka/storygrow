import { countWords, latinWords, runTextGates } from './whole-story.gates';

const words = (n: number): string => Array.from({ length: n }, (_, i) => `слово${i}`).join(' ');

describe('countWords', () => {
  it('counts Cyrillic and hyphenated words, not a standalone dialogue dash', () => {
    expect(countWords('— Алиса, посмотри! Тихо-тихо пришёл кот.')).toBe(5);
  });

  it('returns 0 for empty text', () => {
    expect(countWords('')).toBe(0);
  });
});

describe('latinWords', () => {
  it('finds Latin words of two letters or more and ignores single letters', () => {
    expect(latinWords('Кот сказал hello и ушёл. A потом — ok.')).toEqual(['hello', 'ok']);
  });
});

describe('runTextGates', () => {
  const base = { title: 'Алиса и синий фонарик', goalTitle: 'Доброта', ageBand: '5-6' as const };

  it('passes a Russian tale inside the band range with a concrete title', () => {
    const result = runTextGates({ ...base, text: words(400) });
    expect(result.passed).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.words).toBe(400);
  });

  it('fails a tale below the range and names the range', () => {
    const result = runTextGates({ ...base, text: words(200) });
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toMatch(/200 words.*350–550/);
  });

  it('fails a tale above the range', () => {
    expect(runTextGates({ ...base, text: words(600) }).passed).toBe(false);
  });

  it('uses the 3–4 range for the 3–4 band', () => {
    expect(runTextGates({ ...base, ageBand: '3-4', text: words(200) }).passed).toBe(true);
    expect(runTextGates({ ...base, ageBand: '3-4', text: words(400) }).passed).toBe(false);
  });

  it('fails on Latin words in the text or the title', () => {
    const result = runTextGates({ ...base, text: `${words(400)} the end` });
    expect(result.passed).toBe(false);
    expect(result.latinWords).toEqual(['the', 'end']);
    expect(runTextGates({ ...base, title: 'Alice и кот', text: words(400) }).passed).toBe(false);
  });

  it('fails a title that names the value or uses a dull template', () => {
    expect(runTextGates({ ...base, title: 'Алиса и доброта', text: words(400) }).passed).toBe(
      false,
    );
    expect(
      runTextGates({ ...base, title: 'История про Алису', text: words(400) }).titleIssues,
    ).toHaveLength(1);
  });

  it('does not gate the title on length — layout is not the author’s problem', () => {
    const long = 'Алиса, синий фонарик и очень длинная дорога домой через весь двор и обратно';
    expect(runTextGates({ ...base, title: long, text: words(400) }).passed).toBe(true);
  });
});
