import { Injectable, Logger } from '@nestjs/common';
import { startActiveObservation } from '@langfuse/tracing';
import { generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { type Story } from '../schemas';
import { PAGE_TEMPLATES } from '../../pdf/page-templates/page-templates.config';
import { S3Service } from '../../s3/s3.service';
import { IMAGE_MODEL, IMAGE_QUALITY, IMAGE_STYLE_SUFFIX } from '../ai.config';
import { ImageContentPolicyError } from './errors';

const IMAGE_GEN_MAX_RETRIES = 1;

export interface ImageGenInput {
  story: Story;
  bookId: string;
}

@Injectable()
export class ImageGeneratorService {
  private readonly logger = new Logger(ImageGeneratorService.name);

  constructor(private readonly s3: S3Service) {}

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
      const fullPrompt = `${opts.prompt}${IMAGE_STYLE_SUFFIX}`;
      span.update({
        input: { prompt: fullPrompt, size: slot.imageSize },
        metadata: {
          bookId: opts.bookId,
          pageNumber: opts.pageNumber,
          template: opts.template,
          model: IMAGE_MODEL,
        },
      });

      let result;
      try {
        result = await generateImage({
          model: openai.imageModel(IMAGE_MODEL),
          prompt: fullPrompt,
          size: slot.imageSize,
          maxRetries: IMAGE_GEN_MAX_RETRIES,
          providerOptions: { openai: { quality: IMAGE_QUALITY } },
        });
      } catch (err: unknown) {
        if (isContentPolicyError(err)) {
          throw new ImageContentPolicyError(opts.pageNumber, opts.prompt, err);
        }
        throw err;
      }

      const buffer = Buffer.from(result.image.base64, 'base64');
      const key = `books/${opts.bookId}/page-${opts.pageNumber}.png`;
      await this.s3.uploadObject({ key, body: buffer, contentType: 'image/png' });

      span.update({ output: { key, contentType: 'image/png' } });
      this.logger.log(`Generated image for book ${opts.bookId} page ${opts.pageNumber}`);
      return key;
    });
  }
}

function isContentPolicyError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  // Primary: AI SDK APICallError has a structured cause with the OpenAI response body
  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object') {
    const code = (cause as Record<string, unknown>).code;
    if (code === 'content_policy_violation') return true;
    // OpenAI embeds the error in the response body JSON
    const responseBody = (cause as Record<string, unknown>).responseBody;
    if (typeof responseBody === 'string' && responseBody.includes('content_policy_violation')) {
      return true;
    }
  }

  // Fallback: string-match on the error message
  const message = err.message.toLowerCase();
  return (
    message.includes('content_policy_violation') ||
    message.includes('safety system') ||
    message.includes('content policy')
  );
}
