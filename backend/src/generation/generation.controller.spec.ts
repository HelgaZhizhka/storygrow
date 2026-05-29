jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

import { Test } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';

const mockGeneration = {
  enqueueBook: jest.fn(),
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
    const result = await controller.generate('book-1', { sub: 'user-1', email: 'a@b.com' });
    expect(result).toEqual({ jobId: 'job-1' });
    expect(mockGeneration.enqueueBook).toHaveBeenCalledWith('book-1', 'user-1');
  });

  it('propagates NotFoundException from service', async () => {
    mockGeneration.enqueueBook.mockRejectedValueOnce(new NotFoundException());
    await expect(
      controller.generate('bad-book', { sub: 'user-1', email: 'a@b.com' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('propagates ConflictException from service', async () => {
    mockGeneration.enqueueBook.mockRejectedValueOnce(new ConflictException());
    await expect(
      controller.generate('book-1', { sub: 'user-1', email: 'a@b.com' }),
    ).rejects.toThrow(ConflictException);
  });
});
