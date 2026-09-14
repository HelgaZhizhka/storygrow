import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { startActiveObservation } from '@langfuse/tracing';
import { type Story } from '../schemas';
import { S3Service } from '../../s3/s3.service';
import { bookKeys } from '../../s3/book-keys';
import { parseImageProvider, type ArtStyle, type ImageProviderName } from '../ai.config';
import { pickReferences } from './pick-references';
import { buildIllustrationPrompt } from '../prompts/illustration.prompt';
import type { ImageProvider } from './providers/image-provider.interface';
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
    /** The model that rendered them (#379), for cost per provider. */
    imageModel: string;
  }) => Promise<void>;
  /** Called after each page is rendered (#379): per-page progress for the SSE stream. */
  onPage?: (page: {
    done: number;
    total: number;
    pageNumber: number;
    attempts: number;
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
  private readonly provider: ImageProvider;
  private readonly pages: PageRenderer;

  // The judge is a REQUIRED dependency (#373): the first real run after #362
  // had it silently off because it was declared optional. Scripts construct it
  // with an in-memory sink; nothing runs the image pipeline without a judge.
  // eslint-disable-next-line max-params -- NestJS injects dependencies through the constructor; there is no object-parameter form
  constructor(
    private readonly s3: S3Service,
    config: ConfigService,
    private readonly referenceSheets: ReferenceSheetsService,
    judge: ImageJudgeService,
  ) {
    const name = parseImageProvider(config.get<string>('IMAGE_PROVIDER'));
    this.provider = buildProvider(name, config);
    this.pages = new PageRenderer({
      provider: this.provider,
      s3,
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
        imageModel: this.provider.modelLabel,
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
    const total = input.story.pages.length;
    let done = 0;
    return Promise.all(
      input.story.pages.map(async (page, i) => {
        const req = this.buildPageRequest({ input, page, portraitBytes, sheets });
        const { key, attempts } = await this.pages.render({
          ...req,
          bookId: input.bookId,
          pageNumber: i + 1,
          template: page.template,
          run: input.run ?? 1,
        });
        done++;
        await input.onPage?.({ done, total, pageNumber: i + 1, attempts });
        return key;
      }),
    );
  }

  // Generate location + cast reference sheets once per book (#348, PR 2) — always
  // on since ADR-0007's amendment (cast drifted without them). Returns null
  // when the story has no bible (a hard error later, in buildPageRequest).
  private async maybeSheets(input: ImageGenInput): Promise<SheetSet | null> {
    const bible = input.story.visualBible;
    if (!bible) return null;
    const reusable = input.reuse?.referenceImageKeys ?? [];
    if (reusable.length > 0) return this.referenceSheets.load(reusable);
    return this.referenceSheets.generate({
      bookId: input.bookId,
      bible,
      artStyle: input.artStyle,
      provider: this.provider,
    });
  }

  // Photo → stylised portrait (#128, phase 1); a refusal surfaces as
  // ImageGenerationError for the caller.
  async generatePhotoPortrait(input: {
    photo: Uint8Array;
    descriptor: string;
    artStyle: ArtStyle;
  }): Promise<Uint8Array> {
    return this.provider.generatePortraitFromPhoto(input);
  }

  // Assemble one page's final prompt + reference images from the Visual Bible.
  // The pre-#348 legacy path (no bible, free-text prompt) was removed in #378:
  // production holds no book that can re-enter image generation without a bible
  // (ready books never retry), so a missing bible is a bug, not a mode.
  private buildPageRequest(ctx: PageBuildContext): PageRequest {
    const { input, page } = ctx;
    if (!input.story.visualBible || !page.scene) {
      throw new Error(
        `Book ${input.bookId}: story has no Visual Bible / scene on a page — regenerate the story (pre-#348 books cannot be re-rendered)`,
      );
    }
    return this.biblePageRequest(ctx);
  }

  private biblePageRequest(ctx: PageBuildContext): PageRequest {
    const { input, page, portraitBytes, sheets } = ctx;
    const bible = input.story.visualBible!;
    const scene = page.scene!;
    const { images, labels } = pickReferences({
      scene,
      sources: {
        heroPortrait: portraitBytes,
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
    if (!characterProfile) return null;
    return startActiveObservation('image-generation.portrait', async (span) => {
      const bytes = await this.provider.generatePortrait({
        characterProfile,
        artStyle: input.artStyle,
      });
      const key = bookKeys(input.bookId).portrait;
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
  }
};
