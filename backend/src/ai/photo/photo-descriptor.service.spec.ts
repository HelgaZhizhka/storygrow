jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn(() => (model: string) => ({ model })),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { PhotoDescriptorService } from './photo-descriptor.service';

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;

const photo = new Uint8Array([1, 2, 3]);

describe('PhotoDescriptorService', () => {
  let service: PhotoDescriptorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PhotoDescriptorService,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('key') } },
      ],
    }).compile();
    service = module.get(PhotoDescriptorService);
  });

  it('returns the parsed descriptor for a valid child face', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { hasChildFace: true, ageYears: 5, descriptor: 'round face, blue eyes' },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await service.describePhoto({ photo, mimeType: 'image/jpeg', bookId: 'b1' });

    expect(result).toEqual({
      hasChildFace: true,
      ageYears: 5,
      descriptor: 'round face, blue eyes',
    });
  });

  it('reports hasChildFace: false when no drawable face is present', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { hasChildFace: false, ageYears: null, descriptor: '' },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await service.describePhoto({ photo, mimeType: 'image/png', bookId: 'b1' });

    expect(result.hasChildFace).toBe(false);
  });

  it('passes the photo as an image part and never leaks it into telemetry', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { hasChildFace: true, ageYears: 4, descriptor: 'x' },
    } as Awaited<ReturnType<typeof generateObject>>);

    await service.describePhoto({ photo, mimeType: 'image/jpeg', bookId: 'book-42' });

    const call = mockGenerateObject.mock.calls[0][0];
    const content = call.messages?.[0].content as Array<{ type: string; image?: Uint8Array }>;
    expect(content.some((p) => p.type === 'image' && p.image === photo)).toBe(true);
    expect(call.experimental_telemetry?.functionId).toBe('photo.descriptor');
    expect(JSON.stringify(call.experimental_telemetry?.metadata)).not.toContain('1,2,3');
    expect(call.experimental_telemetry?.metadata).toEqual({ bookId: 'book-42' });
  });
});
