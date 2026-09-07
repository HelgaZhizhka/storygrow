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
  /** Who and how old, English: "6-year-old boy", "young woman", "small grey kitten". */
  kind: appearanceField,
  /** Skin tone (people) or fur/feather colour (animals): "light skin", "dark brown skin", "grey fur". */
  skin: appearanceField,
  /** Hair colour + style, or "no hair" / fur pattern for an animal: "short curly brown hair". */
  hair: appearanceField,
  /** Clothes WITH colours: "red jumper, blue denim overalls, red sneakers". "no clothes" for an animal. */
  outfit: appearanceField,
  /** One distinctive, always-visible detail: "round glasses", "a yellow bow", "a red collar". */
  detail: appearanceField,
});
export type Appearance = z.infer<typeof AppearanceSchema>;

// The model tends to drop the noun a field name implies ("light" for skin,
// "curly blond" for hair); the descriptor must read on its own in an image prompt.
const withNoun = (value: string, noun: string, alreadyThere: RegExp): string =>
  alreadyThere.test(value) ? value : `${value} ${noun}`;

/** The fixed English descriptor every page and sheet uses. No name — a name in an image prompt gets drawn as a label. */
export const renderAppearance = (a: Appearance): string => {
  const skin = withNoun(a.skin.trim(), 'skin', /skin|fur|feather|scale|coat|complexion/i);
  const hair = withNoun(
    a.hair.trim(),
    'hair',
    /hair|fur|bald|curls|braids|ponytail|pigtail|mane|feather|ears|whiskers|fluffy|spots|stripes|no /i,
  );
  return `${a.kind}, ${skin}, ${hair}, wearing ${a.outfit}, ${a.detail}`;
};

/** Cast member as the PLAN emits it (structured appearance). */
export const PlanCastMemberSchema = z.object({
  id: bibleId,
  /** Name as used in the Russian story text (e.g. "братик", "Миша"). */
  name: z.string().min(1),
  /** Role in the story, Russian, short (e.g. "младший брат"). */
  role: z.string().min(1),
  appearance: AppearanceSchema,
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

export const LocationSchema = z.object({
  id: bibleId,
  /** Russian name (e.g. "горка во дворе"). */
  name: z.string().min(1),
  /** Fixed English description: the key object, its materials/colours, surroundings. */
  descriptor,
});
export type Location = z.infer<typeof LocationSchema>;

export const PropSchema = z.object({ id: bibleId, descriptor });
export type Prop = z.infer<typeof PropSchema>;

const bibleBase = {
  locations: z.array(LocationSchema).min(1).max(MAX_LOCATIONS),
  props: z.array(PropSchema).max(MAX_PROPS),
  /** One English line fixed for the whole book: season, light, palette mood. */
  atmosphere: descriptor,
};

/** The bible as the PLAN emits it: structured appearance for the hero and every cast member. */
export const PlanVisualBibleSchema = z.object({
  hero: z.object({ name: z.string().min(1), appearance: AppearanceSchema }),
  cast: z.array(PlanCastMemberSchema).max(MAX_CAST),
  ...bibleBase,
});
export type PlanVisualBible = z.infer<typeof PlanVisualBibleSchema>;

/** The bible as the STORY persists it: rendered descriptors. */
export const VisualBibleSchema = z.object({
  hero: z.object({ name: z.string().min(1), descriptor }),
  cast: z.array(CastMemberSchema).max(MAX_CAST),
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
  locations: plan.locations,
  props: plan.props,
  atmosphere: plan.atmosphere,
});

export const TIME_OF_DAY = ['morning', 'day', 'evening', 'night'] as const;
export const FRAMING = ['wide', 'medium', 'close'] as const;

/** One page's selection from the bible. */
export const SceneSchema = z.object({
  locationId: bibleId,
  castIds: z.array(bibleId).max(MAX_CAST),
  propIds: z.array(bibleId).max(MAX_PROPS),
  heroOnPage: z.boolean(),
  timeOfDay: z.enum(TIME_OF_DAY),
  framing: z.enum(FRAMING),
});
export type Scene = z.infer<typeof SceneSchema>;
