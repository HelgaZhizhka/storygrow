/**
 * eval:image-judge (#358) — calibrate the vision judge against a labelled
 * manifest of rendered pages BEFORE the gate is switched on. Each entry names a
 * local image, the context the page was generated from, its reference images
 * and the expected verdict; the script runs the real ImageJudgeService with an
 * in-memory sink and prints precision / recall plus a per-item table
 * (markdown, paste into docs/process). Costs real Gemini vision calls.
 *
 *   pnpm --filter backend eval:image-judge --manifest=<path.json> [--out=<path.md>]
 *
 * Manifest entry: { id, image, imageSize, expected: 'pass'|'fail', context:
 * ImageJudgeContext, references?: [{ label, path }] }
 */
import '../instrument';
import { shutdownTelemetry } from '../instrument';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import type { ImageSize } from '../pdf/page-templates/page-templates.config';
import { ImageJudgeService } from '../ai/image-generator/image-judge.service';
import type { ImageEvalRow, ImageEvalSink } from '../ai/image-generator/image-eval.sink';
import type { ImageJudgeContext } from '../ai/prompts/image-judge.prompt';

interface ManifestEntry {
  id: string;
  image: string;
  imageSize: ImageSize;
  expected: 'pass' | 'fail';
  context: ImageJudgeContext;
  references?: Array<{ label: string; path: string }>;
}

interface Outcome {
  id: string;
  expected: 'pass' | 'fail';
  passed: boolean;
  failures: string[];
  reasoning: string;
}

const flag = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

class MemorySink implements ImageEvalSink {
  readonly rows: ImageEvalRow[] = [];
  record(row: ImageEvalRow): Promise<void> {
    this.rows.push(row);
    return Promise.resolve();
  }
}

const config = {
  get: (key: string): string | undefined => process.env[key],
  getOrThrow: (key: string): string => {
    const v = process.env[key];
    if (!v) throw new Error(`Missing env: ${key}`);
    return v;
  },
} as unknown as ConfigService;

const judgeEntry = async (
  judge: ImageJudgeService,
  sink: MemorySink,
  entry: ManifestEntry,
  base: string,
): Promise<Outcome> => {
  const refs = entry.references ?? [];
  const verdict = await judge.judge({
    bookId: `calib-${entry.id}`,
    pageNumber: 1,
    attempt: 1,
    image: readFileSync(resolve(base, entry.image)),
    imageSize: entry.imageSize,
    context: entry.context,
    references: refs.map((r) => readFileSync(resolve(base, r.path))),
    labels: refs.map((r) => r.label),
  });
  const row = sink.rows.find((r) => r.bookId === `calib-${entry.id}`);
  return {
    id: entry.id,
    expected: entry.expected,
    passed: verdict.passed,
    failures: verdict.failures,
    reasoning: row?.reasoning ?? '',
  };
};

const report = (outcomes: Outcome[]): string => {
  const tp = outcomes.filter((o) => o.expected === 'fail' && !o.passed).length;
  const fn = outcomes.filter((o) => o.expected === 'fail' && o.passed).length;
  const fp = outcomes.filter((o) => o.expected === 'pass' && !o.passed).length;
  const tn = outcomes.filter((o) => o.expected === 'pass' && o.passed).length;
  const pct = (a: number, b: number): string => (b === 0 ? 'n/a' : `${Math.round((100 * a) / b)}%`);
  const lines = [
    `| | judge FAIL | judge PASS |`,
    `|---|---|---|`,
    `| labelled FAIL | ${tp} | ${fn} |`,
    `| labelled PASS | ${fp} | ${tn} |`,
    ``,
    `Recall on bad pages: ${pct(tp, tp + fn)} · Precision of a FAIL: ${pct(tp, tp + fp)} · False-fail rate on good pages: ${pct(fp, fp + tn)} (n=${outcomes.length})`,
    ``,
    `| id | expected | judge | failures | reasoning |`,
    `|---|---|---|---|---|`,
    ...outcomes.map(
      (o) =>
        `| ${o.id} | ${o.expected} | ${o.passed ? 'pass' : 'FAIL'}${(o.expected === 'pass') === o.passed ? '' : ' ✗'} | ${o.failures.join(', ')} | ${o.reasoning.replace(/\|/g, '/').slice(0, 200)} |`,
    ),
  ];
  return lines.join('\n');
};

const main = async (): Promise<void> => {
  const manifestPath = flag('manifest');
  if (!manifestPath) {
    console.error('--manifest=<path.json> is required');
    process.exit(1);
  }
  const entries = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestEntry[];
  const base = dirname(resolve(manifestPath));
  const sink = new MemorySink();
  const judge = new ImageJudgeService(config, sink);
  const outcomes: Outcome[] = [];
  for (const entry of entries) {
    const o = await judgeEntry(judge, sink, entry, base);
    outcomes.push(o);
    console.log(`${o.passed ? 'pass' : 'FAIL'}  (${o.expected})  ${o.id}  ${o.failures.join(',')}`);
  }
  const md = report(outcomes);
  const out = flag('out');
  if (out) writeFileSync(out, md);
  console.log(`\n${md.split('\n').slice(0, 6).join('\n')}`);
  await shutdownTelemetry();
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
