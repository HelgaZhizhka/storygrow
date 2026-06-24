import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { startActiveObservation } from '@langfuse/tracing';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { type Story } from '../schemas';
import { PAGE_TEMPLATES } from '../../pdf/page-templates/page-templates.config';
import { S3Service } from '../../s3/s3.service';
import {
  DEFAULT_IMAGE_PROVIDER,
  GENERATION_MODEL,
  type ArtStyle,
  type ImageProviderName,
} from '../ai.config';
import { ImageContentPolicyError, ImageGenerationError } from './errors';
import { simplifyIllustrationPrompt } from './prompt-simplifier';
import { createTelemetry } from '../telemetry';
import type { ImageProvider } from './providers/image-provider.interface';
import { OpenAiImageProvider } from './providers/openai-image.provider';
import { GeminiImageProvider } from './providers/gemini-image.provider';

export interface ImageGenInput {
  story: Story;
  bookId: string;
  artStyle: ArtStyle;
}

export interface ImageGenResult {
  imageKeys: string[];
  characterPortraitKey: string | null;
}

@Injectable()
export class ImageGeneratorService {
  private readonly logger = new Logger(ImageGeneratorService.name);
  private readonly textModel: LanguageModel;
  private readonly provider: ImageProvider;

  constructor(
    private readonly s3: S3Service,
    config: ConfigService,
  ) {
    this.textModel = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') })(
      GENERATION_MODEL,
    );
    const name = (config.get<string>('IMAGE_PROVIDER') ??
      DEFAULT_IMAGE_PROVIDER) as ImageProviderName;
    this.provider =
      name === 'openai'
        ? new OpenAiImageProvider()
        : new GeminiImageProvider(config.getOrThrow<string>('GOOGLE_GENERATIVE_AI_API_KEY'));
    this.logger.log(`Image provider: ${name} (${this.provider.modelLabel})`);
  }

  async generate(input: ImageGenInput): Promise<ImageGenResult> {
    return startActiveObservation('image-generation', async (span) => {
      span.update({
        input: { bookId: input.bookId, pageCount: input.story.pages.length },
        metadata: { bookId: input.bookId, provider: this.provider.modelLabel },
      });

      const portrait = await this.maybePortrait(input);
      const imageKeys = await Promise.all(
        input.story.pages.map((page, i) =>
          this.generatePage({
            bookId: input.bookId,
            pageNumber: i + 1,
            prompt: this.pagePrompt(input.story, page),
            template: page.template,
            artStyle: input.artStyle,
            reference: portrait?.bytes,
          }),
        ),
      );

      span.update({ output: { count: imageKeys.length, portrait: portrait?.key ?? null } });
      return { imageKeys, characterPortraitKey: portrait?.key ?? null };
    });
  }

  private pagePrompt(story: Story, page: Story['pages'][number]): string {
    if (this.provider.usesReference) return page.illustrationPrompt;
    const prefix = story.characterProfile ? `${story.characterProfile}. ` : '';
    return `${prefix}${page.illustrationPrompt}`;
  }

  private async maybePortrait(
    input: ImageGenInput,
  ): Promise<{ key: string; bytes: Uint8Array } | null> {
    if (!this.provider.usesReference || !input.story.characterProfile) return null;
    return startActiveObservation('image-generation.portrait', async (span) => {
      const bytes = await this.provider.generatePortrait({
        characterProfile: input.story.characterProfile as string,
        artStyle: input.artStyle,
      });
      const key = `books/${input.bookId}/portrait.png`;
      await this.s3.uploadObject({ key, body: Buffer.from(bytes), contentType: 'image/png' });
      span.update({ output: { key } });
      return { key, bytes };
    });
  }

  private async generatePage(opts: {
    bookId: string;
    pageNumber: number;
    prompt: string;
    template: Story['pages'][number]['template'];
    artStyle: ArtStyle;
    reference?: Uint8Array;
  }): Promise<string> {
    return startActiveObservation(`image-generation.page-${opts.pageNumber}`, async (span) => {
      const slot = PAGE_TEMPLATES[opts.template].images[0];
      if (!slot) throw new Error(`Template '${opts.template}' has no image slot configured`);
      span.update({ metadata: { bookId: opts.bookId, pageNumber: opts.pageNumber } });
      const bytes = await this.withSimplifyRetry(opts, slot.imageSize);
      const key = `books/${opts.bookId}/page-${opts.pageNumber}.png`;
      await this.s3.uploadObject({ key, body: Buffer.from(bytes), contentType: 'image/png' });
      span.update({ output: { key } });
      return key;
    });
  }

  private async withSimplifyRetry(
    opts: {
      bookId: string;
      pageNumber: number;
      prompt: string;
      artStyle: ArtStyle;
      reference?: Uint8Array;
    },
    imageSize: (typeof PAGE_TEMPLATES)[keyof typeof PAGE_TEMPLATES]['images'][0]['imageSize'],
  ): Promise<Uint8Array> {
    const gen = (prompt: string): Promise<Uint8Array> =>
      this.provider.generatePage({
        prompt,
        artStyle: opts.artStyle,
        imageSize,
        reference: opts.reference,
      });
    try {
      return await gen(opts.prompt);
    } catch (err: unknown) {
      if (!(err instanceof ImageGenerationError) || !err.refused) throw err;
      const simplified = await simplifyIllustrationPrompt(
        opts.prompt,
        this.textModel,
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
