import { imageCostUsd } from '../ai/ai.config';

/** The ImageEval columns the dashboard reads (#379). */
export interface ImageEvalRowLite {
  bookId: string;
  run: number;
  pageNumber: number;
  attempt: number;
  passed: boolean;
  failures: string[];
  model: string | null;
  labels: string[];
}

/** The Book columns the artefact cost reads. */
export interface BookArtefactsLite {
  imageModel: string | null;
  characterPortraitKey: string | null;
  referenceImageKeys: string[];
}

export interface ModelCost {
  model: string;
  /** Page renders (one ImageEval row each). */
  pages: number;
  /** Portraits + reference sheets. */
  artefacts: number;
  usd: number;
}

export interface ImageMetrics {
  windowDays: number;
  /** Page renders judged in the window (every attempt). */
  attempts: number;
  /** Distinct pages (book + run + page). */
  pages: number;
  /** Share of pages whose first attempt passed. */
  firstAttemptPassRate: number | null;
  reRenders: number;
  /** No verdict: the judge was blocked by a safety filter or unavailable. */
  blocked: number;
  unavailable: number;
  /** Failure criteria by count, most frequent first (judge annotations excluded). */
  topFailures: Array<{ criterion: string; count: number }>;
  costByModel: ModelCost[];
}

const UNKNOWN_MODEL = 'unknown (before #379)';

export const computeImageMetrics = (input: {
  rows: ImageEvalRowLite[];
  books: BookArtefactsLite[];
  windowDays: number;
}): ImageMetrics => {
  const { rows, books, windowDays } = input;
  const firstAttempts = rows.filter((r) => r.attempt === 1);
  const pages = new Set(rows.map((r) => `${r.bookId}/${r.run}/${r.pageNumber}`)).size;
  return {
    windowDays,
    attempts: rows.length,
    pages,
    firstAttemptPassRate:
      firstAttempts.length > 0
        ? firstAttempts.filter((r) => r.passed).length / firstAttempts.length
        : null,
    reRenders: rows.filter((r) => r.attempt > 1).length,
    blocked: rows.filter((r) => r.failures.some((f) => f.startsWith('judge:blocked'))).length,
    unavailable: rows.filter((r) => r.failures.includes('judge:unavailable')).length,
    topFailures: topFailures(rows),
    costByModel: costByModel(rows, books),
  };
};

const topFailures = (rows: ImageEvalRowLite[]): Array<{ criterion: string; count: number }> => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const f of row.failures) {
      if (f.startsWith('judge:')) continue;
      counts.set(f, (counts.get(f) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([criterion, count]) => ({ criterion, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
};

// Cost is derived at read time from IMAGE_COST_USD: a page render is priced with
// its reference count, a portrait or sheet without references. The vision judge
// is not included. Rows and books from before #379 carry no model and are
// listed under one "unknown" line rather than priced with a guess.
const costByModel = (rows: ImageEvalRowLite[], books: BookArtefactsLite[]): ModelCost[] => {
  const acc = new Map<string, ModelCost>();
  const line = (model: string): ModelCost => {
    const existing = acc.get(model);
    if (existing) return existing;
    const fresh = { model, pages: 0, artefacts: 0, usd: 0 };
    acc.set(model, fresh);
    return fresh;
  };
  for (const row of rows) {
    const l = line(row.model ?? UNKNOWN_MODEL);
    l.pages++;
    l.usd += row.model ? imageCostUsd(row.model, row.labels.length) : 0;
  }
  for (const book of books) {
    const count = (book.characterPortraitKey ? 1 : 0) + book.referenceImageKeys.length;
    if (count === 0) continue;
    const l = line(book.imageModel ?? UNKNOWN_MODEL);
    l.artefacts += count;
    l.usd += book.imageModel ? count * imageCostUsd(book.imageModel, 0) : 0;
  }
  return [...acc.values()]
    .map((l) => ({ ...l, usd: Math.round(l.usd * 100) / 100 }))
    .sort((a, b) => b.usd - a.usd);
};
