import { ensureHeroGender, normalizeVisualBible } from './visual-bible.normalizer';
import type { StoryPlan } from '../schemas';
import {
  planVisualBibleFixture,
  sceneFixture,
  appearanceFixture,
} from '../schemas/__fixtures__/visual-bible.fixture';

const planWith = (pages: StoryPlan['pages']): StoryPlan => ({
  title: 'T',
  heroName: 'Алиса',
  characterProfile: 'girl',
  lesson: 'урок',
  discussionQuestions: ['1?', '2?', '3?', '4?', '5?'],
  visualBible: planVisualBibleFixture({
    cast: [
      {
        id: 'brother',
        name: 'братик',
        role: 'брат',
        appearance: appearanceFixture({ kind: 'toddler boy' }),
      },
    ],
    locations: [
      { id: 'home', name: 'дом', descriptor: 'a room' },
      { id: 'yard', name: 'двор', descriptor: 'a yard' },
    ],
    props: [{ id: 'ball', descriptor: 'a red ball' }],
  }),
  pages,
});

describe('normalizeVisualBible', () => {
  it('replaces a dangling locationId with the first location and counts it', () => {
    const { plan, repairs } = normalizeVisualBible(
      planWith([
        {
          template: 'cover',
          beat: 'b',
          intent: 'i',
          scene: sceneFixture({ locationId: 'nope', heroOnPage: true }),
        },
      ]),
    );
    expect(plan.pages[0].scene.locationId).toBe('home');
    expect(repairs).toBe(1);
  });

  it('drops unknown and duplicate cast/prop ids', () => {
    const { plan, repairs } = normalizeVisualBible(
      planWith([
        {
          template: 'image-top',
          beat: 'b',
          intent: 'i',
          scene: sceneFixture({
            locationId: 'yard',
            castIds: ['brother', 'ghost', 'brother'],
            propIds: ['ball', 'sword'],
          }),
        },
      ]),
    );
    expect(plan.pages[0].scene.castIds).toEqual(['brother']);
    expect(plan.pages[0].scene.propIds).toEqual(['ball']);
    expect(repairs).toBe(3); // ghost + duplicate brother + sword
  });

  it('forces heroOnPage on cover and final pages', () => {
    const { plan, repairs } = normalizeVisualBible(
      planWith([
        { template: 'cover', beat: 'b', intent: 'i', scene: sceneFixture({ heroOnPage: false }) },
        { template: 'final', beat: 'b', intent: 'i', scene: sceneFixture({ heroOnPage: false }) },
      ]),
    );
    expect(plan.pages[0].scene.heroOnPage).toBe(true);
    expect(plan.pages[1].scene.heroOnPage).toBe(true);
    expect(repairs).toBe(2);
  });

  it('forces heroOnPage when the page intent names the hero (observer-mode slip)', () => {
    const { plan, repairs } = normalizeVisualBible(
      planWith([
        {
          template: 'image-top',
          beat: 'b',
          intent: 'Друзья убегают; Алиса остаётся на переднем плане с машинкой',
          scene: sceneFixture({ locationId: 'home', heroOnPage: false }),
        },
        {
          template: 'image-top',
          beat: 'b',
          intent: 'Друзья играют в мяч вдвоём',
          scene: sceneFixture({ locationId: 'home', heroOnPage: false }),
        },
      ]),
    );
    expect(plan.pages[0].scene.heroOnPage).toBe(true);
    expect(plan.pages[1].scene.heroOnPage).toBe(false);
    expect(repairs).toBe(1);
  });

  it('adds a cast member the intent names but the scene omits', () => {
    const { plan, repairs } = normalizeVisualBible(
      planWith([
        {
          template: 'image-top',
          beat: 'b',
          intent: 'Алиса показывает братику красный мяч',
          scene: sceneFixture({ locationId: 'home', castIds: [], heroOnPage: true }),
        },
      ]),
    );
    expect(plan.pages[0].scene.castIds).toEqual(['brother']);
    expect(repairs).toBe(1);
  });

  it('leaves a clean plan untouched (zero repairs)', () => {
    const { repairs } = normalizeVisualBible(
      planWith([
        {
          template: 'cover',
          beat: 'b',
          intent: 'i',
          scene: sceneFixture({ locationId: 'home', heroOnPage: true }),
        },
        {
          template: 'image-top',
          beat: 'b',
          intent: 'i',
          scene: sceneFixture({ locationId: 'yard', castIds: ['brother'], propIds: ['ball'] }),
        },
      ]),
    );
    expect(repairs).toBe(0);
  });
});

describe('ensureHeroGender (#360)', () => {
  it('replaces a genderless kind with the known gender', () => {
    expect(ensureHeroGender(appearanceFixture({ kind: '3-year-old child' }), 'female').kind).toBe(
      '3-year-old girl',
    );
    expect(ensureHeroGender(appearanceFixture({ kind: 'lively toddler' }), 'male').kind).toBe(
      'lively boy',
    );
  });

  it('appends the gender when there is no word to replace', () => {
    expect(ensureHeroGender(appearanceFixture({ kind: '6 years old' }), 'female').kind).toBe(
      '6 years old, a girl',
    );
  });

  it('leaves an already gendered kind and unknown/other genders alone', () => {
    expect(ensureHeroGender(appearanceFixture({ kind: '5-year-old boy' }), 'female').kind).toBe(
      '5-year-old boy',
    );
    expect(ensureHeroGender(appearanceFixture({ kind: '5-year-old child' }), 'other').kind).toBe(
      '5-year-old child',
    );
    expect(ensureHeroGender(appearanceFixture({ kind: '5-year-old child' })).kind).toBe(
      '5-year-old child',
    );
  });
});
