/**
 * Batch text-eval harness (#162) — systematic quality testing across a fixed
 * eval set, for objective before/after comparison of prompt/model changes.
 *
 * Runs the DEFAULT_SET (goal × age × mode combos spanning both arcs, both
 * modes, ages 5–6, and fallback-exemplar goals) through the text-only pipeline
 * (no images/PDF/DB), prints a per-run table + per-criterion aggregates, and
 * optionally writes JSON for diffing between runs.
 *
 * First-attempt quality only — no regeneration loop (the product metric is
 * "% of books passing on first attempt").
 *
 * Usage:
 *   pnpm --filter backend eval:batch [--only=<goal substring>] [--model=<id>]
 *                                    [--concurrency=N] [--out=path.json]
 * Examples:
 *   pnpm --filter backend eval:batch                       # full default set
 *   pnpm --filter backend eval:batch --only=Честность      # one goal's combos
 *   pnpm --filter backend eval:batch --out=/tmp/before.json
 *
 * Cost: ~$0.05–0.15 per run (gpt-5 prose dominates); the default 10-run set is
 * roughly $1. Traces land in LangFuse when LANGFUSE_* keys are set.
 */
import '../instrument';
import { shutdownTelemetry } from '../instrument';
import { writeFileSync } from 'node:fs';
import { createEvalServices, runTextEval, type EvalServices } from './lib/eval-run';
import {
  summarize,
  formatResultsTable,
  formatSummary,
  type EvalRunResult,
} from './lib/eval-aggregate';

interface EvalCase {
  goal: string;
  age: number;
  mode: 'child' | 'observer';
}

/**
 * The mini eval-set: both arcs, both protagonist modes, both flagship ages,
 * including goals with NO dedicated exemplar (Дружба, Любопытство…) so the
 * fallback-exemplar path is measured too. Ages 3–4 join after #196 ships.
 */
const DEFAULT_SET: readonly EvalCase[] = [
  // virtue
  { goal: 'Смелость', age: 6, mode: 'child' },
  { goal: 'Доброта', age: 5, mode: 'child' },
  { goal: 'Самостоятельность', age: 6, mode: 'observer' },
  { goal: 'Дружба', age: 5, mode: 'child' }, // fallback exemplar
  { goal: 'Любопытство и любовь к знаниям', age: 6, mode: 'child' }, // fallback exemplar
  // flaw
  { goal: 'Честность', age: 6, mode: 'child' },
  { goal: 'Управление гневом', age: 5, mode: 'child' },
  { goal: 'Делиться с другими', age: 6, mode: 'observer' },
  { goal: 'Терпение', age: 5, mode: 'child' },
  { goal: 'Бережное отношение к вещам', age: 6, mode: 'child' },
];

const flagValue = (name: string): string | undefined => {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag?.slice(`--${name}=`.length);
};

const runOne = async (
  services: EvalServices,
  evalCase: EvalCase,
  model: string | undefined,
): Promise<EvalRunResult> => {
  const started = Date.now();
  try {
    const { story, checks, arcType, avgChars, maxChars } = await runTextEval(services, {
      goalTitle: evalCase.goal,
      age: evalCase.age,
      mode: evalCase.mode,
      model,
    });
    return {
      goal: evalCase.goal,
      age: evalCase.age,
      mode: evalCase.mode,
      arcType,
      title: story.title,
      passed: checks.passed,
      registerMatch: checks.computedFinalScore,
      scores: checks.judgeResult.scores,
      structuralErrorCount: checks.structuralErrors.length,
      avgChars,
      maxChars,
      durationMs: Date.now() - started,
      error: null,
    };
  } catch (e: unknown) {
    return {
      goal: evalCase.goal,
      age: evalCase.age,
      mode: evalCase.mode,
      arcType: 'virtue',
      title: '',
      passed: false,
      registerMatch: 0,
      scores: {
        ageAppropriateVocab: 0,
        hasMoralLesson: 0,
        structureCompleteness: 0,
        safetyForChildren: 0,
        length: 0,
        earnedResolution: 0,
        registerMatch: 0,
      },
      structuralErrorCount: 0,
      avgChars: 0,
      maxChars: 0,
      durationMs: Date.now() - started,
      error: e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120),
    };
  }
};

/** Run cases with bounded concurrency, preserving input order in the results. */
const runPool = async (
  services: EvalServices,
  cases: readonly EvalCase[],
  model: string | undefined,
  concurrency: number,
): Promise<EvalRunResult[]> => {
  const results: EvalRunResult[] = new Array<EvalRunResult>(cases.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < cases.length) {
      const index = next++;
      const c = cases[index];
      console.log(`▸ [${index + 1}/${cases.length}] ${c.goal} (age ${c.age}, ${c.mode})…`);
      results[index] = await runOne(services, c, model);
      const r = results[index];
      console.log(
        r.error !== null
          ? `  ✗ ${c.goal}: ${r.error}`
          : `  ${r.passed ? '✓' : '·'} ${c.goal}: rm=${r.registerMatch} ${r.passed ? 'PASS' : 'fail'} (${Math.round(r.durationMs / 1000)}s)`,
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, worker));
  return results;
};

const main = async (): Promise<void> => {
  const only = flagValue('only')?.toLowerCase();
  const model = flagValue('model');
  const concurrency = Number(flagValue('concurrency') ?? '3');
  const out = flagValue('out');

  const cases = only ? DEFAULT_SET.filter((c) => c.goal.toLowerCase().includes(only)) : DEFAULT_SET;
  if (cases.length === 0) {
    console.error(
      `No cases match --only=${only}. Goals: ${DEFAULT_SET.map((c) => c.goal).join(', ')}`,
    );
    process.exit(1);
  }
  console.log(
    `Batch eval: ${cases.length} runs, concurrency ${concurrency}, model ${model ?? 'default'} (~$0.05–0.15/run)\n`,
  );

  const services = await createEvalServices();
  const started = Date.now();
  const results = await runPool(services, cases, model, concurrency);
  const summary = summarize(results);

  console.log('\n' + formatResultsTable(results));
  console.log('\n' + formatSummary(summary));
  console.log(`wall clock: ${Math.round((Date.now() - started) / 1000)}s`);

  if (out) {
    writeFileSync(
      out,
      JSON.stringify(
        { generatedAt: new Date().toISOString(), model: model ?? 'default', results, summary },
        null,
        2,
      ),
    );
    console.log(`\nJSON written: ${out}`);
  }

  await services.prisma.$disconnect();
  await shutdownTelemetry();
  // Non-zero exit when any run errored, so CI/scripts can gate on it.
  if (summary.failed > 0) process.exit(1);
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
