import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { startActiveObservation } from '@langfuse/tracing';
import type { ImageSize } from '../../pdf/page-templates/page-templates.config';
import { GEMINI_VISION_MODEL, IMAGE_EVAL_MAX_RETRIES_DEFAULT } from '../ai.config';
import { ImageJudgeSchema, imageVerdict, type ImageVerdict } from '../schemas';
import {
  IMAGE_JUDGE_SYSTEM,
  buildImageJudgeTask,
  referenceCaption,
  type ImageJudgeContext,
} from '../prompts/image-judge.prompt';
import { createTelemetry } from '../telemetry';
import { preflightImage } from './png-size';
import { IMAGE_EVAL_SINK, type ImageEvalSink } from './image-eval.sink';

export interface JudgePageInput {
  bookId: string;
  pageNumber: number;
  attempt: number;
  image: Uint8Array;
  imageSize: ImageSize;
  context: ImageJudgeContext;
  /** The references the page was generated from, aligned with `labels` (pickReferences). */
  references: ReadonlyArray<Uint8Array>;
  labels: ReadonlyArray<string>;
}

type JudgeContent = Array<
  { type: 'text'; text: string } | { type: 'image'; image: Uint8Array; mediaType: string }
>;

/**
 * ImageJudgeService (#358) — the general safety net for illustration
 * correctness. A vision model answers boolean questions about one rendered page
 * against its action line and the very references it was generated from; a
 * deterministic preflight (bytes, aspect) runs first so no vision call is spent
 * on a broken file. Every verdict is persisted (one row per page per attempt)
 * and traced as an `image-judge` span. Gated by IMAGE_EVAL until calibrated.
 */
@Injectable()
export class ImageJudgeService {
  private readonly logger = new Logger(ImageJudgeService.name);
  private readonly google: GoogleGenerativeAIProvider;
  readonly enabled: boolean;
  readonly maxRetries: number;

  constructor(
    config: ConfigService,
    @Inject(IMAGE_EVAL_SINK) private readonly sink: ImageEvalSink,
  ) {
    this.google = createGoogleGenerativeAI({
      apiKey: config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY') ?? '',
    });
    this.enabled = (config.get<string>('IMAGE_EVAL') ?? 'off') === 'on';
    const raw = parseInt(config.get<string>('IMAGE_EVAL_MAX_RETRIES') ?? '', 10);
    this.maxRetries = Number.isNaN(raw) ? IMAGE_EVAL_MAX_RETRIES_DEFAULT : raw;
  }

  /** Judge one attempt and persist the verdict. Never throws on a judge failure: a broken judge must not fail a book. */
  async judge(input: JudgePageInput): Promise<ImageVerdict> {
    return startActiveObservation(`image-judge.page-${input.pageNumber}`, async (span) => {
      span.update({
        metadata: { bookId: input.bookId, pageNumber: input.pageNumber, attempt: input.attempt },
      });
      const verdict = await this.verdictFor(input);
      span.update({ output: verdict });
      return verdict;
    });
  }

  private async verdictFor(input: JudgePageInput): Promise<ImageVerdict> {
    const preflight = preflightImage(input.image, input.imageSize);
    if (preflight.length > 0) {
      const verdict = { passed: false, failures: preflight };
      await this.persist(input, verdict, {}, null);
      return verdict;
    }
    try {
      const { object } = await generateObject({
        model: this.google(GEMINI_VISION_MODEL),
        schema: ImageJudgeSchema,
        system: IMAGE_JUDGE_SYSTEM,
        messages: [{ role: 'user', content: this.buildContent(input) }],
        experimental_telemetry: createTelemetry('image-judge', {
          bookId: input.bookId,
          pageNumber: input.pageNumber,
          attempt: input.attempt,
        }),
      });
      const verdict = imageVerdict(object);
      await this.persist(input, verdict, object, object.reasoning);
      return verdict;
    } catch (err: unknown) {
      this.logger.warn(`Judge unavailable for page ${input.pageNumber}: ${String(err)}`);
      return { passed: true, failures: ['judge:unavailable'] };
    }
  }

  // Page image first, then each reference with a caption so the model compares
  // against the right picture. The cascade 'prev' reference is not a judge input.
  private buildContent(input: JudgePageInput): JudgeContent {
    const content: JudgeContent = [
      { type: 'text', text: buildImageJudgeTask(input.context) },
      { type: 'image', image: input.image, mediaType: 'image/png' },
    ];
    input.labels.forEach((label, i) => {
      const bytes = input.references[i];
      if (label === 'prev' || !bytes) return;
      const castName = label.startsWith('cast:')
        ? input.context.cast.find((c) => c.id === label.slice(5))?.name
        : undefined;
      content.push({ type: 'text', text: referenceCaption(label, castName) });
      content.push({ type: 'image', image: bytes, mediaType: 'image/png' });
    });
    return content;
  }

  private async persist(
    input: JudgePageInput,
    verdict: ImageVerdict,
    scores: ImageEvalRowScores,
    reasoning: string | null,
  ): Promise<void> {
    await this.sink.record({
      bookId: input.bookId,
      pageNumber: input.pageNumber,
      attempt: input.attempt,
      scores,
      passed: verdict.passed,
      failures: verdict.failures,
      reasoning,
    });
  }
}

type ImageEvalRowScores = Parameters<ImageEvalSink['record']>[0]['scores'];
