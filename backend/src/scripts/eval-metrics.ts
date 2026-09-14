/**
 * Offline prose metrics over frozen story JSONs (Suteev refactor phase 0).
 * No LLM, no DB, no env — the same numbers `eval:batch` prints, computed from
 * a `--stories-out` directory (or any dir of Story JSONs) so a baseline can be
 * taken on stories already on disk and re-taken after every prompt change.
 *
 * Usage:
 *   pnpm --filter backend eval:metrics --dir=<stories dir> [--out=path.json] [--hero=Алиса]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { StorySchema, type Story } from '../ai/schemas';
import {
  measureProse,
  measureBatchDiversity,
  summarizeMetrics,
  formatMetricsSummary,
  type ProseMetrics,
} from './lib/prose-metrics';

const flagValue = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(`--${name}=`.length);

const loadStories = (dir: string): { file: string; story: Story }[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({
      file: basename(f, '.json'),
      story: StorySchema.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))),
    }));

const pad = (s: string, w: number): string => s.padEnd(w).slice(0, Math.max(w, s.length));

const formatRow = (file: string, m: ProseMetrics, title: string): string =>
  [
    pad(file, 44),
    pad(String(m.words), 5),
    pad(`${Math.round(m.dialogueShare * 100)}%`, 4),
    pad(String(m.heroNamePerSentence), 5),
    pad(String(m.questionTics), 3),
    pad(m.moralFormulaOnFinal ? 'yes' : '-', 5),
    pad(`${m.castNamed}/${m.castTotal}`, 4),
    pad(String(m.refrainLines), 3),
    pad(m.titleStopword ? 'yes' : '-', 4),
    `«${title}»`,
  ].join(' ');

const main = (): void => {
  const dir = flagValue('dir');
  if (!dir) {
    console.error('Usage: eval:metrics --dir=<stories dir> [--out=path.json] [--hero=Алиса]');
    process.exit(1);
  }
  const hero = flagValue('hero') ?? 'Алиса';
  const loaded = loadStories(dir);
  const rows = loaded.map(({ file, story }) => ({
    file,
    title: story.title,
    metrics: measureProse(story, hero),
  }));
  const header = `${pad('story', 44)} ${pad('words', 5)} ${pad('dlg', 4)} ${pad('name', 5)} ${pad('tic', 3)} ${pad('moral', 5)} ${pad('cast', 4)} ${pad('ref', 3)} ${pad('stop', 4)} title`;
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const r of rows) console.log(formatRow(r.file, r.metrics, r.title));
  const summary = summarizeMetrics(rows.map((r) => r.metrics));
  const diversity = measureBatchDiversity(loaded.map((l) => l.story));
  console.log('\n' + formatMetricsSummary(summary, rows.length));
  console.log(
    `repeated props: ${diversity.repeatedProps.map((p) => `${p.name}×${p.count}`).join(', ') || 'none'}`,
  );
  console.log(
    `repeated locations: ${diversity.repeatedLocations.map((p) => `${p.name}×${p.count}`).join(', ') || 'none'}`,
  );
  const out = flagValue('out');
  if (out) {
    writeFileSync(
      out,
      JSON.stringify(
        { generatedAt: new Date().toISOString(), dir, hero, rows, summary, diversity },
        null,
        2,
      ),
    );
    console.log(`\nJSON written: ${out}`);
  }
};

main();
