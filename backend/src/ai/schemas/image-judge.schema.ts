import { z } from 'zod';

/**
 * Visible artefact classes the image judge (#358) reports. Each is a hard fail:
 * a child notices a third arm or a word floating in the sky long before an
 * adult does, and none can be fixed by a prompt rule after the fact.
 *   extraLimbs   — extra / missing / fused limbs or fingers
 *   mergedFaces  — two faces or bodies blended into one
 *   textInImage  — letters, words, signs, labels drawn in the picture
 *   wrongSurface — a person or object placed where a body cannot be (a child
 *                  standing ON the slide chute the text has them climbing
 *                  beside, an adult inside / fused with play equipment,
 *                  floating)
 */
export const IMAGE_ARTEFACTS = [
  'extraLimbs',
  'mergedFaces',
  'textInImage',
  'wrongSurface',
] as const;
export type ImageArtefact = (typeof IMAGE_ARTEFACTS)[number];

/**
 * ImageJudgeSchema — one vision-model verdict on one rendered page. Boolean
 * criteria, not scores: a vision model answers "is X true in this picture" far
 * more reliably than it grades on a 0–10 scale. `null` = not applicable (no
 * portrait / no cast / no adult on the page), never "unsure".
 */
export const ImageJudgeSchema = z.object({
  /** The child matches the hero reference portrait (face, hair, outfit). null when no portrait was given. */
  heroMatch: z
    .boolean()
    .nullable()
    .describe(
      'The child is the same as in the HERO portrait reference (face, hair, outfit); null when no portrait was given.',
    ),
  /** The hero appears exactly once. null when the hero is not expected on the page. */
  heroOnce: z
    .boolean()
    .nullable()
    .describe('The hero appears exactly once; null when the hero is not expected on the page.'),
  /** The page's described ACTION is what the picture shows (who does what, where). null in the identity-only fallback (no action given). */
  sceneMatch: z
    .boolean()
    .nullable()
    .describe(
      'The MAIN event of the page action is what the picture shows; null only in the identity-only check.',
    ),
  /** Each cast member matches their reference / description. null when no cast on the page. */
  castConsistency: z
    .boolean()
    .nullable()
    .describe(
      'Each cast member matches their reference portrait or description (hair colour, length, outfit); null when none expected.',
    ),
  /** The place matches the location reference / description. null when none was given. */
  locationConsistency: z
    .boolean()
    .nullable()
    .describe('The place matches the LOCATION reference or description; null when none given.'),
  /**
   * People and objects are in believable proportion to the child, and an object
   * the text calls tall / big reads as such (#366: a "sky-high" slide drawn
   * toddler-sized makes the child a giant). null when nothing on the page can
   * be compared with the child.
   */
  proportionsNatural: z
    .boolean()
    .nullable()
    .describe(
      'People and objects in believable proportion to the child; an object called tall reads tall; null when nothing to compare.',
    ),
  /** Suitable for a preschool picture book (no fear, injury, weapons, nudity). */
  ageSafe: z
    .boolean()
    .describe('Suitable for a preschool picture book: no fear, injury, weapons, nudity.'),
  artefacts: z
    .array(z.enum(IMAGE_ARTEFACTS))
    .describe(
      'Every visible artefact: extraLimbs, mergedFaces, textInImage, wrongSurface. Empty when none.',
    ),
  reasoning: z
    .string()
    .min(1)
    .describe('One or two sentences naming what was checked and what failed.'),
});

export type ImageJudgeResult = z.infer<typeof ImageJudgeSchema>;

export interface ImageVerdict {
  passed: boolean;
  /** Failed criteria, e.g. 'sceneMatch', 'artefact:textInImage', 'preflight:aspect'. */
  failures: string[];
}

const GATES: ReadonlyArray<keyof Omit<ImageJudgeResult, 'artefacts' | 'reasoning'>> = [
  'heroMatch',
  'heroOnce',
  'sceneMatch',
  'castConsistency',
  'locationConsistency',
  'proportionsNatural',
  'ageSafe',
];

/**
 * Deterministic verdict from a judge result: every applicable gate must be
 * true and no artefact may be present. `null` gates are skipped. Kept pure so
 * the pass rule is unit-testable and shared with the calibration script.
 */
export const imageVerdict = (result: ImageJudgeResult): ImageVerdict => {
  const failures = GATES.filter((gate) => result[gate] === false).map(String);
  const artefacts = result.artefacts.map((a) => `artefact:${a}`);
  const all = [...failures, ...artefacts];
  return { passed: all.length === 0, failures: all };
};
