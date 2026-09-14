import { startActiveObservation } from '@langfuse/tracing';
import type { Story } from '../schemas';
import { PAGE_TEMPLATES } from '../../pdf/page-templates/page-templates.config';
import type { ImageSize } from '../../pdf/page-templates/page-templates.config';
import { S3Service } from '../../s3/s3.service';
import { ImageContentPolicyError, ImageGenerationError } from './errors';
import type { ImageProvider } from './providers/image-provider.interface';
import type { ImageJudgeService } from './image-judge.service';
import type { ImageJudgeContext } from '../prompts/image-judge.prompt';

export interface RenderPageOpts {
  bookId: string;
  pageNumber: number;
  prompt: string;
  references: Uint8Array[];
  labels: string[];
  template: Story['pages'][number]['template'];
  /** Generation run of the book (#374); ImageEval attempts are numbered per run. */
  run: number;
  /** What the judge checks the picture against; omitted → no judging. */
  judgeContext?: ImageJudgeContext;
}

export interface RenderedPage {
  key: string;
  bytes: Uint8Array;
  /** Attempts made (1 = passed first time, or no judge context). */
  attempts: number;
}

interface Attempt {
  bytes: Uint8Array;
  failures: string[];
}

/**
 * PageRenderer (#348/#358) — renders ONE page: the provider call, then the
 * vision verdict and a fresh re-render of that page only while it fails, up to
 * `judge.maxRetries`. A provider refusal (content policy) fails the page loud
 * as ImageContentPolicyError with the prompt attached — the DALL-E-era
 * simplifier that cut the prompt to 150 characters (losing hero and setting)
 * was deleted in #375. The attempt with the fewest failures is uploaded — a page
 * that never passes still ships (soft gate) with every attempt on record, so
 * the dashboard shows it and no book is blocked by a judge false negative.
 */
export class PageRenderer {
  constructor(
    private readonly deps: {
      provider: ImageProvider;
      s3: S3Service;
      judge: ImageJudgeService;
    },
  ) {}

  render(opts: RenderPageOpts): Promise<RenderedPage> {
    return startActiveObservation(`image-generation.page-${opts.pageNumber}`, async (span) => {
      const slot = PAGE_TEMPLATES[opts.template].images[0];
      if (!slot) throw new Error(`Template '${opts.template}' has no image slot configured`);
      span.update({
        metadata: {
          bookId: opts.bookId,
          pageNumber: opts.pageNumber,
          references: opts.labels,
        },
      });
      const { best, attempts } = await this.renderJudged(opts, slot.imageSize);
      const key = `books/${opts.bookId}/page-${opts.pageNumber}.png`;
      await this.deps.s3.uploadObject({
        key,
        body: Buffer.from(best.bytes),
        contentType: 'image/png',
      });
      span.update({ output: { key, attempts, failures: best.failures } });
      return { key, bytes: best.bytes, attempts };
    });
  }

  private async renderJudged(
    opts: RenderPageOpts,
    imageSize: ImageSize,
  ): Promise<{ best: Attempt; attempts: number }> {
    const judging = Boolean(opts.judgeContext);
    const maxAttempts = judging ? 1 + this.deps.judge.maxRetries : 1;
    let best: Attempt | null = null;
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      const bytes = await this.renderOnce(opts, imageSize);
      const failures = judging ? await this.judgeAttempt(opts, imageSize, bytes, attempt) : [];
      const current = { bytes, failures };
      if (!best || current.failures.length < best.failures.length) best = current;
      if (failures.length === 0) break;
    }
    return { best: best!, attempts: attempt };
  }

  private async judgeAttempt(
    opts: RenderPageOpts,
    imageSize: ImageSize,
    bytes: Uint8Array,
    attempt: number,
  ): Promise<string[]> {
    const verdict = await this.deps.judge.judge({
      bookId: opts.bookId,
      pageNumber: opts.pageNumber,
      attempt,
      run: opts.run,
      image: bytes,
      imageSize,
      context: opts.judgeContext!,
      references: opts.references,
      labels: opts.labels,
    });
    return verdict.passed ? [] : verdict.failures.filter((f) => !f.startsWith('judge:'));
  }

  private async renderOnce(opts: RenderPageOpts, imageSize: ImageSize): Promise<Uint8Array> {
    try {
      return await this.deps.provider.generatePage({
        prompt: opts.prompt,
        imageSize,
        references: opts.references,
      });
    } catch (err: unknown) {
      if (err instanceof ImageGenerationError && err.refused) {
        throw new ImageContentPolicyError(opts.pageNumber, opts.prompt, err);
      }
      throw err;
    }
  }
}
