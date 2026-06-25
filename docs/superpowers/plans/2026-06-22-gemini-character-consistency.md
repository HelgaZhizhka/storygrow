# Gemini Character-Consistency Illustrations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every page of a custom-flow book with a reference portrait of the protagonist so the same character appears throughout, using Google Gemini 2.5 Flash Image, with gpt-image-1 kept as a config-selectable fallback.

**Architecture:** A small provider strategy inside `backend/src/ai/image-generator/`. Two `ImageProvider` implementations (Gemini, OpenAI) share the SAME `generateImage` call shape (verified by spike) and return raw PNG bytes. `ImageGeneratorService` selects one by config, runs a portrait stage (Gemini only), passes the portrait as a reference to each page, uploads to S3, and owns the simplify-on-refusal retry. The portrait S3 key is returned to the processor, which persists it.

**Tech Stack:** NestJS, Vercel AI SDK (`ai` v6), `@ai-sdk/openai`, `@ai-sdk/google` (already installed), Prisma, Jest.

## Global Constraints

- No `any` — use explicit types / `unknown` + guards.
- `pnpm` only; never `npm`/`yarn`.
- No `console.log` in commits — use the Nest `Logger`.
- Files ≤ 400 lines; functions ≤ 30 lines / ≤ 3 params (use object-param).
- Prompt fragments are exported constants/builders in `backend/src/ai/prompts/` — no inline magic strings.
- Image generation already runs through Vercel AI SDK `generateImage` (the existing exception to the generateObject rule — keep it).
- Prisma migrations via `pnpm --filter backend prisma:migrate` (wrapper) — never raw `migrate dev`.
- Tests are Jest, run with `pnpm --filter backend test`.
- Conventional Commits for every commit.

---

### Task 1: Config — provider, Gemini model, aspect-ratio map

**Files:**
- Modify: `backend/src/ai/ai.config.ts`
- Modify: `.env.example`
- Test: `backend/src/ai/ai.config.spec.ts` (create)

**Interfaces:**
- Produces: `type ImageProviderName = 'gemini' | 'openai'`; `GEMINI_IMAGE_MODEL: string`; `IMAGE_SIZE_TO_ASPECT_RATIO: Record<ImageSize, '1:1' | '2:3' | '3:2'>`; `DEFAULT_IMAGE_PROVIDER: ImageProviderName`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/ai/ai.config.spec.ts
import { IMAGE_SIZE_TO_ASPECT_RATIO, DEFAULT_IMAGE_PROVIDER, GEMINI_IMAGE_MODEL } from './ai.config';

