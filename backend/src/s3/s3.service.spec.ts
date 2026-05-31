const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]): Promise<string> =>
    mockGetSignedUrl(...args) as Promise<string>,
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const envValues: Record<string, string> = {
  S3_ENDPOINT: 'http://localhost:9100',
  S3_ACCESS_KEY: 'access',
  S3_SECRET_KEY: 'secret',
  S3_BUCKET: 'storygrow',
};

const mockConfig = {
  get: jest.fn((key: string): string | undefined => envValues[key]),
  getOrThrow: jest.fn((key: string): string => {
    const value = envValues[key];
    if (value === undefined) throw new Error(`Missing config ${key}`);
    return value;
  }),
};

describe('S3Service', () => {
  let service: S3Service;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [S3Service, { provide: ConfigService, useValue: mockConfig }],
    }).compile();
    service = module.get(S3Service);
    service.onModuleInit();
  });

  it('uploadObject sends a PutObjectCommand with provided key, body and contentType', async () => {
    mockSend.mockResolvedValueOnce({});
    const body = Buffer.from('hello');

    await service.uploadObject({ key: 'books/abc/page-1.png', body, contentType: 'image/png' });

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'storygrow',
      Key: 'books/abc/page-1.png',
      Body: body,
      ContentType: 'image/png',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('getSignedUrl builds a GetObjectCommand and returns the presigned URL', async () => {
    mockGetSignedUrl.mockResolvedValueOnce('https://signed.example/page-1.png');

    const url = await service.getSignedUrl('books/abc/page-1.png');

    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'storygrow',
      Key: 'books/abc/page-1.png',
    });
    expect(url).toBe('https://signed.example/page-1.png');
  });

  it('uploadObject propagates S3 errors', async () => {
    mockSend.mockRejectedValueOnce(new Error('S3 unreachable'));

    await expect(
      service.uploadObject({ key: 'k', body: Buffer.from(''), contentType: 'image/png' }),
    ).rejects.toThrow('S3 unreachable');
  });
});
