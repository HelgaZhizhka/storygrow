import { STYLE_SUFFIXES, type ArtStyle } from './ai.config';

describe('STYLE_SUFFIXES', () => {
  it('defines a suffix for every art style', () => {
    const keys: ArtStyle[] = ['watercolor', 'cartoon', 'storybook', 'pixel', 'realistic'];
    for (const key of keys) {
      expect(STYLE_SUFFIXES[key]).toMatch(/^,/);
      expect(STYLE_SUFFIXES[key]).toContain('no text in image');
    }
  });

  it('watercolor suffix mentions watercolour', () => {
    expect(STYLE_SUFFIXES.watercolor).toMatch(/watercolour/i);
  });
});
