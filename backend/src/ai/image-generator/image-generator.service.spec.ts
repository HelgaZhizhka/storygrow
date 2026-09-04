jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

const mockGenerateImage = jest.fn();
const mockGenerateText = jest.fn();

jest.mock('ai', () => ({
  generateImage: (...args: unknown[]): unknown => mockGenerateImage(...args),
  generateText: (...args: unknown[]): unknown => mockGenerateText(...args),
  NoImageGeneratedError: class NoImageGeneratedError extends Error {
    static isInstance(e: unknown): boolean {
      return e instanceof Error && e.constructor.name === 'NoImageGeneratedError';
    }
  },
}));

const mockTextModel = { id: 'gpt-4o-mini-mock' };
const mockCreateOpenAI = jest.fn().mockReturnValue(jest.fn().mockReturnValue(mockTextModel));

jest.mock('@ai-sdk/openai', () => ({
  openai: { imageModel: jest.fn((id: string) => ({ id })) },
  createOpenAI: (...args: unknown[]): unknown => mockCreateOpenAI(...args),
}));

const mockGoogleImage = jest.fn((id: string) => ({ id }));
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => ({ image: (id: string) => mockGoogleImage(id) }),
}));

jest.mock('@langfuse/tracing', () => ({
  startActiveObservation: async <T>(
    _name: string,
    fn: (span: { update: jest.Mock }) => Promise<T>,
  ): Promise<T> => fn({ update: jest.fn() }),
}));

