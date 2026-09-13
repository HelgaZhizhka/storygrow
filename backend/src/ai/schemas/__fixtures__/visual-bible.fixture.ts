import type {
  Appearance,
  PlanLocation,
  PlanVisualBible,
  Scene,
  VisualBible,
} from '../visual-bible.schema';

/** Minimal valid Scene for tests that don't care about the specific selection. */
export const sceneFixture = (over: Partial<Scene> = {}): Scene => ({
  locationId: 'home',
  castIds: [],
  propIds: [],
  heroOnPage: true,
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

/** Minimal valid structured appearance (#360). */
export const appearanceFixture = (over: Partial<Appearance> = {}): Appearance => ({
  kind: '5-year-old child',
  skin: 'light skin',
  hair: 'short brown hair',
  outfit: 'a yellow t-shirt and blue shorts',
  detail: 'a red cap',
  ...over,
});

/** Minimal valid PLAN bible (structured appearance) for plan fixtures. */
/** Minimal valid structured location (#366). */
export const locationFixture = (over: Partial<PlanLocation> = {}): PlanLocation => ({
  id: 'home',
  name: 'дом',
  keyObject: 'a soft green sofa',
  size: "about the child's height",
  materials: 'green velvet, wooden legs',
  surroundings: 'a round rug and a bookshelf',
  ...over,
});

export const planVisualBibleFixture = (over: Partial<PlanVisualBible> = {}): PlanVisualBible => ({
  hero: { name: 'Герой', appearance: appearanceFixture() },
  cast: [],
  locations: [locationFixture()],
  props: [],
  atmosphere: 'warm daylight',
  ...over,
});
