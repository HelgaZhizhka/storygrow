/**
 * eval:images (#348, PR 3) — render a FROZEN set of Story fixtures through the
 * real image pipeline for ONE variant, so Baseline vs Bible vs Bible+sheets can
 * be compared on the SAME stories (only the image path varies; text is never
 * regenerated). Images land under output/eval-images/<variant>/<fixture>/ and a
 * JSON summary records counts, reference-sheet keys, and per-fixture timing.
 * LangFuse (when configured) carries per-span cost/latency and the `variant`
 * page metadata for the A/B read.
 *
 * Fixtures come from `eval:batch --stories-out=<dir>` (frozen once). Costs real
 * Gemini image generation — run deliberately.
 *
 * Usage:
 *   pnpm --filter backend eval:images --variant=baseline|bible|bible+sheets \
 *        --stories=<dir> [--only=<substr>] [--max-pages=N] [--out=path.json]
 */
import '../instrument';
import { shutdownTelemetry } from '../instrument';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { S3Service } from '../s3/s3.service';
import { ImageGeneratorService } from '../ai/image-generator/image-generator.service';
import { ReferenceSheetsService } from '../ai/image-generator/reference-sheets.service';
import { ImageJudgeService } from '../ai/image-generator/image-judge.service';
import type { ImageEvalRow, ImageEvalSink } from '../ai/image-generator/image-eval.sink';
import type { Story } from '../ai/schemas';
import type { ArtStyle } from '../ai/ai.config';
import {
  IMAGE_VARIANTS,
  sheetsFlagFor,
  cascadeFor,
  storyForVariant,
  evalBookId,
  type ImageVariant,
} from './lib/eval-images-lib';

const OUT_ROOT = 'output/eval-images';
const ART_STYLE: ArtStyle = 'watercolor';

const flag = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const makeConfig = (sheets: 'on' | 'off'): ConfigService =>
  ({
    get: (key: string): string | undefined =>
      key === 'IMAGE_REFERENCE_SHEETS' ? sheets : process.env[key],
    getOrThrow: (key: string): string => {
      const v = process.env[key];
      if (v == null || v === '') throw new Error(`Missing env: ${key}`);
      return v;
    },
  }) as unknown as ConfigService;

/** In-memory ImageEval sink (#358): verdicts land in the summary JSON, not the DB. */
class MemoryImageEvalSink implements ImageEvalSink {
  readonly rows: ImageEvalRow[] = [];
  record(row: ImageEvalRow): Promise<void> {
    this.rows.push(row);
    return Promise.resolve();
  }
}

const buildService = (
  variant: ImageVariant,
): { service: ImageGeneratorService; s3: S3Service; evals: MemoryImageEvalSink } => {
  const config = makeConfig(sheetsFlagFor(variant));
  const s3 = new S3Service(config);
  s3.onModuleInit();
  const evals = new MemoryImageEvalSink();
  const judge = new ImageJudgeService(config, evals);
  const service = new ImageGeneratorService(s3, config, new ReferenceSheetsService(s3), judge);
  return { service, s3, evals };
};

interface FixtureResult {
  fixture: string;
  pages: number;
  referenceImageKeys: string[];
  durationMs: number;
  error: string | null;
  /** Judge verdicts for this fixture (IMAGE_EVAL=on), one per page per attempt. */
  evals: ImageEvalRow[];
}

const loadFixtures = (dir: string, only?: string): { name: string; story: Story }[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => (only ? f.toLowerCase().includes(only) : true))
    .map((f) => ({
      name: basename(f, '.json'),
      story: JSON.parse(readFileSync(join(dir, f), 'utf8')) as Story,
    }));

interface RenderCtx {
  service: ImageGeneratorService;
  s3: S3Service;
  evals: MemoryImageEvalSink;
  variant: ImageVariant;
  maxPages?: number;
}

const evalsFor = (ctx: RenderCtx, bookId: string): ImageEvalRow[] =>
  ctx.evals.rows.filter((r) => r.bookId === bookId);

