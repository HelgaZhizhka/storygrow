jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

import { Test } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';

const mockGeneration = {
  enqueueBook: jest.fn(),
  getJobStatus: jest.fn(),
};

describe('GenerationController', () => {
  let controller: GenerationController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [GenerationController],
      providers: [{ provide: GenerationService, useValue: mockGeneration }],
    }).compile();
    controller = module.get(GenerationController);
  });

  it('returns jobId on successful enqueue', async () => {
    mockGeneration.enqueueBook.mockResolvedValueOnce({ jobId: 'job-1' });
    const result = await controller.generate('book-1', {
      sub: 'user-1',
      email: 'a@b.com',
      role: 'user' as const,
    });
    expect(result).toEqual({ jobId: 'job-1' });
    expect(mockGeneration.enqueueBook).toHaveBeenCalledWith('book-1', 'user-1');
  });

  it('propagates NotFoundException from service', async () => {
    mockGeneration.enqueueBook.mockRejectedValueOnce(new NotFoundException());
    await expect(
      controller.generate('bad-book', { sub: 'user-1', email: 'a@b.com', role: 'user' as const }),
    ).rejects.toThrow(NotFoundException);
  });

  it('propagates ConflictException from service', async () => {
    mockGeneration.enqueueBook.mockRejectedValueOnce(new ConflictException());
    await expect(
      controller.generate('book-1', { sub: 'user-1', email: 'a@b.com', role: 'user' as const }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('GenerationController.getJobStatus', () => {
  let controller: GenerationController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [GenerationController],
      providers: [{ provide: GenerationService, useValue: mockGeneration }],
    }).compile();
    controller = module.get(GenerationController);
  });

  it('returns status when job exists', async () => {
    mockGeneration.getJobStatus.mockResolvedValueOnce('active');
    const result = await controller.getJobStatus('job-1');
    expect(result).toEqual({ status: 'active' });
  });

  it('throws NotFoundException when job does not exist', async () => {
    mockGeneration.getJobStatus.mockResolvedValueOnce(null);
    await expect(controller.getJobStatus('unknown')).rejects.toThrow(NotFoundException);
  });
});
