import { VisualBibleSchema, SceneSchema } from './visual-bible.schema';
import { MAX_CAST, MAX_LOCATIONS, DESCRIPTOR_MAX_CHARS } from '../ai.config';

const bible = (over: Record<string, unknown> = {}): unknown => ({
  hero: { name: 'Алиса', descriptor: '5-year-old girl, red hair' },
  cast: [{ id: 'brother', name: 'братик', role: 'младший брат', descriptor: 'toddler boy, blond' }],
  locations: [{ id: 'slide', name: 'горка', descriptor: 'green slide with a metal ladder' }],
  props: [],
  atmosphere: 'sunny courtyard, warm light',
  ...over,
});

const scene = (over: Record<string, unknown> = {}): unknown => ({
  locationId: 'slide',
  castIds: ['brother'],
  propIds: [],
  heroOnPage: true,
  timeOfDay: 'day',
  framing: 'wide',
  ...over,
});

describe('VisualBibleSchema', () => {
  it('accepts a well-formed bible', () => {
    expect(VisualBibleSchema.safeParse(bible()).success).toBe(true);
  });

  it('requires at least one location', () => {
    expect(VisualBibleSchema.safeParse(bible({ locations: [] })).success).toBe(false);
  });

  it('caps cast at MAX_CAST', () => {
    const many = Array.from({ length: MAX_CAST + 1 }, (_, i) => ({
      id: `c${i}`,
      name: 'x',
      role: 'y',
      descriptor: 'z',
    }));
    expect(VisualBibleSchema.safeParse(bible({ cast: many })).success).toBe(false);
  });

  it('caps locations at MAX_LOCATIONS', () => {
    const many = Array.from({ length: MAX_LOCATIONS + 1 }, (_, i) => ({
      id: `l${i}`,
      name: 'x',
      descriptor: 'y',
    }));
    expect(VisualBibleSchema.safeParse(bible({ locations: many })).success).toBe(false);
  });

  it('rejects an over-long descriptor', () => {
    const long = 'a'.repeat(DESCRIPTOR_MAX_CHARS + 1);
    expect(VisualBibleSchema.safeParse(bible({ atmosphere: long })).success).toBe(false);
  });
});

describe('SceneSchema', () => {
  it('accepts a well-formed scene', () => {
    expect(SceneSchema.safeParse(scene()).success).toBe(true);
  });

  it('rejects an unknown timeOfDay', () => {
    expect(SceneSchema.safeParse(scene({ timeOfDay: 'dusk' })).success).toBe(false);
  });

  it('rejects an unknown framing', () => {
    expect(SceneSchema.safeParse(scene({ framing: 'macro' })).success).toBe(false);
  });
});
