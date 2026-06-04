jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

const mockGenerateImage = jest.fn();
const mockGenerateText = jest.fn();

jest.mock('ai', () => ({
  generateImage: (...args: unknown[]): unknown => mockGenerateImage(...args),
  generateText: (...args: unknown[]): unknown => mockGenerateText(...args),
}));

const mockTextModel = { id: 'gpt-4o-mini-mock' };
const mockCreateOpenAI = jest.fn().mockReturnValue(jest.fn().mockReturnValue(mockTextModel));

jest.mock('@ai-sdk/openai', () => ({
  openai: { imageModel: jest.fn((id: string) => ({ id })) },
  createOpenAI: (...args: unknown[]): unknown => mockCreateOpenAI(...args),
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

const mockConfig = { getOrThrow: jest.fn().mockReturnValue('sk-test') };

const story: Story = {
  title: 'Test',
  pages: [
    { template: 'cover', text: null, title: 'Cover', illustrationPrompt: 'cover prompt' },
    { template: 'image-top', text: 'page 1', title: null, illustrationPrompt: 'page 1 prompt' },
    { template: 'final', text: 'the end', title: null, illustrationPrompt: 'final prompt' },
  ],
  discussionQuestions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
};

describe('ImageGeneratorService', () => {
  let service: ImageGeneratorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ImageGeneratorService,
        { provide: S3Service, useValue: mockS3 },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(ImageGeneratorService);
  });

  it('generates one image per page, uploads each to S3, and returns deterministic S3 keys', async () => {
    mockGenerateImage.mockResolvedValue({
      image: { base64: Buffer.from('img').toString('base64') },
    });
    mockS3.uploadObject.mockResolvedValue(undefined);

    const keys = await service.generate({ story, bookId: 'book-1' });

    expect(mockGenerateImage).toHaveBeenCalledTimes(3);
    expect(mockS3.uploadObject).toHaveBeenCalledTimes(3);
    expect(mockS3.getSignedUrl).not.toHaveBeenCalled();
    expect(keys).toEqual([
      'books/book-1/page-1.png',
      'books/book-1/page-2.png',
      'books/book-1/page-3.png',
    ]);
  });

  it('uploads each image with image/png contentType and deterministic key', async () => {
    mockGenerateImage.mockResolvedValue({ image: { base64: Buffer.from('x').toString('base64') } });
    mockS3.uploadObject.mockResolvedValue(undefined);

    await service.generate({ story, bookId: 'book-xyz' });

    expect(mockS3.uploadObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'books/book-xyz/page-1.png',
        contentType: 'image/png',
      }),
    );
    expect(mockS3.uploadObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'books/book-xyz/page-3.png',
        contentType: 'image/png',
      }),
    );
  });

  it('appends style suffix to each prompt', async () => {
    mockGenerateImage.mockResolvedValue({ image: { base64: Buffer.from('x').toString('base64') } });
    mockS3.uploadObject.mockResolvedValue(undefined);

    await service.generate({ story, bookId: 'b' });

    const calls = mockGenerateImage.mock.calls as Array<[{ prompt: string }]>;
    for (const [args] of calls) {
      expect(args.prompt).toMatch(/children's book illustration style/);
    }
  });

  it('passes maxRetries=1 and quality from IMAGE_QUALITY constant', async () => {
    mockGenerateImage.mockResolvedValue({ image: { base64: Buffer.from('x').toString('base64') } });
    mockS3.uploadObject.mockResolvedValue(undefined);

    await service.generate({ story, bookId: 'book-42' });

    const calls = mockGenerateImage.mock.calls as Array<
      [{ maxRetries: number; providerOptions: { openai: { quality: string } } }]
    >;
    expect(calls[0][0].maxRetries).toBe(1);
    expect(calls[0][0].providerOptions.openai.quality).toBe('medium');
  });

  it('on content policy error: simplifies prompt via LLM and retries image generation', async () => {
    const policyErr = new Error('content_policy_violation: not safe');
    mockGenerateImage
      .mockRejectedValueOnce(policyErr) // first attempt → rejected
      .mockResolvedValue({ image: { base64: Buffer.from('img').toString('base64') } }); // retry → ok
    mockGenerateText.mockResolvedValue({ text: 'simplified safe prompt' });
    mockS3.uploadObject.mockResolvedValue(undefined);

    const keys = await service.generate({ story, bookId: 'b' });

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockGenerateImage).toHaveBeenCalledTimes(4); // 3 pages, page-1 retried once
    expect(keys).toHaveLength(3);
  });

  it('throws ImageContentPolicyError when both original and simplified prompt are rejected', async () => {
    const policyErr = new Error('content_policy_violation: not safe');
    mockGenerateImage.mockRejectedValue(policyErr);
    mockGenerateText.mockResolvedValue({ text: 'simplified prompt' });

    await expect(service.generate({ story, bookId: 'b' })).rejects.toBeInstanceOf(
      ImageContentPolicyError,
    );
  });

  it('propagates non-content-policy errors as-is', async () => {
    mockGenerateImage.mockRejectedValueOnce(new Error('network timeout'));

    await expect(service.generate({ story, bookId: 'b' })).rejects.toThrow('network timeout');
  });
});
