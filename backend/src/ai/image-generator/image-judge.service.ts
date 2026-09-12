import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { startActiveObservation } from '@langfuse/tracing';
import type { ImageSize } from '../../pdf/page-templates/page-templates.config';
import { GEMINI_VISION_MODEL, IMAGE_EVAL_MAX_RETRIES_DEFAULT } from '../ai.config';
import {
  ImageJudgeSchema,
  imageVerdict,
  type ImageJudgeResult,
  type ImageVerdict,
} from '../schemas';
import {
  IMAGE_JUDGE_SYSTEM,
  buildImageJudgeTask,
  referenceCaption,
  type ImageJudgeContext,
  type JudgeTaskMode,
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
 * and traced as an `image-judge` span. ON by default (calibrated 2026-09-06:
 * 0 false fails on 65 good pages, 10/13 bad pages caught — see
 * docs/process/image-judge-calibration-2026-09-06.md); IMAGE_EVAL=off disables.
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
    this.enabled = (config.get<string>('IMAGE_EVAL') ?? 'on') !== 'off';
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
    const full = await this.ask(input, 'full');
    if (full.ok) return this.record(input, full.result, []);
    // A safety block on the task text (#369): retry without the action, so the
    // picture is still checked for identity, cast, location and artefacts.
    const fallback = full.blockReason ? await this.ask(input, 'identity') : null;
    if (fallback?.ok) {
      return this.record(input, fallback.result, [
        `judge:blocked:${full.blockReason}:identity-only`,
      ]);
    }
    const reason = fallback?.blockReason ?? full.blockReason;
    const failures = [reason ? `judge:blocked:${reason}` : 'judge:unavailable'];
    this.logger.warn(`Judge gave no verdict for page ${input.pageNumber}: ${failures[0]}`);
    await this.persist(input, { passed: true, failures }, {}, full.error);
    return { passed: true, failures };
  }

  private async ask(input: JudgePageInput, mode: JudgeTaskMode): Promise<AskResult> {
    try {
      const { object } = await generateObject({
        model: this.google(GEMINI_VISION_MODEL),
        schema: ImageJudgeSchema,
        system: IMAGE_JUDGE_SYSTEM,
        messages: [{ role: 'user', content: this.buildContent(input, mode) }],
        experimental_telemetry: createTelemetry('image-judge', {
          bookId: input.bookId,
          pageNumber: input.pageNumber,
          attempt: input.attempt,
          mode,
        }),
      });
      return { ok: true, result: object };
    } catch (err: unknown) {
      return { ok: false, blockReason: blockReasonOf(err), error: String(err).slice(0, 300) };
    }
  }

  /** Persist a real verdict; `notes` carries a non-failing annotation such as the identity-only fallback. */
  private async record(
    input: JudgePageInput,
    result: ImageJudgeResult,
    notes: string[],
  ): Promise<ImageVerdict> {
    const verdict = imageVerdict(result);
    const annotated = { passed: verdict.passed, failures: [...verdict.failures, ...notes] };
    await this.persist(input, annotated, result, result.reasoning);
    return annotated;
  }

  // Page image first, then each reference with a caption so the model compares
  // against the right picture. The cascade 'prev' reference is not a judge input.
  private buildContent(input: JudgePageInput, mode: JudgeTaskMode): JudgeContent {
    const portraitPassed = input.labels.some(
      (label, i) => label === 'hero' && !!input.references[i],
    );
    const content: JudgeContent = [
      { type: 'text', text: buildImageJudgeTask(input.context, portraitPassed, mode) },
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

type AskResult =
  | { ok: true; result: ImageJudgeResult }
  | { ok: false; blockReason: string | null; error: string };

/** Gemini reports a safety block as HTTP 200 with `promptFeedback.blockReason`; the SDK throws "Invalid JSON response". */
const blockReasonOf = (err: unknown): string | null => {
  const body = (err as { responseBody?: unknown })?.responseBody;
  if (typeof body !== 'string') return null;
  const match = /"blockReason"\s*:\s*"(\w+)"/.exec(body);
  return match ? match[1] : null;
};
