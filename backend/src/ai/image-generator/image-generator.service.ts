import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { startActiveObservation } from '@langfuse/tracing';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { type Story } from '../schemas';
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
  // Cascade experiment (#348): render pages sequentially, passing each rendered
  // page as a reference to the next so objects/setting carry forward. Off by
  // default (eval:images sets it for the bible+cascade variant).
  cascade?: boolean;
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
  previousPage?: Uint8Array;
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
  // Reference sheets (#348, PR 2) are ON by default (ADR-0007, 2026-09-05): with
  // the hero portrait alone, cast members were text-only and re-drawn on every
  // page (outfit, even skin tone drifted). Cast portraits + a location sheet as
  // references fixed it 12/12 pages on Grok. IMAGE_REFERENCE_SHEETS=off disables.
  private readonly sheetsEnabled: boolean;
  private readonly pages: PageRenderer;

  constructor(
    private readonly s3: S3Service,
    config: ConfigService,
    private readonly referenceSheets: ReferenceSheetsService,
    // Optional so scripts/tests without a judge (or a DB) still construct the service.
    @Optional() judge: ImageJudgeService | null = null,
  ) {
    this.textModel = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') })(
      GENERATION_MODEL,
    );
    this.sheetsEnabled = (config.get<string>('IMAGE_REFERENCE_SHEETS') ?? 'on') !== 'off';
    const name = (config.get<string>('IMAGE_PROVIDER') ??
      DEFAULT_IMAGE_PROVIDER) as ImageProviderName;
    this.provider =
      name === 'openai'
        ? new OpenAiImageProvider()
        : name === 'xai'
          ? new XaiImageProvider(config.getOrThrow<string>('XAI_API_KEY'))
          : new GeminiImageProvider(
              config.getOrThrow<string>('GOOGLE_GENERATIVE_AI_API_KEY'),
              config.get<string>('GEMINI_IMAGE_MODEL') ?? GEMINI_IMAGE_MODEL,
            );
    this.pages = new PageRenderer({
      provider: this.provider,
      s3,
      textModel: this.textModel,
      judge,
    });
    this.logger.log(
      `Image provider: ${name} (${this.provider.modelLabel}); judge ${judge?.enabled ? 'on' : 'off'}`,
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
      const variant = this.variantLabel(input, sheets);
      const imageKeys = input.cascade
        ? await this.generatePagesCascade(input, portrait?.bytes, sheets, variant)
        : await this.generatePagesParallel(input, portrait?.bytes, sheets, variant);

      span.update({ output: { count: imageKeys.length, portrait: portrait?.key ?? null } });
      return {
        imageKeys,
        characterPortraitKey: portrait?.key ?? null,
        referenceImageKeys: sheets?.keys ?? [],
      };
    });
  }

  // 'bible+sheets' only when a sheet was actually produced (an all-refused set is
  // really 'bible'); 'bible+cascade' for the sequential cascade experiment. Keeps
  // the eval:images A/B labelling honest.
  private variantLabel(input: ImageGenInput, sheets: SheetSet | null): string {
    if (!input.story.visualBible) return 'baseline';
    if (input.cascade) return 'bible+cascade';
    return (sheets?.keys.length ?? 0) > 0 ? 'bible+sheets' : 'bible';
  }

  private generatePagesParallel(
    input: ImageGenInput,
    portraitBytes: Uint8Array | undefined,
    sheets: SheetSet | null,
    variant: string,
  ): Promise<string[]> {
    return Promise.all(
      input.story.pages.map(async (page, i) => {
        const req = this.buildPageRequest({ input, page, portraitBytes, sheets });
        const { key } = await this.pages.render({
          ...req,
          bookId: input.bookId,
          pageNumber: i + 1,
          template: page.template,
          variant,
        });
        return key;
      }),
    );
  }

  // Cascade (#348): pages run in order; each rendered page becomes a reference
  // for the next so objects/setting carry forward. Sequential by nature.
  private async generatePagesCascade(
    input: ImageGenInput,
    portraitBytes: Uint8Array | undefined,
    sheets: SheetSet | null,
    variant: string,
  ): Promise<string[]> {
    const keys: string[] = [];
    let previousPage: Uint8Array | undefined;
    for (let i = 0; i < input.story.pages.length; i++) {
      const page = input.story.pages[i];
      const req = this.buildPageRequest({ input, page, portraitBytes, sheets, previousPage });
      const { key, bytes } = await this.pages.render({
        ...req,
        bookId: input.bookId,
        pageNumber: i + 1,
        template: page.template,
        variant,
      });
      keys.push(key);
      previousPage = bytes;
    }
    return keys;
  }

  // Generate location + cast reference sheets once per book (#348, PR 2), gated
  // by IMAGE_REFERENCE_SHEETS and only for the bible path on a reference-capable
  // provider. Returns null when sheets are off / not applicable.
  private async maybeSheets(input: ImageGenInput): Promise<SheetSet | null> {
    const bible = input.story.visualBible;
    if (!this.sheetsEnabled || !this.provider.usesReference || !bible) return null;
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

  private referenceBudget(): number {
    return MAX_REFERENCE_IMAGES[this.provider.modelLabel] ?? DEFAULT_MAX_REFERENCE_IMAGES;
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
        previousPage: this.provider.usesReference ? ctx.previousPage : undefined,
        castSheets: sheets?.castSheets,
        locationSheet: sheets?.locationSheets[scene.locationId],
      },
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
}
