/**
 * Pure aggregation/formatting for batch text-eval runs (#162). No I/O, no LLM —
 * unit-tested; the LLM-calling side lives in eval-run.ts / eval-batch.ts.
 */
import type { JudgeScores } from '../../ai/schemas';

export interface EvalRunResult {
  goal: string;
  age: number;
  mode: 'child' | 'observer';
  arcType: 'virtue' | 'flaw';
  /** Generated book title ('' when the run errored). */
  title: string;
  passed: boolean;
  registerMatch: number;
  scores: JudgeScores;
  structuralErrorCount: number;
  avgChars: number;
  maxChars: number;
  durationMs: number;
  /** Non-null when the run threw — such runs are excluded from score aggregates. */
  error: string | null;
}

export interface CriterionStats {
  mean: number;
  min: number;
}

export interface BatchSummary {
  completed: number;
  failed: number;
  /** Share of completed runs that passed the evaluator (0 when none completed). */
  passRate: number;
  criteria: Record<keyof JudgeScores, CriterionStats>;
  totalDurationMs: number;
}

const CRITERIA: readonly (keyof JudgeScores)[] = [
  'ageAppropriateVocab',
  'hasMoralLesson',
  'structureCompleteness',
  'safetyForChildren',
  'length',
  'earnedResolution',
  'registerMatch',
];

export const summarize = (results: readonly EvalRunResult[]): BatchSummary => {
  const completed = results.filter((r) => r.error === null);
  const criteria = {} as Record<keyof JudgeScores, CriterionStats>;
  for (const key of CRITERIA) {
    const values = completed.map((r) => r.scores[key]);
    criteria[key] =
      values.length === 0
        ? { mean: 0, min: 0 }
        : {
            mean: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
          };
  }
  return {
    completed: completed.length,
    failed: results.length - completed.length,
    passRate:
      completed.length === 0 ? 0 : completed.filter((r) => r.passed).length / completed.length,
    criteria,
    totalDurationMs: results.reduce((a, r) => a + r.durationMs, 0),
  };
};

const pad = (s: string, width: number): string =>
  s.padEnd(width).slice(0, Math.max(width, s.length));

export const formatResultsTable = (results: readonly EvalRunResult[]): string => {
  const header = `${pad('goal', 28)} ${pad('age', 3)} ${pad('mode', 8)} ${pad('arc', 6)} ${pad('result', 6)} ${pad('rm', 4)} ${pad('struct', 6)} ${pad('avg/max', 9)} ${pad('sec', 5)} title`;
  const rows = results.map((r) => {
    if (r.error !== null) {
      return `${pad(r.goal, 28)} ${pad(String(r.age), 3)} ${pad(r.mode, 8)} ${pad(r.arcType, 6)} ERROR: ${r.error}`;
    }
    const result = r.passed ? 'PASS' : 'fail';
    return `${pad(r.goal, 28)} ${pad(String(r.age), 3)} ${pad(r.mode, 8)} ${pad(r.arcType, 6)} ${pad(result, 6)} ${pad(String(r.registerMatch), 4)} ${pad(String(r.structuralErrorCount), 6)} ${pad(`${r.avgChars}/${r.maxChars}`, 9)} ${pad(String(Math.round(r.durationMs / 1000)), 5)} «${r.title}»`;
  });
  return [header, '-'.repeat(header.length), ...rows].join('\n');
};

export const formatSummary = (s: BatchSummary): string => {
  const passedCount = Math.round(s.passRate * s.completed);
  const lines = [
    `pass rate: ${passedCount}/${s.completed} (${(s.passRate * 100).toFixed(0)}%)` +
      (s.failed > 0 ? ` | errored runs: ${s.failed}` : ''),
    `total wall time: ${Math.round(s.totalDurationMs / 1000)}s`,
    'criterion            mean   min',
  ];
  for (const [key, stats] of Object.entries(s.criteria)) {
    lines.push(
      `${pad(key, 20)} ${stats.mean.toFixed(1).padStart(4)}  ${String(stats.min).padStart(4)}`,
    );
  }
  return lines.join('\n');
};
