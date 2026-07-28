import { mockPrisma, mockS3, createBooksServiceForTest } from './books.service.test-helpers';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BooksService } from './books.service';

describe('BooksService.deleteBook', () => {
  let service: BooksService;

  beforeEach(async () => {
    service = await createBooksServiceForTest();
  });

  it('deletes S3 assets then the book row for a finished (ready) book', async () => {
    mockPrisma.book.findFirst.mockResolvedValueOnce({
      id: 'book-1',
      status: 'ready',
      imageKeys: ['books/book-1/page-1.png'],
      characterPortraitKey: 'books/book-1/portrait.png',
      pdfKey: 'books/book-1/book.pdf',
    });

    await service.deleteBook('user-1', 'book-1');

    expect(mockS3.deleteObjects).toHaveBeenCalledWith([
      'books/book-1/page-1.png',
      'books/book-1/portrait.png',
      'books/book-1/book.pdf',
    ]);
    expect(mockPrisma.book.delete).toHaveBeenCalledWith({ where: { id: 'book-1' } });
  });

  it("throws 404 and does not delete when the book is not the user's", async () => {
    mockPrisma.book.findFirst.mockResolvedValueOnce(null);

    await expect(service.deleteBook('user-1', 'book-x')).rejects.toThrow(NotFoundException);
    expect(mockS3.deleteObjects).not.toHaveBeenCalled();
    expect(mockPrisma.book.delete).not.toHaveBeenCalled();
  });

  it('throws 409 and does not delete a book that is still generating — otherwise reserve→delete bypasses the quota entirely (#280)', async () => {
    mockPrisma.book.findFirst.mockResolvedValueOnce({
      id: 'book-1',
      status: 'generating',
      imageKeys: [],
      characterPortraitKey: null,
      pdfKey: null,
    });

    await expect(service.deleteBook('user-1', 'book-1')).rejects.toThrow(ConflictException);
    expect(mockS3.deleteObjects).not.toHaveBeenCalled();
    expect(mockPrisma.book.delete).not.toHaveBeenCalled();
  });

  it('allows deleting a failed book — the stale sweeper is what resolves stuck generating ones', async () => {
    mockPrisma.book.findFirst.mockResolvedValueOnce({
      id: 'book-1',
      status: 'failed',
      imageKeys: [],
      characterPortraitKey: null,
      pdfKey: null,
    });

    await service.deleteBook('user-1', 'book-1');

    expect(mockPrisma.book.delete).toHaveBeenCalledWith({ where: { id: 'book-1' } });
  });

  it('allows deleting a pending (draft) book immediately — it has no background work or cost attached (#280)', async () => {
    mockPrisma.book.findFirst.mockResolvedValueOnce({
      id: 'book-1',
      status: 'pending',
      imageKeys: [],
      characterPortraitKey: null,
      pdfKey: null,
    });

    await service.deleteBook('user-1', 'book-1');

    expect(mockPrisma.book.delete).toHaveBeenCalledWith({ where: { id: 'book-1' } });
  });
});
