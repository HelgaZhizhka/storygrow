import { z } from 'zod';
import {
  APPEARANCE_FIELD_MAX_CHARS,
  DESCRIPTOR_MAX_CHARS,
  MAX_CAST,
  MAX_LOCATIONS,
  MAX_PROPS,
} from '../ai.config';

/**
 * Visual Bible (#348) — the book's visual world, decided ONCE in the Plan phase
 * and merged into the Story in code (never re-emitted by an LLM). Every
 * descriptor is ENGLISH, concrete/physical, and FIXED for the whole book — it is
 * reused verbatim on every page so a location/character can no longer drift.
 *
 * `id`s are lowercase slugs used to wire a page's Scene to bible entries.
 * Referential integrity (dangling ids, cover/final hero flags) is repaired
 * deterministically by `normalizeVisualBible`, NOT by a schema pattern — OpenAI
 * structured output is unreliable with regex, and a dangling id is not worth a
 * full plan regeneration.
 */
const bibleId = z.string().min(1).max(24);
const descriptor = z.string().min(1).max(DESCRIPTOR_MAX_CHARS);

const appearanceField = z.string().min(1).max(APPEARANCE_FIELD_MAX_CHARS);

/**
 * Structured appearance (#360) — what the Plan phase emits for every person or
 * animal instead of a free-text descriptor. Each field is REQUIRED, so an outfit
 * or a skin tone can no longer be silently omitted (a cast member without a
 * pinned outfit was re-dressed on every page; one without a skin tone changed
 * skin tone between pages). The story descriptor is rendered from these fields
 * in code (`renderAppearance`) — never by the model, and never with the name.
 */
export const AppearanceSchema = z.object({
  kind: appearanceField.describe(
    'Who and how old, English, e.g. "6-year-old girl", "young woman", "small grey kitten". Never a name.',
  ),
  skin: appearanceField.describe(
    'Skin tone with the word skin, e.g. "light skin", "dark brown skin"; for an animal the fur/feather colour, e.g. "grey fur".',
  ),
  hair: appearanceField.describe(
    'Hair colour AND style with the word hair, e.g. "short curly brown hair"; for an animal the fur pattern, e.g. "fluffy white fur".',
  ),
  outfit: appearanceField.describe(
    'Clothes WITH specific colours, e.g. "a red jumper, blue denim overalls, red sneakers"; "no clothes" for an animal.',
  ),
  detail: appearanceField.describe(
    'One distinctive, always-visible detail, e.g. "round glasses", "a yellow bow", "a red collar".',
  ),
});
export type Appearance = z.infer<typeof AppearanceSchema>;

// The model tends to drop the noun a field name implies ("light" for skin,
// "curly blond" for hair); the descriptor must read on its own in an image prompt.
const withNoun = (value: string, noun: string, alreadyThere: RegExp): string =>
  alreadyThere.test(value) ? value : `${value} ${noun}`;

/**
 * The hero's `kind` is built in code from what the input already knows (#376):
 * age and gender. The Plan model wrote "3-year-old child" for a girl and the
 * portrait came out a boy; deriving from model text what the input states was
 * the wrong direction. 'other' / unknown gender → "child".
 */
export const heroKind = (age: number, gender?: string): string => {
  const word = gender === 'female' ? 'girl' : gender === 'male' ? 'boy' : 'child';
  return `${age}-year-old ${word}`;
};

const SKIN_NOUN = /skin|fur|feather|scale|coat|complexion/i;
const HAIR_NOUN =
  /hair|fur|bald|curls|braids|ponytail|pigtail|mane|feather|ears|whiskers|fluffy|spots|stripes|no /i;

/** Canary (#378): how many implied nouns the renderer would add — non-zero means the model ignored the field descriptions. */
export const impliedNounsAdded = (a: Appearance): number =>
  Number(!SKIN_NOUN.test(a.skin)) + Number(!HAIR_NOUN.test(a.hair));

/** The fixed English descriptor every page and sheet uses. No name — a name in an image prompt gets drawn as a label. */
export const renderAppearance = (a: Appearance): string => {
  const skin = withNoun(a.skin.trim(), 'skin', SKIN_NOUN);
  const hair = withNoun(a.hair.trim(), 'hair', HAIR_NOUN);
  return `${a.kind}, ${skin}, ${hair}, wearing ${a.outfit}, ${a.detail}`;
};

/** Cast member as the PLAN emits it (structured appearance). */
export const PlanCastMemberSchema = z.object({
  id: bibleId.describe('Lowercase slug used by page scenes, e.g. "brother", "mama".'),
  name: z
    .string()
    .min(1)
    .describe('Name as used in the Russian story text, e.g. "братик", "Миша".'),
  role: z.string().min(1).describe('Role in the story, Russian, short, e.g. "младший брат".'),
  appearance: AppearanceSchema.describe(
    'Fixed look for the whole book; reused verbatim on every page.',
  ),
});
export type PlanCastMember = z.infer<typeof PlanCastMemberSchema>;

/** Cast member as the STORY persists it (rendered descriptor, used by prompts/sheets/judge). */
export const CastMemberSchema = z.object({
  id: bibleId,
  name: z.string().min(1),
  role: z.string().min(1),
  /** Rendered from `Appearance` by `renderAppearance`; fixed for the whole book. */
  descriptor,
});
export type CastMember = z.infer<typeof CastMemberSchema>;

/**
 * How big the location's key object is next to the child (#366). A peopleless
 * establishing sheet has no scale anchor, so without this the model drew a
 * "sky-high" slide toddler-sized and the child came out giant on every page.
 */
