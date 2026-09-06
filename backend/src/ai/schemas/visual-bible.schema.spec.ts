import { renderAppearance, toStoryBible } from './visual-bible.schema';
import { appearanceFixture, planVisualBibleFixture } from './__fixtures__/visual-bible.fixture';

describe('renderAppearance (#360)', () => {
  it('renders every field in a fixed order, without any name', () => {
    expect(renderAppearance(appearanceFixture())).toBe(
      '5-year-old child, light skin, short brown hair, wearing a yellow t-shirt and blue shorts, a red cap',
    );
  });

  it('adds the implied noun when the model dropped it', () => {
    expect(renderAppearance(appearanceFixture({ skin: 'light', hair: 'curly blond' }))).toContain(
      'light skin, curly blond hair,',
    );
  });

  it('does not double a noun that is already there (people and animals)', () => {
    const out = renderAppearance(
      appearanceFixture({
        kind: 'small bunny',
        skin: 'white fur',
        hair: 'fluffy ears',
        outfit: 'no clothes',
      }),
    );
    expect(out).toBe('small bunny, white fur, fluffy ears, wearing no clothes, a red cap');
  });
});

describe('toStoryBible', () => {
  it('renders cast descriptors and takes the hero descriptor from the caller', () => {
    const plan = planVisualBibleFixture({
      cast: [
        {
          id: 'mum',
          name: 'Мама',
          role: 'мама',
          appearance: appearanceFixture({ kind: 'adult woman' }),
        },
      ],
    });
    const bible = toStoryBible(plan, 'girl, red hair');
    expect(bible.hero.descriptor).toBe('girl, red hair');
    expect(bible.cast[0].descriptor.startsWith('adult woman, light skin')).toBe(true);
    expect(bible.locations).toEqual(plan.locations);
  });
});
