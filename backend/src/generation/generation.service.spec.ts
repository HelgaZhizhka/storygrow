jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { PrismaService } from '../prisma/prisma.service';
import { GENERATION_QUEUE, GENERATE_BOOK_JOB } from './generation.types';

const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
};

const mockPrisma = {
  book: {
    findUnique: jest.fn(),
  },
};

const userId = 'user-1';
const bookId = 'book-1';

describe('GenerationService', () => {
  let service: GenerationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GenerationService,
        { provide: getQueueToken(GENERATION_QUEUE), useValue: mockQueue },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(GenerationService);
  });

  describe('enqueueBook', () => {
    it('throws NotFoundException when book does not exist', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce(null);
      await expect(service.enqueueBook(bookId, userId)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when book belongs to a different user', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: bookId,
        userId: 'other-user',
        status: 'pending',
      });
      await expect(service.enqueueBook(bookId, userId)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when book is already generating', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: bookId,
        userId,
        status: 'generating',
      });
      await expect(service.enqueueBook(bookId, userId)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when book is already ready', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({ id: bookId, userId, status: 'ready' });
      await expect(service.enqueueBook(bookId, userId)).rejects.toThrow(ConflictException);
    });

    it('adds generateBook job to queue and returns jobId', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({ id: bookId, userId, status: 'pending' });
      mockQueue.add.mockResolvedValueOnce({ id: 'job-42' });

      const result = await service.enqueueBook(bookId, userId);

      expect(mockQueue.add).toHaveBeenCalledWith(GENERATE_BOOK_JOB, { bookId, userId });
      expect(result.jobId).toBe('job-42');
    });
  });

  describe('getJobStatus', () => {
    it('returns null when job does not exist', async () => {
      mockQueue.getJob.mockResolvedValueOnce(null);
      const result = await service.getJobStatus('unknown-job');
      expect(result).toBeNull();
    });

    it('returns job state when job exists', async () => {
      mockQueue.getJob.mockResolvedValueOnce({
        getState: jest.fn().mockResolvedValueOnce('active'),
      });
      const result = await service.getJobStatus('job-1');
      expect(result).toBe('active');
    });
  });
});
