jest.mock('../../../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

const mockGenerateImage = jest.fn();

jest.mock('ai', () => ({
  generateImage: (...args: unknown[]): unknown => mockGenerateImage(...args),
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: {
    imageModel: jest.fn((id: string) => ({ id })),
  },
}));

jest.mock('@langfuse/tracing', () => ({
  startActiveObservation: async <T>(
    _name: string,
    fn: (span: { update: jest.Mock }) => Promise<T>,
  ): Promise<T> => fn({ update: jest.fn() }),
}));

import { Test } from '@nestjs/testing';
import { ImageGeneratorService } from './image-generator.service';
import { S3Service } from '../../s3/s3.service';
import type { Story } from '../schemas';

const mockS3 = {
  uploadObject: jest.fn(),
  getSignedUrl: jest.fn(),
};

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
      providers: [ImageGeneratorService, { provide: S3Service, useValue: mockS3 }],
    }).compile();
    service = module.get(ImageGeneratorService);
  });

  it('generates one image per page and uploads each to S3', async () => {
    mockGenerateImage.mockResolvedValue({
      image: { base64: Buffer.from('img').toString('base64') },
    });
    mockS3.uploadObject.mockResolvedValue(undefined);
    mockS3.getSignedUrl.mockImplementation((key: string) =>
      Promise.resolve(`https://signed/${key}`),
    );

    const urls = await service.generate({ story, bookId: 'book-1' });

    expect(mockGenerateImage).toHaveBeenCalledTimes(3);
    expect(mockS3.uploadObject).toHaveBeenCalledTimes(3);
    expect(urls).toEqual([
      'https://signed/books/book-1/page-1.png',
      'https://signed/books/book-1/page-2.png',
      'https://signed/books/book-1/page-3.png',
    ]);
  });

  it('uploads each image with image/png contentType and deterministic key', async () => {
    mockGenerateImage.mockResolvedValue({ image: { base64: Buffer.from('x').toString('base64') } });
    mockS3.uploadObject.mockResolvedValue(undefined);
    mockS3.getSignedUrl.mockResolvedValue('https://signed/anything');

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

  it('passes style suffix appended to each prompt', async () => {
    mockGenerateImage.mockResolvedValue({ image: { base64: Buffer.from('x').toString('base64') } });
    mockS3.uploadObject.mockResolvedValue(undefined);
    mockS3.getSignedUrl.mockResolvedValue('url');

    await service.generate({ story, bookId: 'b' });

    const calls = mockGenerateImage.mock.calls as Array<[{ prompt: string }]>;
    for (const [args] of calls) {
      expect(args.prompt).toMatch(/children's book illustration style/);
    }
  });

  it('rejects if any single page generation fails', async () => {
    mockGenerateImage
      .mockResolvedValueOnce({ image: { base64: Buffer.from('x').toString('base64') } })
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValueOnce({ image: { base64: Buffer.from('x').toString('base64') } });
    mockS3.uploadObject.mockResolvedValue(undefined);
    mockS3.getSignedUrl.mockResolvedValue('url');

    await expect(service.generate({ story, bookId: 'b' })).rejects.toThrow('rate limit');
  });
});
