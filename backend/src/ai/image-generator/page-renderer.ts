import { startActiveObservation } from '@langfuse/tracing';
import type { LanguageModel } from 'ai';
import type { Story } from '../schemas';
import { PAGE_TEMPLATES } from '../../pdf/page-templates/page-templates.config';
import type { ImageSize } from '../../pdf/page-templates/page-templates.config';
import { S3Service } from '../../s3/s3.service';
import { ImageContentPolicyError, ImageGenerationError } from './errors';
import { simplifyIllustrationPrompt } from './prompt-simplifier';
import { createTelemetry } from '../telemetry';
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
  variant: string;
  /** What the judge checks the picture against; omitted → no judging. */
  judgeContext?: ImageJudgeContext;
}

export interface RenderedPage {
  key: string;
  bytes: Uint8Array;
  /** Attempts made (1 = passed first time or judge off). */
  attempts: number;
}

interface Attempt {
  bytes: Uint8Array;
  failures: string[];
}

/**
 * PageRenderer (#348/#358) — renders ONE page: provider call with the
 * content-policy simplify-and-retry, then (when the judge is on) the vision
 * verdict and a fresh re-render of that page only while it fails, up to
 * `judge.maxRetries`. The attempt with the fewest failures is uploaded — a page
 * that never passes still ships (soft gate) with every attempt on record, so
 * the dashboard shows it and no book is blocked by a judge false negative.
 */
export class PageRenderer {
  constructor(
    private readonly deps: {
      provider: ImageProvider;
      s3: S3Service;
      textModel: LanguageModel;
      judge: ImageJudgeService | null;
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
          variant: opts.variant,
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
    const judge = this.deps.judge;
    const judging = Boolean(judge?.enabled && opts.judgeContext);
    const maxAttempts = judging ? 1 + (judge?.maxRetries ?? 0) : 1;
    let best: Attempt | null = null;
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      const bytes = await this.withSimplifyRetry(opts, imageSize);
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
    const verdict = await this.deps.judge!.judge({
      bookId: opts.bookId,
      pageNumber: opts.pageNumber,
      attempt,
      image: bytes,
      imageSize,
      context: opts.judgeContext!,
      references: opts.references,
      labels: opts.labels,
    });
    return verdict.passed ? [] : verdict.failures;
  }

  private async withSimplifyRetry(opts: RenderPageOpts, imageSize: ImageSize): Promise<Uint8Array> {
    const gen = (prompt: string): Promise<Uint8Array> =>
      this.deps.provider.generatePage({ prompt, imageSize, references: opts.references });
    try {
      return await gen(opts.prompt);
    } catch (err: unknown) {
      if (!(err instanceof ImageGenerationError) || !err.refused) throw err;
      const simplified = await simplifyIllustrationPrompt(
        opts.prompt,
        this.deps.textModel,
        createTelemetry('image-generation.simplify-prompt', {
          bookId: opts.bookId,
          pageNumber: opts.pageNumber,
        }),
      );
      try {
        return await gen(simplified);
      } catch (retryErr: unknown) {
        if (retryErr instanceof ImageGenerationError && retryErr.refused) {
          throw new ImageContentPolicyError(opts.pageNumber, simplified, retryErr);
        }
        throw retryErr;
      }
    }
  }
}
