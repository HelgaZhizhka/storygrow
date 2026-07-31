jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));
jest.mock('@langfuse/tracing', () => ({
  startActiveObservation: async <T>(
    _name: string,
    fn: (span: { update: jest.Mock }) => Promise<T>,
  ): Promise<T> => fn({ update: jest.fn() }),
}));

import { Test } from '@nestjs/testing';
import { PhotoPortraitService } from './photo-portrait.service';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../s3/s3.service';
import { ImageGeneratorService } from '../image-generator/image-generator.service';

const photo = new Uint8Array([1, 2, 3]);
const portrait = new Uint8Array([9, 9]);

describe('PhotoPortraitService', () => {
  const findUniqueOrThrow = jest.fn();
  const update = jest.fn();
  const getObjectBytes = jest.fn();
  const uploadObject = jest.fn();
  const generatePhotoPortrait = jest.fn();
  let service: PhotoPortraitService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PhotoPortraitService,
        { provide: PrismaService, useValue: { book: { findUniqueOrThrow, update } } },
        { provide: S3Service, useValue: { getObjectBytes, uploadObject } },
        { provide: ImageGeneratorService, useValue: { generatePhotoPortrait } },
      ],
    }).compile();
    service = module.get(PhotoPortraitService);
  });

  it('builds the portrait from the stored photo + descriptor and persists the key', async () => {
    findUniqueOrThrow.mockResolvedValue({
      childPhotoKey: 'books/b1/upload',
      characterDescriptor: 'round face, blue eyes',
      artStyle: 'watercolor',
    });
    getObjectBytes.mockResolvedValue(photo);
    generatePhotoPortrait.mockResolvedValue(portrait);

    const result = await service.buildPortrait('b1');

    expect(getObjectBytes).toHaveBeenCalledWith('books/b1/upload');
    expect(generatePhotoPortrait).toHaveBeenCalledWith({
      photo,
      descriptor: 'round face, blue eyes',
      artStyle: 'watercolor',
    });
    expect(uploadObject).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'books/b1/portrait.png', contentType: 'image/png' }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { characterPortraitKey: 'books/b1/portrait.png' },
    });
    expect(result).toEqual({
      portraitKey: 'books/b1/portrait.png',
      descriptor: 'round face, blue eyes',
    });
  });

  it('throws when the book has no uploaded photo or descriptor', async () => {
    findUniqueOrThrow.mockResolvedValue({
      childPhotoKey: null,
      characterDescriptor: null,
      artStyle: 'watercolor',
    });

    await expect(service.buildPortrait('b1')).rejects.toThrow(/no uploaded photo/);
    expect(generatePhotoPortrait).not.toHaveBeenCalled();
  });
});
