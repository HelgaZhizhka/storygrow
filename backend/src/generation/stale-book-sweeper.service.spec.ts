jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  BookStatus: {
    generating: 'generating',
    ready: 'ready',
    failed: 'failed',
    pending: 'pending',
    images_failed: 'images_failed',
  },
}));

import { Test } from '@nestjs/testing';
import { BookStatus } from '../generated/prisma/client';
import { StaleBooksSweeperService } from './stale-book-sweeper.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookProgressService } from '../books/book-progress.service';

const mockPrisma = {
  book: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockBookProgress = { emit: jest.fn() };

describe('StaleBooksSweeperService', () => {
  let service: StaleBooksSweeperService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        StaleBooksSweeperService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookProgressService, useValue: mockBookProgress },
      ],
    }).compile();
    service = module.get(StaleBooksSweeperService);
  });

  it('returns 0 and makes no DB writes when no stale books', async () => {
    mockPrisma.book.findMany.mockResolvedValueOnce([]);

    const count = await service.sweep();

    expect(count).toBe(0);
    expect(mockPrisma.book.update).not.toHaveBeenCalled();
  });

  it('sets images_failed for stale book with storyJson', async () => {
    const staleBook = {
      id: 'book-1',
      storyJson: { title: 'T', pages: [] },
      updatedAt: new Date(Date.now() - 20 * 60 * 1000),
    };
    mockPrisma.book.findMany.mockResolvedValueOnce([staleBook]);
    mockPrisma.book.update.mockResolvedValue({});

    const count = await service.sweep();

    expect(count).toBe(1);
    expect(mockPrisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { status: BookStatus.images_failed },
    });
    expect(mockBookProgress.emit).toHaveBeenCalledWith('book-1', {
      type: 'failed',
      message: 'Ошибка генерации',
    });
  });

  it('sets failed for stale book without storyJson', async () => {
    const staleBook = {
      id: 'book-2',
      storyJson: null,
      updatedAt: new Date(Date.now() - 15 * 60 * 1000),
    };
    mockPrisma.book.findMany.mockResolvedValueOnce([staleBook]);
    mockPrisma.book.update.mockResolvedValue({});

    await service.sweep();

    expect(mockPrisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-2' },
      data: { status: BookStatus.failed },
    });
  });

  it('processes multiple stale books in parallel', async () => {
    const staleBooks = [
      { id: 'b1', storyJson: null, updatedAt: new Date(Date.now() - 11 * 60 * 1000) },
      { id: 'b2', storyJson: { title: 'T' }, updatedAt: new Date(Date.now() - 12 * 60 * 1000) },
    ];
    mockPrisma.book.findMany.mockResolvedValueOnce(staleBooks);
    mockPrisma.book.update.mockResolvedValue({});

    const count = await service.sweep();

    expect(count).toBe(2);
    expect(mockPrisma.book.update).toHaveBeenCalledTimes(2);
  });

  it('queries pending and generating books older than threshold (#280)', async () => {
    mockPrisma.book.findMany.mockResolvedValueOnce([]);

    await service.sweep();

    const [callArgs] = mockPrisma.book.findMany.mock.calls[0] as [
      { where: { status: { in: string[] }; updatedAt: { lt: Date } } },
    ];
    expect(callArgs.where.status).toEqual({ in: [BookStatus.pending, BookStatus.generating] });
    expect(callArgs.where.updatedAt.lt).toBeInstanceOf(Date);
  });

  it('sets failed for a stale pending book that never got a follow-up generate call', async () => {
    const staleBook = {
      id: 'book-3',
      storyJson: null,
      updatedAt: new Date(Date.now() - 15 * 60 * 1000),
    };
    mockPrisma.book.findMany.mockResolvedValueOnce([staleBook]);
    mockPrisma.book.update.mockResolvedValue({});

    await service.sweep();

    expect(mockPrisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-3' },
      data: { status: BookStatus.failed },
    });
  });
});
