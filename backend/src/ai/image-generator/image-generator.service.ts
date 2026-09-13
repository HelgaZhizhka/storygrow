import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { startActiveObservation } from '@langfuse/tracing';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { type Story } from '../schemas';
import { S3Service } from '../../s3/s3.service';
import {
  GENERATION_MODEL,
  STYLE_SUFFIXES,
  parseImageProvider,
  type ArtStyle,
  type ImageProviderName,
} from '../ai.config';
import { pickReferences } from './pick-references';
import { buildIllustrationPrompt } from '../prompts/illustration.prompt';
import { buildPagePrompt } from '../prompts/image-portrait.prompt';
import type { ImageProvider } from './providers/image-provider.interface';
import { OpenAiImageProvider } from './providers/openai-image.provider';
import { GeminiImageProvider } from './providers/gemini-image.provider';
import { XaiImageProvider } from './providers/xai-image.provider';
import { ReferenceSheetsService, type SheetSet } from './reference-sheets.service';
import { ImageJudgeService } from './image-judge.service';
import { PageRenderer } from './page-renderer';
import type { ImageJudgeContext } from '../prompts/image-judge.prompt';

export interface ImageGenInput {
  story: Story;
  bookId: string;
  artStyle: ArtStyle;
  // Photo flow (#128): a parent-approved portrait to anchor on (skip synthetic
  // portrait), plus the named-feature descriptor folded into every page prompt.
  approvedPortraitKey?: string | null;
  characterDescriptor?: string | null;
  /** Generation run of the book: 1 on first generation, +1 per retry (#374). Default 1. */
  run?: number;
  /**
   * Artefacts of an earlier run of the SAME story to reuse instead of buying
   * again (#374): the portrait and the reference sheets. The caller passes them
   * only when the story was not regenerated.
   */
  reuse?: { portraitKey: string | null; referenceImageKeys: string[] };
  /** Called as soon as portrait + sheets exist, so a crash mid-pages does not lose them. */
  onArtefacts?: (artefacts: {
    characterPortraitKey: string | null;
    referenceImageKeys: string[];
  }) => Promise<void>;
}

export interface ImageGenResult {
  imageKeys: string[];
  characterPortraitKey: string | null;
  /** S3 keys of generated reference sheets (#348, PR 2); empty when the flag is off. */
  referenceImageKeys: string[];
}

/** Inputs for assembling one page's prompt + references (object-param, rule #13). */
interface PageBuildContext {
  input: ImageGenInput;
  page: Story['pages'][number];
  portraitBytes?: Uint8Array;
  sheets?: SheetSet | null;
}

interface PageRequest {
  prompt: string;
  references: Uint8Array[];
  labels: string[];
  /** What the image judge (#358) checks this page against. */
  judgeContext: ImageJudgeContext;
}

@Injectable()
export class ImageGeneratorService {
  private readonly logger = new Logger(ImageGeneratorService.name);
  private readonly textModel: LanguageModel;
  private readonly provider: ImageProvider;
  private readonly pages: PageRenderer;