describe('image config', () => {
  it('maps every template image size to an aspect ratio', () => {
    expect(IMAGE_SIZE_TO_ASPECT_RATIO['1024x1024']).toBe('1:1');
    expect(IMAGE_SIZE_TO_ASPECT_RATIO['1024x1536']).toBe('2:3');
    expect(IMAGE_SIZE_TO_ASPECT_RATIO['1536x1024']).toBe('3:2');
  });

  it('defaults to the gemini provider', () => {
    expect(DEFAULT_IMAGE_PROVIDER).toBe('gemini');
  });

  it('targets the gemini flash image model', () => {
    expect(GEMINI_IMAGE_MODEL).toBe('gemini-2.5-flash-image');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- ai.config.spec`
Expected: FAIL — exports do not exist.

- [ ] **Step 3: Implement**

Append to `backend/src/ai/ai.config.ts`:

```ts
import type { ImageSize } from '../pdf/page-templates/page-templates.config';

export type ImageProviderName = 'gemini' | 'openai';
export const DEFAULT_IMAGE_PROVIDER: ImageProviderName = 'gemini';

// Resolves to the GA id gemini-2.5-flash-preview-image. If it 404s, set that
// explicit id here. Gemini takes no `size`, only an aspect ratio.
export const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

export const IMAGE_SIZE_TO_ASPECT_RATIO: Record<ImageSize, '1:1' | '2:3' | '3:2'> = {
  '1024x1024': '1:1',
  '1024x1536': '2:3',
  '1536x1024': '3:2',
};
```

Add to `.env.example`:

```
# Image generation provider: gemini (default) | openai
IMAGE_PROVIDER=gemini
# Gemini API key from Google AI Studio (billing-enabled project) — NOT the OAuth client
GOOGLE_GENERATIVE_AI_API_KEY=
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter backend test -- ai.config.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/ai.config.ts backend/src/ai/ai.config.spec.ts .env.example
git commit -m "feat(ai): image-provider config, gemini model + aspect-ratio map"
```

---

### Task 2: Prompt builders for portrait + reference page

**Files:**
- Create: `backend/src/ai/prompts/image-portrait.prompt.ts`
- Test: `backend/src/ai/prompts/image-portrait.prompt.spec.ts`

**Interfaces:**
- Consumes: `ArtStyle`, `STYLE_SUFFIXES` from `../ai.config`.
- Produces: `buildPortraitPrompt(characterProfile: string, artStyle: ArtStyle): string`; `buildPagePrompt(pagePrompt: string, artStyle: ArtStyle): string`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/ai/prompts/image-portrait.prompt.spec.ts
import { buildPortraitPrompt, buildPagePrompt } from './image-portrait.prompt';

describe('image-portrait prompts', () => {
  it('portrait prompt includes the profile and the style suffix', () => {
    const p = buildPortraitPrompt('a girl with red curls', 'watercolor');
    expect(p).toContain('a girl with red curls');
    expect(p.toLowerCase()).toContain('watercolour');
    expect(p.toLowerCase()).toContain('portrait');
  });

  it('page prompt wraps with a keep-character instruction and the style suffix', () => {
    const p = buildPagePrompt('playing with a fox in a park', 'cartoon');
    expect(p.toLowerCase()).toContain('same');
    expect(p).toContain('playing with a fox in a park');
    expect(p.toLowerCase()).toContain('cartoon');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- image-portrait.prompt.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/ai/prompts/image-portrait.prompt.ts
import type { ArtStyle } from '../ai.config';
import { STYLE_SUFFIXES } from '../ai.config';

export function buildPortraitPrompt(characterProfile: string, artStyle: ArtStyle): string {
  return (
    `Full-body character reference portrait of ${characterProfile}. ` +
    `The character is centered and clearly visible on a plain neutral background.` +
    STYLE_SUFFIXES[artStyle]
  );
}

export function buildPagePrompt(pagePrompt: string, artStyle: ArtStyle): string {
  return (
    `Keep this exact child — same face, hair, and outfit — now in a new scene. ` +
    pagePrompt +
    STYLE_SUFFIXES[artStyle]
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter backend test -- image-portrait.prompt.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/prompts/image-portrait.prompt.ts backend/src/ai/prompts/image-portrait.prompt.spec.ts
git commit -m "feat(ai): portrait + reference-page prompt builders"
```

---

### Task 3: Error type + provider interface

**Files:**
- Modify: `backend/src/ai/image-generator/errors.ts`
- Create: `backend/src/ai/image-generator/providers/image-provider.interface.ts`
- Test: `backend/src/ai/image-generator/errors.spec.ts`

**Interfaces:**
- Produces: `class ImageGenerationError extends Error` with `reason: 'refused' | 'unknown'` and `get refused(): boolean`; interface `ImageProvider` + `PortraitInput` + `PageInput`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/ai/image-generator/errors.spec.ts
import { ImageGenerationError } from './errors';

describe('ImageGenerationError', () => {
  it('flags refusals', () => {
    const e = new ImageGenerationError('refused');
    expect(e.refused).toBe(true);
    expect(e).toBeInstanceOf(Error);
  });

  it('is not a refusal for unknown reason', () => {
    expect(new ImageGenerationError('unknown').refused).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- image-generator/errors.spec`
Expected: FAIL — `ImageGenerationError` not exported.

- [ ] **Step 3: Implement**

Append to `backend/src/ai/image-generator/errors.ts`:

```ts
export class ImageGenerationError extends Error {
  constructor(
    readonly reason: 'refused' | 'unknown',
    cause?: unknown,
  ) {
    super(`Image generation failed (${reason})`);
    this.name = 'ImageGenerationError';
    if (cause !== undefined) this.cause = cause;
  }

  get refused(): boolean {
    return this.reason === 'refused';
  }
}
```

Create `backend/src/ai/image-generator/providers/image-provider.interface.ts`:

```ts
import type { ArtStyle } from '../../ai.config';
import type { ImageSize } from '../../../pdf/page-templates/page-templates.config';

export interface PortraitInput {
  characterProfile: string;
  artStyle: ArtStyle;
}

export interface PageInput {
  prompt: string;
  artStyle: ArtStyle;
  imageSize: ImageSize;
  reference?: Uint8Array;
}

export interface ImageProvider {
  readonly usesReference: boolean;
  readonly modelLabel: string;
  generatePortrait(input: PortraitInput): Promise<Uint8Array>;
  generatePage(input: PageInput): Promise<Uint8Array>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter backend test -- image-generator/errors.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/image-generator/errors.ts backend/src/ai/image-generator/providers/image-provider.interface.ts backend/src/ai/image-generator/errors.spec.ts
git commit -m "feat(ai): ImageGenerationError + ImageProvider interface"
```

---

### Task 4: OpenAI image provider (preserve current behavior)

**Files:**
- Create: `backend/src/ai/image-generator/providers/openai-image.provider.ts`
- Test: `backend/src/ai/image-generator/providers/openai-image.provider.spec.ts`

**Interfaces:**
- Consumes: `ImageProvider`, `PageInput`, `PortraitInput`; `ImageGenerationError`; `generateImage` from `ai`; `openai` from `@ai-sdk/openai`; `IMAGE_MODEL`, `IMAGE_QUALITY`, `STYLE_SUFFIXES`.
- Produces: `class OpenAiImageProvider implements ImageProvider` (`usesReference = false`).

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/ai/image-generator/providers/openai-image.provider.spec.ts
const mockGenerateImage = jest.fn();
jest.mock('ai', () => ({ generateImage: (...a: unknown[]): unknown => mockGenerateImage(...a) }));
jest.mock('@ai-sdk/openai', () => ({ openai: { imageModel: (id: string) => ({ id }) } }));

import { OpenAiImageProvider } from './openai-image.provider';
import { ImageGenerationError } from '../errors';

const bytes = new Uint8Array([1, 2, 3]);

describe('OpenAiImageProvider', () => {
  beforeEach(() => mockGenerateImage.mockReset());

  it('generates a page and returns bytes', async () => {
    mockGenerateImage.mockResolvedValue({ image: { uint8Array: bytes } });
    const provider = new OpenAiImageProvider();
    const out = await provider.generatePage({
      prompt: 'a fox', artStyle: 'watercolor', imageSize: '1024x1024',
    });
    expect(out).toBe(bytes);
    expect(provider.usesReference).toBe(false);
    const call = mockGenerateImage.mock.calls[0][0];
    expect(call.size).toBe('1024x1024');
  });

  it('maps a content-policy error to a refusal', async () => {
    mockGenerateImage.mockRejectedValue(
      Object.assign(new Error('bad'), { cause: { code: 'content_policy_violation' } }),
    );
    const provider = new OpenAiImageProvider();
    await expect(
      provider.generatePage({ prompt: 'x', artStyle: 'watercolor', imageSize: '1024x1024' }),
    ).rejects.toBeInstanceOf(ImageGenerationError);
  });

  it('does not generate portraits', async () => {
    await expect(
      new OpenAiImageProvider().generatePortrait({ characterProfile: 'x', artStyle: 'watercolor' }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- openai-image.provider.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/ai/image-generator/providers/openai-image.provider.ts
import { generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { IMAGE_MODEL, IMAGE_QUALITY, STYLE_SUFFIXES } from '../../ai.config';
import { ImageGenerationError } from '../errors';
import type { ImageProvider, PageInput, PortraitInput } from './image-provider.interface';

const OPENAI_MAX_RETRIES = 1;

export class OpenAiImageProvider implements ImageProvider {
  readonly usesReference = false;
  readonly modelLabel = IMAGE_MODEL;

  generatePortrait(_input: PortraitInput): Promise<Uint8Array> {
    return Promise.reject(new Error('OpenAiImageProvider does not generate portraits'));
  }

  async generatePage(input: PageInput): Promise<Uint8Array> {
    const prompt = `${input.prompt}${STYLE_SUFFIXES[input.artStyle]}`;
    try {
      const result = await generateImage({
        model: openai.imageModel(IMAGE_MODEL),
        prompt,
        size: input.imageSize,
        maxRetries: OPENAI_MAX_RETRIES,
        providerOptions: { openai: { quality: IMAGE_QUALITY } },
      });
      return result.image.uint8Array;
    } catch (err: unknown) {
      if (isContentPolicyError(err)) throw new ImageGenerationError('refused', err);
      throw err;
    }
  }
}

function isContentPolicyError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object') {
    const code = (cause as Record<string, unknown>).code;
    if (code === 'content_policy_violation') return true;
    const body = (cause as Record<string, unknown>).responseBody;
    if (typeof body === 'string' && body.includes('content_policy_violation')) return true;
  }
  return err.message.toLowerCase().includes('content_policy');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter backend test -- openai-image.provider.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/image-generator/providers/openai-image.provider.ts backend/src/ai/image-generator/providers/openai-image.provider.spec.ts
git commit -m "feat(ai): OpenAiImageProvider (gpt-image-1 path behind the provider interface)"
```

---

### Task 5: Gemini image provider (reference consistency)

**Files:**
- Create: `backend/src/ai/image-generator/providers/gemini-image.provider.ts`
- Test: `backend/src/ai/image-generator/providers/gemini-image.provider.spec.ts`

**Interfaces:**
- Consumes: `ImageProvider`, `PageInput`, `PortraitInput`; `ImageGenerationError`; `generateImage`, `NoImageGeneratedError` from `ai`; `createGoogleGenerativeAI` from `@ai-sdk/google`; `GEMINI_IMAGE_MODEL`, `IMAGE_SIZE_TO_ASPECT_RATIO`; `buildPortraitPrompt`, `buildPagePrompt`.
- Produces: `class GeminiImageProvider implements ImageProvider` with `constructor(apiKey: string)` (`usesReference = true`).

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/ai/image-generator/providers/gemini-image.provider.spec.ts
const mockGenerateImage = jest.fn();
class FakeNoImage extends Error {
  static isInstance(e: unknown): boolean { return e instanceof FakeNoImage; }
}
jest.mock('ai', () => ({
  generateImage: (...a: unknown[]): unknown => mockGenerateImage(...a),
  NoImageGeneratedError: FakeNoImage,
}));
const mockImage = jest.fn((id: string) => ({ id }));
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => ({ image: (id: string) => mockImage(id) }),
}));

import { GeminiImageProvider } from './gemini-image.provider';
import { ImageGenerationError } from '../errors';

const bytes = new Uint8Array([9, 9]);

describe('GeminiImageProvider', () => {
  beforeEach(() => { mockGenerateImage.mockReset(); mockImage.mockClear(); });

  it('generates a portrait with a 2:3 aspect ratio', async () => {
    mockGenerateImage.mockResolvedValue({ image: { uint8Array: bytes } });
    const out = await new GeminiImageProvider('key').generatePortrait({
      characterProfile: 'a girl', artStyle: 'watercolor',
    });
    expect(out).toBe(bytes);
    expect(mockGenerateImage.mock.calls[0][0].aspectRatio).toBe('2:3');
  });

  it('passes the reference image and the mapped aspect ratio on a page', async () => {
    mockGenerateImage.mockResolvedValue({ image: { uint8Array: bytes } });
    const ref = new Uint8Array([7]);
    await new GeminiImageProvider('key').generatePage({
      prompt: 'a fox', artStyle: 'watercolor', imageSize: '1536x1024', reference: ref,
    });
    const arg = mockGenerateImage.mock.calls[0][0];
    expect(arg.aspectRatio).toBe('3:2');
    expect(arg.prompt.images).toEqual([ref]);
    expect(typeof arg.prompt.text).toBe('string');
  });

  it('maps a NoImageGeneratedError to a refusal', async () => {
    mockGenerateImage.mockRejectedValue(new FakeNoImage('blocked'));
    await expect(
      new GeminiImageProvider('key').generatePage({
        prompt: 'x', artStyle: 'watercolor', imageSize: '1024x1024',
      }),
    ).rejects.toBeInstanceOf(ImageGenerationError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- gemini-image.provider.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/ai/image-generator/providers/gemini-image.provider.ts
import { generateImage, NoImageGeneratedError } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GEMINI_IMAGE_MODEL, IMAGE_SIZE_TO_ASPECT_RATIO } from '../../ai.config';
import { buildPagePrompt, buildPortraitPrompt } from '../../prompts/image-portrait.prompt';
import { ImageGenerationError } from '../errors';
import type { ImageProvider, PageInput, PortraitInput } from './image-provider.interface';

type AspectRatio = '1:1' | '2:3' | '3:2';
type GeminiPrompt = string | { text: string; images: Uint8Array[] };

export class GeminiImageProvider implements ImageProvider {
  readonly usesReference = true;
  readonly modelLabel = GEMINI_IMAGE_MODEL;
  private readonly google: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(apiKey: string) {
    this.google = createGoogleGenerativeAI({ apiKey });
  }

  generatePortrait(input: PortraitInput): Promise<Uint8Array> {
    return this.run(buildPortraitPrompt(input.characterProfile, input.artStyle), '2:3');
  }

  generatePage(input: PageInput): Promise<Uint8Array> {
    const text = buildPagePrompt(input.prompt, input.artStyle);
    const prompt: GeminiPrompt = input.reference ? { text, images: [input.reference] } : text;
    return this.run(prompt, IMAGE_SIZE_TO_ASPECT_RATIO[input.imageSize]);
  }

  private async run(prompt: GeminiPrompt, aspectRatio: AspectRatio): Promise<Uint8Array> {
    try {
      const result = await generateImage({
        model: this.google.image(GEMINI_IMAGE_MODEL),
        prompt,
        aspectRatio,
      });
      return result.image.uint8Array;
    } catch (err: unknown) {
      if (NoImageGeneratedError.isInstance(err)) throw new ImageGenerationError('refused', err);
      throw err;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter backend test -- gemini-image.provider.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/image-generator/providers/gemini-image.provider.ts backend/src/ai/image-generator/providers/gemini-image.provider.spec.ts
git commit -m "feat(ai): GeminiImageProvider — reference-portrait consistency"
```

---

### Task 6: Rewire ImageGeneratorService to use providers + portrait stage

**Files:**
- Modify: `backend/src/ai/image-generator/image-generator.service.ts`
- Modify: `backend/src/ai/image-generator/image-generator.service.spec.ts`

**Interfaces:**
- Consumes: `ImageProvider`, `OpenAiImageProvider`, `GeminiImageProvider`; `ImageGenerationError`, `ImageContentPolicyError`; `ConfigService`, `S3Service`; `DEFAULT_IMAGE_PROVIDER`, `GENERATION_MODEL`; `simplifyIllustrationPrompt`, `createTelemetry`; `PAGE_TEMPLATES`; `Story`.
- Produces: `ImageGeneratorService.generate(input: { story: Story; bookId: string; artStyle: ArtStyle }): Promise<{ imageKeys: string[]; characterPortraitKey: string | null }>`.

- [ ] **Step 1: Write the failing test** (replace the existing describe body's expectations of an array return)

Add to `backend/src/ai/image-generator/image-generator.service.spec.ts` (extend its existing mocks — it already mocks `ai`, `@ai-sdk/openai`, `@langfuse/tracing`, `../telemetry`, `S3Service`). Add a Google mock and assert the new behavior:

```ts
// add near the other jest.mock(...) calls
const mockGoogleImage = jest.fn((id: string) => ({ id }));
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => ({ image: (id: string) => mockGoogleImage(id) }),
}));

// new test inside the existing describe (provider forced to gemini)
it('generates a portrait then one image per page and returns the portrait key', async () => {
  process.env.IMAGE_PROVIDER = 'gemini';
  mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
  const service = makeService(); // existing helper that builds the service with mocked deps + ConfigService returning a GOOGLE key
  const story = makeStory({ characterProfile: 'a girl with red curls', pageCount: 2 });

  const result = await service.generate({ story, bookId: 'book-1', artStyle: 'watercolor' });

  expect(result.imageKeys).toHaveLength(2);
  expect(result.characterPortraitKey).toBe('books/book-1/portrait.png');
  // 1 portrait + 2 pages
  expect(mockS3.uploadObject).toHaveBeenCalledTimes(3);
});

it('skips the portrait on the openai provider and returns a null portrait key', async () => {
  process.env.IMAGE_PROVIDER = 'openai';
  mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
  const service = makeService();
  const story = makeStory({ characterProfile: 'a girl', pageCount: 1 });

  const result = await service.generate({ story, bookId: 'book-2', artStyle: 'watercolor' });

  expect(result.characterPortraitKey).toBeNull();
  expect(mockS3.uploadObject).toHaveBeenCalledTimes(1); // page only
});
```

> If the existing spec lacks `makeService` / `makeStory` helpers, add minimal ones: `makeStory` returns `{ characterProfile, pages: Array.from({length}, (_, i) => ({ illustrationPrompt: 'p'+i, template: 'image-top' })) }` cast to `Story`; `makeService` builds `new ImageGeneratorService(mockS3 as unknown as S3Service, makeConfig())` where `makeConfig` returns a `ConfigService`-shaped object whose `getOrThrow` returns `'test-key'` for any key.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- image-generator.service.spec`
Expected: FAIL — `generate` returns an array, `result.characterPortraitKey` is undefined.

- [ ] **Step 3: Implement**

Rewrite `image-generator.service.ts`. Key shape (keep functions ≤ 30 lines — split as shown):

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { startActiveObservation } from '@langfuse/tracing';
import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { type Story } from '../schemas';
import { PAGE_TEMPLATES } from '../../pdf/page-templates/page-templates.config';
import { S3Service } from '../../s3/s3.service';
import { DEFAULT_IMAGE_PROVIDER, GENERATION_MODEL, type ArtStyle, type ImageProviderName } from '../ai.config';
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
    const name = (config.get<string>('IMAGE_PROVIDER') ?? DEFAULT_IMAGE_PROVIDER) as ImageProviderName;
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
    // OpenAI path keeps the existing text characterProfile prefix; the gemini
    // path carries identity via the reference image, so the raw prompt is fine.
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
    opts: { bookId: string; pageNumber: number; prompt: string; artStyle: ArtStyle; reference?: Uint8Array },
    imageSize: (typeof PAGE_TEMPLATES)[keyof typeof PAGE_TEMPLATES]['images'][0]['imageSize'],
  ): Promise<Uint8Array> {
    const gen = (prompt: string): Promise<Uint8Array> =>
      this.provider.generatePage({ prompt, artStyle: opts.artStyle, imageSize, reference: opts.reference });
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
```

Delete the old `isContentPolicyError` from this file (now lives in `openai-image.provider.ts`) and the old single-array return path.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter backend test -- image-generator.service.spec`
Expected: PASS. Then `pnpm --filter backend exec tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/image-generator/image-generator.service.ts backend/src/ai/image-generator/image-generator.service.spec.ts
git commit -m "feat(ai): provider-driven image generation with portrait reference stage"
```

---

### Task 7: Prisma — `Book.characterPortraitKey` + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the column**

In `model Book { ... }` add:

```prisma
  characterPortraitKey String?
```

- [ ] **Step 2: Create + apply the migration**

Run: `pnpm --filter backend prisma:migrate -- --name book_character_portrait_key`
Expected: a new folder under `backend/prisma/migrations/` with `ALTER TABLE "Book" ADD COLUMN "characterPortraitKey" TEXT;` and the client regenerated.

- [ ] **Step 3: Verify the column exists**

Run: `docker compose exec -T postgres psql "$DATABASE_URL" -c '\d "Book"' | grep characterPortraitKey`
(Or open `pnpm --filter backend prisma:studio`.) Expected: the column is listed.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: clean (Prisma types now include the field).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add Book.characterPortraitKey for the reference portrait"
```

---

### Task 8: Persist the portrait key in the generation processor

**Files:**
- Modify: `backend/src/generation/generation.processor.ts`
- Test: `backend/src/generation/generation.processor.spec.ts` (extend if present; otherwise add a focused test)

**Interfaces:**
- Consumes: `ImageGeneratorService.generate(...)` now returning `{ imageKeys, characterPortraitKey }`.

- [ ] **Step 1: Update the call site**

Find (around line 102):

```ts
imageKeys = await this.imageGenerator.generate({ story, bookId, artStyle: book.artStyle });
await this.prisma.book.update({ where: { id: bookId }, data: { imageKeys } });
```

Replace with:

```ts
const generated = await this.imageGenerator.generate({ story, bookId, artStyle: book.artStyle });
imageKeys = generated.imageKeys;
await this.prisma.book.update({
  where: { id: bookId },
  data: { imageKeys, characterPortraitKey: generated.characterPortraitKey },
});
```

(Keep the existing `imageKeys` declaration and the retry branch that reuses `book.imageKeys`.)

- [ ] **Step 2: Adjust the processor test**

If `generation.processor.spec.ts` mocks `imageGenerator.generate` to resolve an array, change it to resolve `{ imageKeys: ['k1'], characterPortraitKey: 'books/b/portrait.png' }` and assert the `book.update` is called with `characterPortraitKey`.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter backend test -- generation.processor.spec`
Expected: PASS. Then `pnpm --filter backend exec tsc --noEmit` → clean.

- [ ] **Step 4: Commit**

```bash
git add backend/src/generation/generation.processor.ts backend/src/generation/generation.processor.spec.ts
git commit -m "feat(generation): persist characterPortraitKey from image generation"
```

---

### Task 9: Full verification + spike cleanup

**Files:**
- Delete: `backend/src/scripts/spike-gemini-generateimage.ts` (one-off check, superseded by the providers)
- Keep: `backend/src/scripts/spike-gemini-consistency.ts` (documented reference of the approach)

- [ ] **Step 1: Full smoke check**

Ensure docker infra is up (`docker compose up -d`), then run:
Run: `./init.sh`
Expected: tsc + lint + tests all green (no `next build` while `next dev` runs).

- [ ] **Step 2: Manual end-to-end (gemini)**

With `IMAGE_PROVIDER=gemini` and a funded `GOOGLE_GENERATIVE_AI_API_KEY` in `backend/.env`, backend running: create a custom book (child-hero mode, a `childAppearance`) via the UI or API. Verify:
- `books/{id}/portrait.png` and `books/{id}/page-N.png` exist in MinIO;
- `Book.characterPortraitKey` is set (Prisma Studio);
- the protagonist looks the same across pages;
- LangFuse shows the `image-generation.portrait` span + provider metadata.

- [ ] **Step 3: Manual fallback check (openai)**

Set `IMAGE_PROVIDER=openai`, restart backend, generate another book. Verify it still produces page images, `characterPortraitKey` is null, and no portrait object is written.

- [ ] **Step 4: Remove the throwaway spike + commit**

```bash
git rm backend/src/scripts/spike-gemini-generateimage.ts
git commit -m "chore(ai): drop one-off generateImage spike (superseded by providers)"
```

- [ ] **Step 5: Open the PR**

```bash
git push -u origin issue/174-gemini-character-consistency
gh pr create --title "feat(ai): consistent character illustrations via reference portrait (Gemini)" --body "Closes #174"
```

---

## Notes for the implementer

- The `@ai-sdk/google` dependency is already in `backend/package.json` (added during the spike). If a fresh install fails on the `prisma generate` postinstall (needs `DATABASE_URL`), run installs with `--ignore-scripts` or with the env loaded.
- The Gemini path needs a billing-enabled Google project with prepaid credits; on `RESOURCE_EXHAUSTED` the generation will fail to `images_failed` — flip `IMAGE_PROVIDER=openai` to keep demoing.
- `result.image.uint8Array` is the uniform output accessor for both providers; upload to S3 via `Buffer.from(bytes)`.
