import { renderAppearance, renderLocation, toStoryBible } from './visual-bible.schema';
import {
  appearanceFixture,
  locationFixture,
  planVisualBibleFixture,
} from './__fixtures__/visual-bible.fixture';

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
    expect(bible.locations.map((l) => l.id)).toEqual(plan.locations.map((l) => l.id));
  });
});

describe('renderLocation (#366)', () => {
  it('puts the key object first and its size next to the child right after it', () => {
    expect(
      renderLocation(
        locationFixture({
          keyObject: 'a red plastic slide with a wooden ladder',
          size: 'much taller than the child',
          materials: 'red plastic chute, pale wooden rungs',
          surroundings: 'green grass and one birch',
        }),
      ),
    ).toBe(
      'a red plastic slide with a wooden ladder, much taller than the child, red plastic chute, pale wooden rungs, surrounded by green grass and one birch',
    );
  });

  it('is what the story bible carries as the location descriptor', () => {
    const plan = planVisualBibleFixture();
    const bible = toStoryBible(plan, 'girl');
    expect(bible.locations[0]).toEqual({
      id: 'home',
      name: 'дом',
      descriptor: renderLocation(plan.locations[0]),
    });
  });
});
