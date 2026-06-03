import { pickIllustration, type IllustrationRecord } from './pick-illustration';

const makeIllus = (id: string, tags: string[]): IllustrationRecord => ({
  id,
  url: `https://s3/fast-flow/${id}.png`,
  tags,
});

describe('pickIllustration', () => {
  it('returns null when no illustrations available', () => {
    expect(pickIllustration([], ['happy', 'park'])).toBeNull();
  });

  it('returns null when tags list is empty', () => {
    const illus = [makeIllus('a', ['happy'])];
    expect(pickIllustration(illus, [])).toBeNull();
  });

  it('returns the illustration with the most matching tags', () => {
    const illustrations = [
      makeIllus('a', ['happy', 'park']),
      makeIllus('b', ['happy', 'park', 'boy']),
      makeIllus('c', ['sad', 'bedroom']),
    ];

    const result = pickIllustration(illustrations, ['happy', 'park', 'boy']);
    expect(result?.id).toBe('b');
  });

  it('returns first illustration when no tags match (score 0)', () => {
    const illustrations = [makeIllus('a', ['sad']), makeIllus('b', ['scared'])];
    const result = pickIllustration(illustrations, ['happy']);
    expect(result?.id).toBe('a');
  });

  it('returns single illustration when only one candidate', () => {
    const illustrations = [makeIllus('only', ['happy', 'school'])];
    expect(pickIllustration(illustrations, ['school'])?.id).toBe('only');
  });
});