  // The judge is a REQUIRED dependency (#373): the first real run after #362
  // had it silently off because it was declared optional. Scripts construct it
  // with an in-memory sink; nothing runs the image pipeline without a judge.
  constructor(
    private readonly s3: S3Service,
    config: ConfigService,
    private readonly referenceSheets: ReferenceSheetsService,
    judge: ImageJudgeService,
  ) {
    this.textModel = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') })(
      GENERATION_MODEL,
    );
    const name = parseImageProvider(config.get<string>('IMAGE_PROVIDER'));
    this.provider = buildProvider(name, config);
    this.pages = new PageRenderer({
      provider: this.provider,
      s3,
      textModel: this.textModel,
      judge,
    });
    this.logger.log(
      `Image provider: ${name} (${this.provider.modelLabel}); judge on, max re-renders ${judge.maxRetries}`,
    );
  }

  async generate(input: ImageGenInput): Promise<ImageGenResult> {
    return startActiveObservation('image-generation', async (span) => {
      span.update({
        input: { bookId: input.bookId, pageCount: input.story.pages.length },
        metadata: { bookId: input.bookId, provider: this.provider.modelLabel },
      });

      const portrait = await this.maybePortrait(input);
      const sheets = await this.maybeSheets(input);
      await input.onArtefacts?.({
        characterPortraitKey: portrait?.key ?? null,
        referenceImageKeys: sheets?.keys ?? [],
      });
      const imageKeys = await this.generatePages(input, portrait?.bytes, sheets);

      span.update({ output: { count: imageKeys.length, portrait: portrait?.key ?? null } });
      return {
        imageKeys,
        characterPortraitKey: portrait?.key ?? null,
        referenceImageKeys: sheets?.keys ?? [],
      };
    });
  }

  // Every page is composed fresh, in parallel, from the same references
  // (ADR-0007). The cascade experiment (page N edited from page N−1) was
  // removed in #372: it inherited poses and bled locations.
  private generatePages(
    input: ImageGenInput,
    portraitBytes: Uint8Array | undefined,
    sheets: SheetSet | null,
  ): Promise<string[]> {
    return Promise.all(
      input.story.pages.map(async (page, i) => {
        const req = this.buildPageRequest({ input, page, portraitBytes, sheets });
        const { key } = await this.pages.render({
          ...req,
          bookId: input.bookId,
          pageNumber: i + 1,
          template: page.template,
          run: input.run ?? 1,
        });
        return key;
      }),
    );
  }

  // Generate location + cast reference sheets once per book (#348, PR 2) — always
  // on since ADR-0007's amendment (cast drifted without them); only for the
  // bible path on a reference-capable provider. Returns null when not applicable.
  private async maybeSheets(input: ImageGenInput): Promise<SheetSet | null> {
    const bible = input.story.visualBible;
    if (!this.provider.usesReference || !bible) return null;
    const reusable = input.reuse?.referenceImageKeys ?? [];
    if (reusable.length > 0) return this.referenceSheets.load(reusable);
    return this.referenceSheets.generate({
      bookId: input.bookId,
      bible,
      artStyle: input.artStyle,
      provider: this.provider,
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

  // Assemble one page's final prompt + reference images. Visual Bible path (#348)
  // when the story carries a bible + scene; otherwise the legacy path.
  private buildPageRequest(ctx: PageBuildContext): PageRequest {
    const { input, page } = ctx;
    if (input.story.visualBible && page.scene) {
      return this.biblePageRequest(ctx);
    }
    return this.legacyPageRequest(ctx);
  }

  private biblePageRequest(ctx: PageBuildContext): PageRequest {
    const { input, page, portraitBytes, sheets } = ctx;
    const bible = input.story.visualBible!;
    const scene = page.scene!;
    const heroPortrait = this.provider.usesReference ? portraitBytes : undefined;
    const { images, labels } = pickReferences({
      scene,
      sources: {
        heroPortrait,
        castSheets: sheets?.castSheets,
        locationSheet: sheets?.locationSheets[scene.locationId],
      },
      budget: this.provider.maxReferences,
    });
    const heroDescriptor = input.characterDescriptor ?? bible.hero.descriptor;
    const prompt = buildIllustrationPrompt({
      bible,
      scene,
      action: page.illustrationPrompt,
      heroDescriptor,
      artStyle: input.artStyle,
    });
    const judgeContext: ImageJudgeContext = {
      action: page.illustrationPrompt,
      heroDescriptor: scene.heroOnPage ? heroDescriptor : null,
      cast: bible.cast.filter((c) => scene.castIds.includes(c.id)),
      location: bible.locations.find((l) => l.id === scene.locationId)?.descriptor ?? null,
    };
    return { prompt, references: images, labels, judgeContext };
  }

  private legacyPageRequest(ctx: PageBuildContext): PageRequest {
    const { input, page, portraitBytes } = ctx;
    const judgeContext: ImageJudgeContext = {
      action: page.illustrationPrompt,
      heroDescriptor: input.characterDescriptor ?? input.story.characterProfile ?? null,
      cast: [],
    };
    if (this.provider.usesReference) {
      const inner = input.characterDescriptor
        ? `${input.characterDescriptor}. ${page.illustrationPrompt}`
        : page.illustrationPrompt;
      const prompt = buildPagePrompt(inner, input.artStyle);
      return portraitBytes
        ? { prompt, references: [portraitBytes], labels: ['hero'], judgeContext }
        : { prompt, references: [], labels: [], judgeContext };
    }
    const prefix = input.story.characterProfile ? `${input.story.characterProfile}. ` : '';
    const prompt = `${prefix}${page.illustrationPrompt}${STYLE_SUFFIXES[input.artStyle]}`;
    return { prompt, references: [], labels: [], judgeContext };
  }

  private async maybePortrait(
    input: ImageGenInput,
  ): Promise<{ key: string; bytes: Uint8Array } | null> {
    // Photo flow: reuse the parent-approved portrait; a retry of the same story
    // (#374) reuses the portrait of the earlier run. Neither generates one.
    const existing = input.approvedPortraitKey ?? input.reuse?.portraitKey;
    if (existing) {
      const bytes = await this.s3.getObjectBytes(existing);
      return { key: existing, bytes };
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
}

const buildProvider = (name: ImageProviderName, config: ConfigService): ImageProvider => {
  switch (name) {
    case 'xai':
      return new XaiImageProvider(config.getOrThrow<string>('XAI_API_KEY'));
    case 'gemini':
      return new GeminiImageProvider(config.getOrThrow<string>('GOOGLE_GENERATIVE_AI_API_KEY'));
    case 'openai':
      return new OpenAiImageProvider();
  }
};
