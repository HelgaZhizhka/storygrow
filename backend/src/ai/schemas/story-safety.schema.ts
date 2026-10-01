import { z } from 'zod';

/**
 * StorySafety — the BLOCKING safety verdict on a finished tale (ADR-0008
 * decision 5, spec 2026-09-23 §6). Read as a gate, never as a score: `fail`
 * rejects the attempt; an error, timeout or unparsable answer is treated as
 * `fail` by the caller (fail closed). Kept apart from every informational
 * judge criterion so the two can never be confused.
 *
 * Boundary: ADR-0004 v2 — the hero's imitable acts, not the scary element.
 */
export const StorySafetySchema = z.object({
  verdict: z.enum(['pass', 'fail']),
  reasons: z
    .array(z.string().min(1))
    .describe(
      'Пустой список при pass. При fail — по одной причине на нарушение, с цитатой из текста.',
    ),
});

export type StorySafety = z.infer<typeof StorySafetySchema>;
