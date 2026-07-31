jest.mock('sharp', () => {
  const chain = {
    rotate: () => chain,
    resize: () => chain,
    jpeg: () => chain,
    toBuffer: () => Promise.resolve(Buffer.from([10, 20, 30])),
  };
  return jest.fn(() => chain);
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BooksService } from './books.service';
import {
  createBooksServiceForTest,
  mockPrisma,
  mockS3,
  mockPhotoDescriptor,
  mockPhotoPortrait,
} from './books.service.test-helpers';

const file = { buffer: Buffer.from([1, 2, 3]), mimetype: 'image/jpeg' };
const pendingChildBook = { userId: 'user-1', protagonistMode: 'child', status: 'pending' };

describe('BooksService photo character', () => {
  let service: BooksService;

  beforeEach(async () => {
    service = await createBooksServiceForTest();
  });

  describe('uploadChildPhoto', () => {
    it('stores the downscaled photo + descriptor when a child face is found', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce(pendingChildBook);
      mockPhotoDescriptor.describePhoto.mockResolvedValueOnce({
        hasChildFace: true,
        ageYears: 5,
        descriptor: 'round face, blue eyes',
      });

      const result = await service.uploadChildPhoto('user-1', 'b1', file, true);

      expect(mockS3.uploadObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'books/b1/upload', contentType: 'image/jpeg' }),
      );
      expect(mockPrisma.book.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: {
          childPhotoKey: 'books/b1/upload',
          characterDescriptor: 'round face, blue eyes',
          photoConsent: true,
        },
      });
      expect(result).toEqual({ descriptor: 'round face, blue eyes' });
    });

    it('rejects without parental consent', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce(pendingChildBook);
      await expect(service.uploadChildPhoto('user-1', 'b1', file, false)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockS3.uploadObject).not.toHaveBeenCalled();
    });

    it('rejects a photo with no child face and stores nothing', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce(pendingChildBook);
      mockPhotoDescriptor.describePhoto.mockResolvedValueOnce({
        hasChildFace: false,
        ageYears: null,
        descriptor: '',
      });
      await expect(service.uploadChildPhoto('user-1', 'b1', file, true)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockS3.uploadObject).not.toHaveBeenCalled();
      expect(mockPrisma.book.update).not.toHaveBeenCalled();
    });

    it('rejects an unsupported mime type', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce(pendingChildBook);
      await expect(
        service.uploadChildPhoto('user-1', 'b1', { ...file, mimetype: 'image/gif' }, true),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a book owned by another user', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({ ...pendingChildBook, userId: 'other' });
      await expect(service.uploadChildPhoto('user-1', 'b1', file, true)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects once generation has started', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        ...pendingChildBook,
        status: 'generating',
      });
      await expect(service.uploadChildPhoto('user-1', 'b1', file, true)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('buildPortraitPreview', () => {
    it('builds the portrait and applies an edited descriptor first', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce(pendingChildBook);
      mockPhotoPortrait.buildPortrait.mockResolvedValueOnce({
        portraitKey: 'books/b1/portrait.png',
        descriptor: 'edited desc',
      });

      const result = await service.buildPortraitPreview('user-1', 'b1', '  edited desc  ');

      expect(mockPrisma.book.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { characterDescriptor: 'edited desc' },
      });
      expect(mockPhotoPortrait.buildPortrait).toHaveBeenCalledWith('b1');
      expect(result.portraitKey).toBe('books/b1/portrait.png');
    });

    it('skips the descriptor update when none is provided', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce(pendingChildBook);
      mockPhotoPortrait.buildPortrait.mockResolvedValueOnce({
        portraitKey: 'books/b1/portrait.png',
        descriptor: 'stored desc',
      });

      await service.buildPortraitPreview('user-1', 'b1');

      expect(mockPrisma.book.update).not.toHaveBeenCalled();
      expect(mockPhotoPortrait.buildPortrait).toHaveBeenCalledWith('b1');
    });
  });
});
