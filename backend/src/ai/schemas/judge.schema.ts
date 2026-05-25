import { z } from 'zod';

/** Score range for each judge criterion: 0 (worst) – 10 (best). */
const scoreField = () => z.number().int().min(0).max(10);

/**
 * JudgeScoreSchema — individual criterion scores produced by StoryEvaluator.
 *
 * Each criterion is independently rated 0–10. The mean across all five
 * is the finalScore compared against the eval threshold (default 7.0).
 */
export const JudgeScoreSchema = z.object({
  /** Vocabulary is appropriate for the child's age / grade level. */
  ageAppropriateVocab: scoreField(),

  /** Story contains a clear moral lesson tied to the learning goal. */
  hasMoralLesson: scoreField(),

  /**
   * All four narrative stages are present and coherent:
   * setup → conflict → lesson → resolution.
   */
  structureCompleteness: scoreField(),

  /** Content is safe, non-violent, and appropriate for children. */
  safetyForChildren: scoreField(),

  /** Story length is appropriate for the target age (not too short/long). */
  length: scoreField(),
});

export type JudgeScores = z.infer<typeof JudgeScoreSchema>;

/**
 * JudgeSchema — full evaluation result for one generation attempt.
 *
 * Stored as `judgeScores` (JSON) + `finalScore` in the StoryEval table.
 * If finalScore < EVAL_THRESHOLD, the story is regenerated (max 2 retries).
 */
export const JudgeSchema = z.object({
  scores: JudgeScoreSchema,

  /**
   * Judge's concise reasoning explaining the scores.
   * Used for debugging and audit trail in LangFuse traces.
   */
  reasoning: z.string().min(1),

  /**
   * Mean of all five criterion scores, rounded to 2 decimal places.
   * Compared against EVAL_THRESHOLD to decide regeneration.
   */
  finalScore: z.number().min(0).max(10),
});

export type JudgeResult = z.infer<typeof JudgeSchema>;

/** Compute finalScore from raw criterion scores. */
export const computeFinalScore = (scores: JudgeScores): number => {
  const values = Object.values(scores);
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / values.length) * 100) / 100;
};
