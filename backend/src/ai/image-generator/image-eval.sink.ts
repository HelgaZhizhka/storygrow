import type { ImageJudgeResult } from '../schemas';

export interface ImageEvalRow {
  bookId: string;
  pageNumber: number;
  attempt: number;
  /** The judge's boolean criteria; `{}` when only the preflight ran. */
  scores: ImageJudgeResult | Record<string, never>;
  passed: boolean;
  failures: string[];
  reasoning: string | null;
}

/**
 * Where judge verdicts go (#358). Production binds the Prisma store
 * (`image-eval.store.ts`); the eval:images script substitutes an in-memory
 * sink. Kept free of Prisma imports so the judge is unit-testable on its own.
 */
export interface ImageEvalSink {
  record(row: ImageEvalRow): Promise<void>;
}

export const IMAGE_EVAL_SINK = Symbol('IMAGE_EVAL_SINK');