/** "5/7 pass, 2 retried, failed: p3(sceneMatch)" */
const summariseEvals = (rows: ImageEvalRow[]): string => {
  const pages = new Set(rows.map((r) => r.pageNumber));
  const finalByPage = [...pages].map(
    (p) => rows.filter((r) => r.pageNumber === p).sort((a, b) => b.attempt - a.attempt)[0],
  );
  const passed = finalByPage.filter((r) => r.passed).length;
  const retried = finalByPage.filter((r) => r.attempt > 1).length;
  const failed = finalByPage
    .filter((r) => !r.passed)
    .map((r) => `p${r.pageNumber}(${r.failures.join(',')})`);
  return `${passed}/${pages.size} pass, ${retried} retried${failed.length ? `, failed: ${failed.join(' ')}` : ''}`;
};

const renderFixture = async (
  ctx: RenderCtx,
  fixture: { name: string; story: Story },
): Promise<FixtureResult> => {
  const started = Date.now();
  try {
    let story = storyForVariant(fixture.story, ctx.variant);
    if (ctx.maxPages) story = { ...story, pages: story.pages.slice(0, ctx.maxPages) };
    const bookId = evalBookId(ctx.variant, fixture.name);
    const result = await ctx.service.generate({
      story,
      bookId,
      artStyle: ART_STYLE,
      cascade: cascadeFor(ctx.variant),
    });

    const dir = join(OUT_ROOT, ctx.variant, fixture.name);
    mkdirSync(dir, { recursive: true });
    await Promise.all(
      result.imageKeys.map(async (key, i) => {
        const bytes = await ctx.s3.getObjectBytes(key);
        writeFileSync(join(dir, `page-${i + 1}.png`), Buffer.from(bytes));
      }),
    );
    return {
      fixture: fixture.name,
      pages: result.imageKeys.length,
      referenceImageKeys: result.referenceImageKeys,
      durationMs: Date.now() - started,
      error: null,
      evals: evalsFor(ctx, bookId),
    };
  } catch (e: unknown) {
    return {
      fixture: fixture.name,
      pages: 0,
      referenceImageKeys: [],
      durationMs: Date.now() - started,
      error: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
      evals: [],
    };
  }
};

const main = async (): Promise<void> => {
  const variant = flag('variant') as ImageVariant | undefined;
  const stories = flag('stories');
  const only = flag('only')?.toLowerCase();
  const maxPages = flag('max-pages') ? Number(flag('max-pages')) : undefined;
  const out = flag('out');

  if (!variant || !IMAGE_VARIANTS.includes(variant)) {
    console.error(`--variant must be one of: ${IMAGE_VARIANTS.join(', ')}`);
    process.exit(1);
  }
  if (!stories) {
    console.error('--stories=<dir> is required (freeze fixtures via eval:batch --stories-out)');
    process.exit(1);
  }

  const fixtures = loadFixtures(stories, only);
  if (fixtures.length === 0) {
    console.error(`No fixtures in ${stories}${only ? ` matching ${only}` : ''}`);
    process.exit(1);
  }

  console.log(
    `eval:images variant=${variant} fixtures=${fixtures.length}` +
      `${maxPages ? ` maxPages=${maxPages}` : ''} — real Gemini image generation`,
  );
  const { service, s3, evals } = buildService(variant);
  const results: FixtureResult[] = [];
  for (const fixture of fixtures) {
    console.log(`▸ ${fixture.name}…`);
    const r = await renderFixture({ service, s3, evals, variant, maxPages }, fixture);
    results.push(r);
    const judged = r.evals.length > 0 ? `, judge ${summariseEvals(r.evals)}` : '';
    console.log(
      r.error
        ? `  ✗ ${r.error}`
        : `  ✓ ${r.pages} pages, ${r.referenceImageKeys.length} sheets${judged} (${Math.round(r.durationMs / 1000)}s)`,
    );
  }

  const summary = { generatedAt: new Date().toISOString(), variant, results };
  const outPath = out ?? join(OUT_ROOT, `${variant}.json`);
  mkdirSync(OUT_ROOT, { recursive: true });
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nImages: ${join(OUT_ROOT, variant)}/  ·  summary: ${outPath}`);

  await shutdownTelemetry();
  if (results.some((r) => r.error !== null)) process.exit(1);
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
