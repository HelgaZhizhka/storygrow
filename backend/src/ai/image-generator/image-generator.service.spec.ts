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
import { ImageContentPolicyError } from './errors';
import { S3Service } from '../../s3/s3.service';
import type { Story } from '../schemas';

const mockS3 = {
  uploadObject: jest.fn(),
  getSignedUrl: jest.fn(),
};

const makeMockConfig = (imageProvider: string) => ({
  get: jest.fn((key: string) => (key === 'IMAGE_PROVIDER' ? imageProvider : undefined)),
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

const makeService = async (imageProvider = 'openai'): Promise<ImageGeneratorService> => {
  const module = await Test.createTestingModule({
    providers: [
      ImageGeneratorService,
      { provide: S3Service, useValue: mockS3 },
      { provide: ConfigService, useValue: makeMockConfig(imageProvider) },
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
  });
});
