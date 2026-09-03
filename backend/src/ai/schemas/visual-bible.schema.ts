import { z } from 'zod';
import { DESCRIPTOR_MAX_CHARS, MAX_CAST, MAX_LOCATIONS, MAX_PROPS } from '../ai.config';

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

export const CastMemberSchema = z.object({
  id: bibleId,
  /** Name as used in the Russian story text (e.g. "братик", "Миша"). */
  name: z.string().min(1),
  /** Role in the story, Russian, short (e.g. "младший брат"). */
  role: z.string().min(1),
  /** Fixed English descriptor: kind/age + hair + outfit + one distinctive detail. */
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

export const VisualBibleSchema = z.object({
  hero: z.object({ name: z.string().min(1), descriptor }),
  cast: z.array(CastMemberSchema).max(MAX_CAST),
  locations: z.array(LocationSchema).min(1).max(MAX_LOCATIONS),
  props: z.array(PropSchema).max(MAX_PROPS),
  /** One English line fixed for the whole book: season, light, palette mood. */
  atmosphere: descriptor,
});
export type VisualBible = z.infer<typeof VisualBibleSchema>;

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
