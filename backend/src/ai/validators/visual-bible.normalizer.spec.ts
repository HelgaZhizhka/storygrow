import { normalizeVisualBible } from './visual-bible.normalizer';
import type { StoryPlan } from '../schemas';
import { visualBibleFixture, sceneFixture } from '../schemas/__fixtures__/visual-bible.fixture';

const planWith = (pages: StoryPlan['pages']): StoryPlan => ({
  title: 'T',
  heroName: 'Алиса',
  characterProfile: 'girl',
  lesson: 'урок',
  discussionQuestions: ['1?', '2?', '3?', '4?', '5?'],
  visualBible: visualBibleFixture({
    cast: [{ id: 'brother', name: 'братик', role: 'брат', descriptor: 'toddler boy' }],
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
