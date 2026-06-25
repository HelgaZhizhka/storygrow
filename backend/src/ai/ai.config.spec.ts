import {
  STYLE_SUFFIXES,
  type ArtStyle,
  IMAGE_SIZE_TO_ASPECT_RATIO,
  DEFAULT_IMAGE_PROVIDER,
  GEMINI_IMAGE_MODEL,
} from './ai.config';

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

describe('image config', () => {
  it('maps every template image size to an aspect ratio', () => {
    expect(IMAGE_SIZE_TO_ASPECT_RATIO['1024x1024']).toBe('1:1');
    expect(IMAGE_SIZE_TO_ASPECT_RATIO['1024x1536']).toBe('2:3');
    expect(IMAGE_SIZE_TO_ASPECT_RATIO['1536x1024']).toBe('3:2');
  });

  it('defaults to the gemini provider', () => {
    expect(DEFAULT_IMAGE_PROVIDER).toBe('gemini');
  });

  it('targets the gemini flash image model', () => {
    expect(GEMINI_IMAGE_MODEL).toBe('gemini-2.5-flash-image');
  });
});
