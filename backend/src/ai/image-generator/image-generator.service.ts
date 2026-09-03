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
  DEFAULT_MAX_REFERENCE_IMAGES,
  GEMINI_IMAGE_MODEL,
  GENERATION_MODEL,
  MAX_REFERENCE_IMAGES,
  STYLE_SUFFIXES,
  type ArtStyle,
  type ImageProviderName,
} from '../ai.config';
import { pickReferences } from './pick-references';
import { buildIllustrationPrompt } from '../prompts/illustration.prompt';
import { buildPagePrompt } from '../prompts/image-portrait.prompt';
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
  // Photo flow (#128): a parent-approved portrait to anchor on (skip synthetic
  // portrait), plus the named-feature descriptor folded into every page prompt.
  approvedPortraitKey?: string | null;
  characterDescriptor?: string | null;
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
        : new GeminiImageProvider(
            config.getOrThrow<string>('GOOGLE_GENERATIVE_AI_API_KEY'),
            config.get<string>('GEMINI_IMAGE_MODEL') ?? GEMINI_IMAGE_MODEL,
          );
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
        input.story.pages.map((page, i) => {
          const req = this.buildPageRequest(input, page, portrait?.bytes);
          return this.generatePage({
            bookId: input.bookId,
            pageNumber: i + 1,
            prompt: req.prompt,
            references: req.references,
            labels: req.labels,
            template: page.template,
          });
        }),
      );

      span.update({ output: { count: imageKeys.length, portrait: portrait?.key ?? null } });
      return { imageKeys, characterPortraitKey: portrait?.key ?? null };
    });
  }

  // Photo → stylised portrait (#128, phase 1). Gemini-only (the photo path never
  // selects OpenAI); a refusal surfaces as ImageGenerationError for the caller.
  async generatePhotoPortrait(input: {
    photo: Uint8Array;
    descriptor: string;
    artStyle: ArtStyle;
  }): Promise<Uint8Array> {
    if (!this.provider.usesReference) {
      throw new Error('Photo portraits require the Gemini image provider');
    }
    return this.provider.generatePortraitFromPhoto(input);
  }

  private referenceBudget(): number {
    return MAX_REFERENCE_IMAGES[this.provider.modelLabel] ?? DEFAULT_MAX_REFERENCE_IMAGES;
  }

  // Assemble one page's final prompt + reference images. Visual Bible path (#348)
  // when the story carries a bible + scene; otherwise the legacy path.
  private buildPageRequest(
    input: ImageGenInput,
    page: Story['pages'][number],
    portraitBytes?: Uint8Array,
  ): { prompt: string; references: Uint8Array[]; labels: string[] } {
    const { visualBible } = input.story;
    if (visualBible && page.scene) {
      return this.biblePageRequest(input, page, portraitBytes);
    }
    return this.legacyPageRequest(input, page, portraitBytes);
  }

  private biblePageRequest(
    input: ImageGenInput,
    page: Story['pages'][number],
    portraitBytes?: Uint8Array,
  ): { prompt: string; references: Uint8Array[]; labels: string[] } {
    const bible = input.story.visualBible!;
    const scene = page.scene!;
    const heroPortrait = this.provider.usesReference ? portraitBytes : undefined;
    const { images, labels } = pickReferences({
      scene,
      sources: { heroPortrait },
      budget: this.referenceBudget(),
    });
    const heroDescriptor = input.characterDescriptor ?? bible.hero.descriptor;
    const prompt = buildIllustrationPrompt({
      bible,
      scene,
      action: page.illustrationPrompt,
      heroDescriptor,
      artStyle: input.artStyle,
      labels,
    });
    return { prompt, references: images, labels };
  }

  private legacyPageRequest(
    input: ImageGenInput,
    page: Story['pages'][number],
    portraitBytes?: Uint8Array,
  ): { prompt: string; references: Uint8Array[]; labels: string[] } {
    if (this.provider.usesReference) {
      const inner = input.characterDescriptor
        ? `${input.characterDescriptor}. ${page.illustrationPrompt}`
        : page.illustrationPrompt;
      const prompt = buildPagePrompt(inner, input.artStyle);
      return portraitBytes
        ? { prompt, references: [portraitBytes], labels: ['hero'] }
        : { prompt, references: [], labels: [] };
    }
    const prefix = input.story.characterProfile ? `${input.story.characterProfile}. ` : '';
    const prompt = `${prefix}${page.illustrationPrompt}${STYLE_SUFFIXES[input.artStyle]}`;
    return { prompt, references: [], labels: [] };
  }

  private async maybePortrait(
    input: ImageGenInput,
  ): Promise<{ key: string; bytes: Uint8Array } | null> {
    // Photo flow: reuse the parent-approved portrait; do not generate one.
    if (input.approvedPortraitKey) {
      const bytes = await this.s3.getObjectBytes(input.approvedPortraitKey);
      return { key: input.approvedPortraitKey, bytes };
    }
    const { characterProfile } = input.story;
    if (!this.provider.usesReference || !characterProfile) return null;
    return startActiveObservation('image-generation.portrait', async (span) => {
      const bytes = await this.provider.generatePortrait({
        characterProfile,
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
    references: Uint8Array[];
    labels: string[];
    template: Story['pages'][number]['template'];
  }): Promise<string> {
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
      references: Uint8Array[];
    },
    imageSize: (typeof PAGE_TEMPLATES)[keyof typeof PAGE_TEMPLATES]['images'][0]['imageSize'],
  ): Promise<Uint8Array> {
    const gen = (prompt: string): Promise<Uint8Array> =>
      this.provider.generatePage({
        prompt,
        imageSize,
        references: opts.references,
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
