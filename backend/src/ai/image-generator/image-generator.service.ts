import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { startActiveObservation } from '@langfuse/tracing';
import { generateImage } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { type Story } from '../schemas';
import { PAGE_TEMPLATES } from '../../pdf/page-templates/page-templates.config';
import { S3Service } from '../../s3/s3.service';
import { IMAGE_MODEL, IMAGE_QUALITY, IMAGE_STYLE_SUFFIX, GENERATION_MODEL } from '../ai.config';
import { ImageContentPolicyError } from './errors';
import { simplifyIllustrationPrompt } from './prompt-simplifier';
import { createTelemetry } from '../telemetry';

const IMAGE_GEN_MAX_RETRIES = 1;

export interface ImageGenInput {
  story: Story;
  bookId: string;
}

@Injectable()
export class ImageGeneratorService {
  private readonly logger = new Logger(ImageGeneratorService.name);
  private readonly textModel: LanguageModel;

  constructor(
    private readonly s3: S3Service,
    config: ConfigService,
  ) {
    this.textModel = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') })(
      GENERATION_MODEL,
    );
  }

  async generate(input: ImageGenInput): Promise<string[]> {
    return startActiveObservation(`image-generation`, async (span) => {
      span.update({
        input: { bookId: input.bookId, pageCount: input.story.pages.length },
        metadata: { bookId: input.bookId },
      });

      const keys = await Promise.all(
        input.story.pages.map((page, index) =>
          this.generateOne({
            bookId: input.bookId,
            pageNumber: index + 1,
            prompt: page.illustrationPrompt,
            template: page.template,
          }),
        ),
      );

      span.update({ output: { count: keys.length } });
      return keys;
    });
  }

  private async generateOne(opts: {
    bookId: string;
    pageNumber: number;
    prompt: string;
    template: Story['pages'][number]['template'];
  }): Promise<string> {
    return startActiveObservation(`image-generation.page-${opts.pageNumber}`, async (span) => {
      const slot = PAGE_TEMPLATES[opts.template].images[0];
      if (!slot) {
        throw new Error(`Template '${opts.template}' has no image slot configured`);
      }

      const key = await this.generateWithFallback({
        ...opts,
        imageSize: slot.imageSize,
        span,
      });
      return key;
    });
  }

  private async generateWithFallback(opts: {
    bookId: string;
    pageNumber: number;
    prompt: string;
    imageSize: (typeof PAGE_TEMPLATES)[keyof typeof PAGE_TEMPLATES]['images'][0]['imageSize'];
    span: { update: (data: Record<string, unknown>) => void };
  }): Promise<string> {
    const { bookId, pageNumber, imageSize, span } = opts;

    const tryGenerate = async (prompt: string): Promise<string> => {
      const fullPrompt = `${prompt}${IMAGE_STYLE_SUFFIX}`;
      span.update({
        input: { prompt: fullPrompt, size: imageSize },
        metadata: { bookId, pageNumber, model: IMAGE_MODEL },
      });
      const result = await generateImage({
        model: openai.imageModel(IMAGE_MODEL),
        prompt: fullPrompt,
        size: imageSize,
        maxRetries: IMAGE_GEN_MAX_RETRIES,
        providerOptions: { openai: { quality: IMAGE_QUALITY } },
      });
      const buffer = Buffer.from(result.image.base64, 'base64');
      const key = `books/${bookId}/page-${pageNumber}.png`;
      await this.s3.uploadObject({ key, body: buffer, contentType: 'image/png' });
      return key;
    };

    try {
      const key = await tryGenerate(opts.prompt);
      span.update({ output: { key, contentType: 'image/png' } });
      this.logger.log(`Generated image for book ${bookId} page ${pageNumber}`);
      return key;
    } catch (err: unknown) {
      if (!isContentPolicyError(err)) throw err;

      this.logger.warn(
        `Page ${pageNumber} rejected by safety filter — simplifying prompt and retrying`,
      );
      const simplified = await simplifyIllustrationPrompt(
        opts.prompt,
        this.textModel,
        createTelemetry(`image-generation.simplify-prompt`, { bookId, pageNumber }),
      );
      this.logger.log(`Simplified prompt for page ${pageNumber}: ${simplified}`);

      try {
        const key = await tryGenerate(simplified);
        span.update({ output: { key, contentType: 'image/png', promptSimplified: true } });
        this.logger.log(`Generated image (simplified) for book ${bookId} page ${pageNumber}`);
        return key;
      } catch (retryErr: unknown) {
        if (isContentPolicyError(retryErr)) {
          throw new ImageContentPolicyError(pageNumber, simplified, retryErr);
        }
        throw retryErr;
      }
    }
  }
}

function isContentPolicyError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object') {
    const code = (cause as Record<string, unknown>).code;
    if (code === 'content_policy_violation') return true;
    const responseBody = (cause as Record<string, unknown>).responseBody;
    if (typeof responseBody === 'string' && responseBody.includes('content_policy_violation')) {
      return true;
    }
  }

  const message = err.message.toLowerCase();
  return (
    message.includes('content_policy_violation') ||
    message.includes('safety system') ||
    message.includes('content policy')
  );
}
