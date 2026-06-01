import { Test } from '@nestjs/testing';
import { BookImageService } from './book-image.service';
import { S3Service } from '../s3/s3.service';

const mockS3 = {
  getSignedUrl: jest.fn(),
};

describe('BookImageService', () => {
  let service: BookImageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [BookImageService, { provide: S3Service, useValue: mockS3 }],
    }).compile();
    service = module.get(BookImageService);
  });

  it('signs each key via S3Service and preserves order', async () => {
    mockS3.getSignedUrl.mockImplementation((key: string) =>
      Promise.resolve(`https://signed/${key}`),
    );

    const urls = await service.signKeys(['books/a/page-1.png', 'books/a/page-2.png']);

    expect(urls).toEqual([
      'https://signed/books/a/page-1.png',
      'https://signed/books/a/page-2.png',
    ]);
    expect(mockS3.getSignedUrl).toHaveBeenCalledTimes(2);
  });

  it('returns empty array for empty input', async () => {
    const urls = await service.signKeys([]);
    expect(urls).toEqual([]);
    expect(mockS3.getSignedUrl).not.toHaveBeenCalled();
  });
});