jest.mock('../telemetry', () => ({
  createTelemetry: jest.fn(() => ({ isEnabled: false })),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ImageGeneratorService } from './image-generator.service';
import { ReferenceSheetsService } from './reference-sheets.service';
import { ImageContentPolicyError } from './errors';
import { S3Service } from '../../s3/s3.service';
import type { Story } from '../schemas';
import { visualBibleFixture, sceneFixture } from '../schemas/__fixtures__/visual-bible.fixture';

const mockS3 = {
  uploadObject: jest.fn(),
  getSignedUrl: jest.fn(),
  getObjectBytes: jest.fn(),
};

const makeMockConfig = (imageProvider: string, sheets = 'off') => ({
  get: jest.fn((key: string) => {
    if (key === 'IMAGE_PROVIDER') return imageProvider;
    if (key === 'IMAGE_REFERENCE_SHEETS') return sheets;
    return undefined;
  }),
  getOrThrow: jest.fn(() => 'test-key'),
});

const makeStory = (opts: { characterProfile?: string; pageCount?: number } = {}): Story => {
  const pageCount = opts.pageCount ?? 3;
  return {
    title: 'Test',
    characterProfile: opts.characterProfile ?? '5-year-old girl with red hair',
    pages: Array.from({ length: pageCount }, (_, i) => ({
      template: i === 0 ? ('cover' as const) : ('image-top' as const),
      text: i === 0 ? null : `page ${i}`,
      title: i === 0 ? 'Cover' : null,
      illustrationPrompt: `prompt-${i}`,
    })),
    discussionQuestions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
  };
};

const makeBibleStory = (): Story => ({
  ...makeStory({ pageCount: 2 }),
  visualBible: visualBibleFixture({
    hero: { name: 'Алиса', descriptor: '5-year-old girl, red hair' },
    locations: [{ id: 'home', name: 'дом', descriptor: 'a green slide in a yard' }],
  }),
  pages: makeStory({ pageCount: 2 }).pages.map((p) => ({
    ...p,
    scene: sceneFixture({ locationId: 'home', heroOnPage: true }),
  })),
});

const makeService = async (
  imageProvider = 'openai',
  sheets = 'off',
): Promise<ImageGeneratorService> => {
  const module = await Test.createTestingModule({
    providers: [
      ImageGeneratorService,
      ReferenceSheetsService,
      { provide: S3Service, useValue: mockS3 },
      { provide: ConfigService, useValue: makeMockConfig(imageProvider, sheets) },
    ],
  }).compile();
  return module.get(ImageGeneratorService);
};

describe('ImageGeneratorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OpenAI provider (usesReference=false)', () => {
    it('generates one image per page, uploads each to S3, returns imageKeys and null portrait', async () => {
      const service = await makeService('openai');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1, 2, 3]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const story = makeStory({ pageCount: 3 });
      const result = await service.generate({ story, bookId: 'book-1', artStyle: 'watercolor' });

      expect(result.imageKeys).toEqual([
        'books/book-1/page-1.png',
        'books/book-1/page-2.png',
        'books/book-1/page-3.png',
      ]);
      expect(result.characterPortraitKey).toBeNull();
      expect(mockGenerateImage).toHaveBeenCalledTimes(3);
      expect(mockS3.uploadObject).toHaveBeenCalledTimes(3);
    });

    it('skips the portrait on the openai provider and returns a null portrait key', async () => {
      const service = await makeService('openai');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const story = makeStory({ characterProfile: 'a girl', pageCount: 1 });
      const result = await service.generate({ story, bookId: 'book-2', artStyle: 'watercolor' });

      expect(result.characterPortraitKey).toBeNull();
      expect(mockS3.uploadObject).toHaveBeenCalledTimes(1);
    });

    it('uploads each image with image/png contentType and deterministic key', async () => {
      const service = await makeService('openai');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const story = makeStory({ pageCount: 2 });
      await service.generate({ story, bookId: 'book-xyz', artStyle: 'watercolor' });

      expect(mockS3.uploadObject).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'books/book-xyz/page-1.png',
          contentType: 'image/png',
        }),
      );
      expect(mockS3.uploadObject).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'books/book-xyz/page-2.png',
          contentType: 'image/png',
        }),
      );
    });

    it('on content policy error: simplifies prompt via LLM and retries image generation', async () => {
      const service = await makeService('openai');
      mockGenerateText.mockResolvedValue({ text: 'simplified safe prompt' });
      mockS3.uploadObject.mockResolvedValue(undefined);

      // First call: throw an error that unambiguously maps to ImageGenerationError('refused')
      // via the provider's isContentPolicyError cause.code check.
      // Second call (after simplification): succeeds.
      const contentPolicyErr = Object.assign(new Error('image generation failed'), {
        cause: { code: 'content_policy_violation' },
      });
      mockGenerateImage
        .mockRejectedValueOnce(contentPolicyErr)
        .mockResolvedValue({ image: { uint8Array: new Uint8Array([9, 8, 7]) } });

      const story = makeStory({ pageCount: 1 });
      const result = await service.generate({ story, bookId: 'b', artStyle: 'watercolor' });

      // Simplify step must have been called exactly once (the retry path was taken)
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      // Provider was called twice: original attempt + simplified retry
      expect(mockGenerateImage).toHaveBeenCalledTimes(2);
      // The page was ultimately produced and uploaded to S3
      expect(mockS3.uploadObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'books/b/page-1.png', contentType: 'image/png' }),
      );
      expect(result.imageKeys).toEqual(['books/b/page-1.png']);
    });

    it('throws ImageContentPolicyError when both original and simplified prompt are rejected', async () => {
      const service = await makeService('openai');
      mockGenerateImage.mockRejectedValue(new Error('content_policy_violation'));
      mockGenerateText.mockResolvedValue({ text: 'simplified prompt' });

      const story = makeStory({ pageCount: 1 });
      await expect(
        service.generate({ story, bookId: 'b', artStyle: 'watercolor' }),
      ).rejects.toBeInstanceOf(ImageContentPolicyError);
    });

    it('propagates non-content-policy errors as-is', async () => {
      const service = await makeService('openai');
      mockGenerateImage.mockRejectedValueOnce(new Error('network timeout'));

      const story = makeStory({ pageCount: 1 });
      await expect(
        service.generate({ story, bookId: 'b', artStyle: 'watercolor' }),
      ).rejects.toThrow('network timeout');
    });
  });

  describe('Gemini provider (usesReference=true)', () => {
    it('generates a portrait then one image per page and returns the portrait key', async () => {
      const service = await makeService('gemini');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const story = makeStory({ characterProfile: 'a girl with red curls', pageCount: 2 });
      const result = await service.generate({ story, bookId: 'book-1', artStyle: 'watercolor' });

      expect(result.imageKeys).toHaveLength(2);
      expect(result.characterPortraitKey).toBe('books/book-1/portrait.png');
      // 1 portrait + 2 pages
      expect(mockS3.uploadObject).toHaveBeenCalledTimes(3);
    });

    it('skips portrait when characterProfile is empty', async () => {
      const service = await makeService('gemini');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const story: Story = {
        title: 'No Profile',
        characterProfile: '',
        pages: [{ template: 'image-top', text: 'text', title: null, illustrationPrompt: 'p1' }],
        discussionQuestions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
      };
      const result = await service.generate({ story, bookId: 'book-3', artStyle: 'cartoon' });

      expect(result.characterPortraitKey).toBeNull();
      expect(mockS3.uploadObject).toHaveBeenCalledTimes(1);
    });

    it('photo flow: loads the approved portrait, generates no portrait, folds descriptor into pages', async () => {
      const service = await makeService('gemini');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);
      mockS3.getObjectBytes.mockResolvedValue(new Uint8Array([5, 5]));

      const story = makeStory({ characterProfile: 'a girl', pageCount: 2 });
      const result = await service.generate({
        story,
        bookId: 'book-9',
        artStyle: 'watercolor',
        approvedPortraitKey: 'books/book-9/portrait.png',
        characterDescriptor: 'round face, blue eyes',
      });

      // Approved portrait is loaded, not generated, and reused as the key.
      expect(mockS3.getObjectBytes).toHaveBeenCalledWith('books/book-9/portrait.png');
      expect(result.characterPortraitKey).toBe('books/book-9/portrait.png');
      // Only the 2 page images are uploaded (no portrait upload).
      expect(mockS3.uploadObject).toHaveBeenCalledTimes(2);
      // Descriptor is folded into each page prompt (the provider wraps it further).
      const pageCalls = mockGenerateImage.mock.calls as Array<[{ prompt: { text?: string } }]>;
      expect(pageCalls.every(([arg]) => arg.prompt.text?.includes('round face, blue eyes.'))).toBe(
        true,
      );
    });
  });

  describe('Visual Bible path (#348)', () => {
    it('assembles the hero-lock + location prompt and passes the portrait as reference 1', async () => {
      const service = await makeService('gemini');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const result = await service.generate({
        story: makeBibleStory(),
        bookId: 'book-b',
        artStyle: 'watercolor',
      });

      expect(result.imageKeys).toHaveLength(2);
      // page calls are the ones whose prompt is an object { text, images }
      const pageCalls = mockGenerateImage.mock.calls
        .map(([arg]) => arg as { prompt: unknown })
        .filter((a) => typeof a.prompt === 'object') as Array<{
        prompt: { text: string; images: Uint8Array[] };
      }>;
      expect(pageCalls).toHaveLength(2);
      for (const call of pageCalls) {
        expect(call.prompt.text).toContain('EXACTLY ONCE');
        expect(call.prompt.text).toContain('as in reference image 1');
        expect(call.prompt.text).toContain('a green slide in a yard');
        expect(call.prompt.images).toHaveLength(1); // the hero portrait
      }
    });

    it('does not generate reference sheets when IMAGE_REFERENCE_SHEETS is off', async () => {
      const service = await makeService('gemini', 'off');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const result = await service.generate({
        story: makeBibleStory(),
        bookId: 'book-off',
        artStyle: 'watercolor',
      });

      expect(result.referenceImageKeys).toEqual([]);
      // portrait + 2 pages only (no ref-location/ref-cast uploads)
      const keys = mockS3.uploadObject.mock.calls.map(([a]) => (a as { key: string }).key);
      expect(keys.some((k) => k.includes('/ref-'))).toBe(false);
    });

    it('generates location + cast sheets when the flag is on and passes them as page references', async () => {
      const service = await makeService('gemini', 'on');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([2]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const base = makeBibleStory();
      const story: Story = {
        ...base,
        visualBible: {
          ...base.visualBible!,
          cast: [
            { id: 'brother', name: 'братик', role: 'младший брат', descriptor: 'toddler boy' },
          ],
        },
        pages: base.pages.map((p) => ({
          ...p,
          scene: sceneFixture({ locationId: 'home', castIds: ['brother'], heroOnPage: true }),
        })),
      };

      const result = await service.generate({ story, bookId: 'book-on', artStyle: 'watercolor' });

      // Two sheets generated (one location + one cast) and their keys returned.
      expect(result.referenceImageKeys).toEqual(
        expect.arrayContaining([
          'books/book-on/ref-location-home.png',
          'books/book-on/ref-cast-brother.png',
        ]),
      );
      // Each page cites all three references (hero, cast, location) and passes 3 images.
      const pageCalls = mockGenerateImage.mock.calls
        .map(([arg]) => arg as { prompt: unknown })
        .filter((a) => typeof a.prompt === 'object') as Array<{
        prompt: { text: string; images: Uint8Array[] };
      }>;
      for (const call of pageCalls) {
        expect(call.prompt.images).toHaveLength(3);
        expect(call.prompt.text).toContain('братик — toddler boy (as in reference image 2)');
        expect(call.prompt.text).toContain('as in reference image 3'); // location
      }
    });

    it('cascade: renders pages sequentially and passes the previous page as a reference', async () => {
      const service = await makeService('gemini');
      let n = 0;
      mockGenerateImage.mockImplementation(() =>
        Promise.resolve({ image: { uint8Array: new Uint8Array([++n]) } }),
      );
      mockS3.uploadObject.mockResolvedValue(undefined);

      const result = await service.generate({
        story: makeBibleStory(),
        bookId: 'book-casc',
        artStyle: 'watercolor',
        cascade: true,
      });

      expect(result.imageKeys).toHaveLength(2);
      const pageCalls = mockGenerateImage.mock.calls
        .map(([arg]) => arg as { prompt: unknown })
        .filter((a) => typeof a.prompt === 'object') as Array<{
        prompt: { text: string; images: Uint8Array[] };
      }>;
      expect(pageCalls).toHaveLength(2);
      // page 1: hero portrait only; page 2: hero + previous page
      expect(pageCalls[0].prompt.images).toHaveLength(1);
      expect(pageCalls[1].prompt.images).toHaveLength(2);
      expect(pageCalls[1].prompt.text).toContain('previous scene');
    });
  });
});
