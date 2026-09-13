import {
  STYLE_SUFFIXES,
  type ArtStyle,
  IMAGE_SIZE_TO_ASPECT_RATIO,
  DEFAULT_IMAGE_PROVIDER,
  parseImageProvider,
  GEMINI_IMAGE_MODEL,
  GEMINI_VISION_MODEL,
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

  it('defaults to the xai provider', () => {
    expect(DEFAULT_IMAGE_PROVIDER).toBe('xai');
  });

  it('targets the gemini flash image model', () => {
    expect(GEMINI_IMAGE_MODEL).toBe('gemini-2.5-flash-image');
  });
});

describe('GEMINI_VISION_MODEL (#359)', () => {
  it('is not the retired gemini-2.5-flash (404 on the current Google project)', () => {
    expect(GEMINI_VISION_MODEL).not.toBe('gemini-2.5-flash');
    expect(GEMINI_VISION_MODEL).toBe('gemini-3.6-flash');
  });
});

describe('parseImageProvider (#373)', () => {
  it('defaults to xai and accepts the two reference-capable providers', () => {
    expect(parseImageProvider(undefined)).toBe('xai');
    expect(parseImageProvider('')).toBe('xai');
    expect(parseImageProvider('gemini')).toBe('gemini');
  });

  it('no longer knows the OpenAI image provider (#375: it took no references)', () => {
    expect(() => parseImageProvider('openai')).toThrow(/IMAGE_PROVIDER/);
  });

  it('throws on an unknown value instead of silently selecting another model', () => {
    expect(() => parseImageProvider('gemni')).toThrow(/IMAGE_PROVIDER/);
  });
});