export const OBJECT_SIZES = [
  'smaller than the child',
  "about the child's height",
  "twice the child's height",
  'much taller than the child',
] as const;
export type ObjectSize = (typeof OBJECT_SIZES)[number];

/** Location as the PLAN emits it: structured, so size can never be omitted. */
export const PlanLocationSchema = z.object({
  id: bibleId.describe('Lowercase slug used by page scenes, e.g. "playground".'),
  name: z.string().min(1).describe('Russian name used in the story text, e.g. "горка во дворе".'),
  keyObject: appearanceField.describe(
    'ONE key object in the singular, English, e.g. "a red metal slide with a wooden ladder". Never several of the same thing.',
  ),
  size: z
    .enum(OBJECT_SIZES)
    .describe(
      'How big the key object is next to the child — the pictures have no other scale anchor.',
    ),
  materials: appearanceField.describe(
    'Materials and colours of the key object, e.g. "red plastic chute, pale wooden rungs".',
  ),
  surroundings: appearanceField.describe(
    'What surrounds it, e.g. "green grass, a low hedge, one birch".',
  ),
});
export type PlanLocation = z.infer<typeof PlanLocationSchema>;

/** Location as the STORY persists it (rendered descriptor, used by prompts, sheets and the judge). */
export const LocationSchema = z.object({
  id: bibleId,
  name: z.string().min(1),
  /** Rendered by `renderLocation`; fixed for the whole book. */
  descriptor,
});
export type Location = z.infer<typeof LocationSchema>;

/** The fixed English location descriptor: key object first, its size next to the child, then materials and surroundings. */
export const renderLocation = (l: PlanLocation): string =>
  `${l.keyObject}, ${l.size}, ${l.materials}, surrounded by ${l.surroundings}`;

/** Prop as the PLAN emits it: the Russian name is what Prose may mention (#367). */
export const PlanPropSchema = z.object({
  id: bibleId.describe('Lowercase slug used by page scenes, e.g. "ball".'),
  name: z.string().min(1).describe('Russian name used in the story text, e.g. "красный мячик".'),
  descriptor: descriptor.describe(
    'Fixed English look of the object, e.g. "a small red rubber ball".',
  ),
});
/** Prop as the STORY persists it; `name` is optional so pre-#367 stories still validate. */
export const PropSchema = z.object({ id: bibleId, name: z.string().min(1).optional(), descriptor });
export type Prop = z.infer<typeof PropSchema>;

const MIN_LOCATIONS = 1;

const bibleBase = {
  /** One English line fixed for the whole book: season, light, palette mood. */
  atmosphere: descriptor,
};

/** The bible as the PLAN emits it: structured appearance for the hero and every cast member. */
export const PlanVisualBibleSchema = z.object({
  hero: z.object({
    name: z.string().min(1).describe('The hero name, same as heroName.'),
    appearance: AppearanceSchema.describe(
      "The hero look; in child mode it may be replaced downstream by the parent's description.",
    ),
  }),
  cast: z
    .array(PlanCastMemberSchema)
    .max(MAX_CAST)
    .describe('Every recurring person or animal BESIDES the hero (a brother, mum, a kitten). 0–3.'),
  locations: z
    .array(PlanLocationSchema)
    .min(MIN_LOCATIONS)
    .max(MAX_LOCATIONS)
    .describe('The places of the book, 1–3.'),
  props: z
    .array(PlanPropSchema)
    .max(MAX_PROPS)
    .describe(
      'Key objects the story handles, 0–4. Anything an intent names must be here or in a location.',
    ),
  atmosphere: bibleBase.atmosphere.describe(
    'One English line fixed for the whole book: season, light, palette mood.',
  ),
});
export type PlanVisualBible = z.infer<typeof PlanVisualBibleSchema>;

/** The bible as the STORY persists it: rendered descriptors. */
export const VisualBibleSchema = z.object({
  hero: z.object({ name: z.string().min(1), descriptor }),
  cast: z.array(CastMemberSchema).max(MAX_CAST),
  locations: z.array(LocationSchema).min(MIN_LOCATIONS).max(MAX_LOCATIONS),
  props: z.array(PropSchema).max(MAX_PROPS),
  ...bibleBase,
});
export type VisualBible = z.infer<typeof VisualBibleSchema>;

/**
 * Plan bible → story bible: render every appearance into the fixed descriptor.
 * The hero's descriptor is passed in because the photo / parent-appearance
 * flows override it (`characterProfile`), while cast is always rendered here.
 */
export const toStoryBible = (plan: PlanVisualBible, heroDescriptor: string): VisualBible => ({
  hero: { name: plan.hero.name, descriptor: heroDescriptor },
  cast: plan.cast.map(({ id, name, role, appearance }) => ({
    id,
    name,
    role,
    descriptor: renderAppearance(appearance),
  })),
  locations: plan.locations.map((l) => ({ id: l.id, name: l.name, descriptor: renderLocation(l) })),
  props: plan.props,
  atmosphere: plan.atmosphere,
});

/** One page's selection from the bible. */
export const SceneSchema = z.object({
  locationId: bibleId.describe('Id of one of the bible locations.'),
  castIds: z
    .array(bibleId)
    .max(MAX_CAST)
    .describe('Ids of the cast members present on this page (may be empty).'),
  propIds: z
    .array(bibleId)
    .max(MAX_PROPS)
    .describe('Ids of the props visible on this page (may be empty).'),
  heroOnPage: z
    .boolean()
    .describe('Whether the hero is on this page. Always true on cover and final.'),
});
export type Scene = z.infer<typeof SceneSchema>;
