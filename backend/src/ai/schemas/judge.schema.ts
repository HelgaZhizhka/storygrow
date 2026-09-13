import { z } from 'zod';

/** Score range for each judge criterion: 0 (worst) – 10 (best). */
const scoreField = () => z.number().int().min(0).max(10);

/**
 * Guardrail criteria — pass/fail gates (ADR-0005). Each must clear the guardrail
 * floor for a story to be accepted. They are NOT averaged into the craft signal.
 */
export const GUARDRAIL_KEYS = [
  'ageAppropriateVocab',
  'hasMoralLesson',
  'structureCompleteness',
  'safetyForChildren',
  'length',
  'earnedResolution',
] as const;

/**
 * JudgeScoreSchema — criterion scores produced by StoryEvaluator.
 *
 * Two groups (ADR-0005):
 *   - Guardrails (GUARDRAIL_KEYS): safety/structure/age gates, pass/fail.
 *   - Craft: `registerMatch` — the two-sided quality signal that drives
 *     regeneration. It is gated on its own and never diluted by averaging.
 */
export const JudgeScoreSchema = z.object({
  /** Vocabulary is appropriate for the child's age / grade level. */
  ageAppropriateVocab: scoreField().describe(
    "Vocabulary fits the child's age; heavy penalty for any non-Russian words.",
  ),

  /** Story contains a clear moral lesson tied to the learning goal. */
  hasMoralLesson: scoreField().describe('The story clearly teaches the stated learning goal.'),

  /** A complete narrative arc is present (setup → conflict → resolution). */
  structureCompleteness: scoreField().describe('A complete arc: setup → conflict → resolution.'),

  /** Content is safe; models no real-world danger the hero approaches. */
  safetyForChildren: scoreField().describe(
    'Content is safe; the resolution never rewards approaching a real danger.',
  ),

  /** Story length is appropriate for the target age. */
  length: scoreField().describe('Page count and content volume suit the target age.'),

  /**
   * The moral is EARNED, not asserted: a real stake/consequence precedes the
   * resolution (a flaw visibly costs the hero), and the ending follows from the
   * hero's own action — not instant forgiveness, luck, or a stated maxim.
   */
  earnedResolution: scoreField().describe(
    "The moral is earned by a real cost and the hero's own action, not announced.",
  ),

  /**
   * CRAFT signal (ADR-0005). Two-sided register match against the gold
   * exemplars (warm Сутеев read-aloud voice): score low both when the prose is
   * FLATTER than the exemplars (dry summary, no dialogue, feelings merely named)
   * and when it is MORE ORNATE (decorative adult similes/clichés, rare or
   * abstract words, word-painting of what the picture should show).
   */
  registerMatch: scoreField().describe(
    "Two-sided closeness to the gold exemplars' voice: low when flatter, low when more ornate.",
  ),

  /**
   * INFORMATIONAL (#367, not gated yet): the text names only things the
   * illustrations can show — the pages' fixed world (locations, cast, props).
   * Low when the prose invents objects, food, animals, weather or scenery
   * absent from the world («песок» where the world has only «трава»).
   */
  pictureConsistency: scoreField().describe(
    "Informational: the text names only what the illustrations' fixed world can show.",
  ),
});

export type JudgeScores = z.infer<typeof JudgeScoreSchema>;

/**
 * JudgeSchema — full evaluation result for one generation attempt.
 *
 * The headline `finalScore` stored on StoryEval is computed server-side from
 * these scores (see computeFinalScore) — the judge does not self-report it.
 */
export const JudgeSchema = z.object({
  scores: JudgeScoreSchema,

  reasoning: z
    .string()
    .min(1)
    .describe('2–3 sentences naming the register verdict and the concrete phrases that drove it.'),
});

export type JudgeResult = z.infer<typeof JudgeSchema>;

/**
 * Headline score = the craft signal (registerMatch). Guardrails are gates, not
 * averaged in — a high guardrail mean can no longer mask flat or ornate prose.
 * Stored as StoryEval.finalScore and tracked on the quality dashboard.
 */
export const computeFinalScore = (scores: JudgeScores): number => scores.registerMatch;

/** True when every guardrail criterion clears the floor. */
export const passesGuardrails = (scores: JudgeScores, floor: number): boolean =>
  GUARDRAIL_KEYS.every((key) => scores[key] >= floor);
