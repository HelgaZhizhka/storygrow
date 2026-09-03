import type { Scene, VisualBible } from '../visual-bible.schema';

/** Minimal valid Scene for tests that don't care about the specific selection. */
export const sceneFixture = (over: Partial<Scene> = {}): Scene => ({
  locationId: 'home',
  castIds: [],
  propIds: [],
  heroOnPage: true,
  timeOfDay: 'day',
  framing: 'medium',
  ...over,
});

/** Minimal valid VisualBible for plan/story fixtures. */
export const visualBibleFixture = (over: Partial<VisualBible> = {}): VisualBible => ({
  hero: { name: 'Герой', descriptor: '5-year-old child' },
  cast: [],
  locations: [{ id: 'home', name: 'дом', descriptor: 'a cosy room' }],
  props: [],
  atmosphere: 'warm daylight',
  ...over,
});
