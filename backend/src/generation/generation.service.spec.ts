jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  BookStatus: { generating: 'generating', ready: 'ready', failed: 'failed', pending: 'pending' },
}));

import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { GENERATION_QUEUE, GENERATE_BOOK_JOB } from './generation.types';

const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
};

const mockPrisma = {
  book: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockS3 = {
  deleteObjects: jest.fn(),
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
        { provide: S3Service, useValue: mockS3 },
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

    it('blocks a photo book whose portrait is not yet approved', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: bookId,
        userId,
        status: 'pending',
        characterDescriptor: 'round face, blue eyes',
        characterPortraitKey: null,
        childPhotoKey: 'books/book-1/upload',
      });
      await expect(service.enqueueBook(bookId, userId)).rejects.toThrow(ConflictException);
      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(mockS3.deleteObjects).not.toHaveBeenCalled();
    });

    it('deletes the raw photo before enqueuing an approved photo book', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: bookId,
        userId,
        status: 'pending',
        characterDescriptor: 'round face, blue eyes',
        characterPortraitKey: 'books/book-1/portrait.png',
        childPhotoKey: 'books/book-1/upload',
      });
      mockQueue.add.mockResolvedValueOnce({ id: 'job-77' });

      const result = await service.enqueueBook(bookId, userId);

      expect(mockS3.deleteObjects).toHaveBeenCalledWith(['books/book-1/upload']);
      expect(mockPrisma.book.update).toHaveBeenCalledWith({
        where: { id: bookId },
        data: { childPhotoKey: null },
      });
      expect(mockQueue.add).toHaveBeenCalledWith(GENERATE_BOOK_JOB, { bookId, userId });
      expect(result.jobId).toBe('job-77');
    });
  });

  describe('getJobStatus', () => {
    it('returns null when job does not exist', async () => {
      mockQueue.getJob.mockResolvedValueOnce(null);
      const result = await service.getJobStatus('unknown-job', userId);
      expect(result).toBeNull();
    });

    it('returns null when job belongs to a different user', async () => {
      mockQueue.getJob.mockResolvedValueOnce({
        data: { userId: 'other-user', bookId },
        getState: jest.fn(),
      });
      const result = await service.getJobStatus('job-1', userId);
      expect(result).toBeNull();
    });

    it('returns job state when job exists and userId matches', async () => {
      mockQueue.getJob.mockResolvedValueOnce({
        data: { userId, bookId },
        getState: jest.fn().mockResolvedValueOnce('active'),
      });
      const result = await service.getJobStatus('job-1', userId);
      expect(result).toBe('active');
    });
  });
});
