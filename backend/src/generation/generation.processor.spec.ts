jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
  BookStatus: { generating: 'generating', ready: 'ready', failed: 'failed', pending: 'pending' },
}));

import { Test } from '@nestjs/testing';
import { type Job } from 'bullmq';
import { BookStatus } from '../../generated/prisma/client';
import { GenerationProcessor } from './generation.processor';
import { PrismaService } from '../prisma/prisma.service';
import { StoryOrchestratorService } from '../ai/story-generator/story-orchestrator.service';
import { ImageGeneratorService } from '../ai/image-generator/image-generator.service';
import type { GenerateBookPayload } from './generation.types';
import type { Story } from '../ai/schemas';

const mockStory: Story = {
  title: 'Test Story',
  pages: [
    { template: 'cover', text: null, title: 'Test Story', illustrationPrompt: 'cover art' },
    { template: 'image-top', text: 'Once upon a time', title: null, illustrationPrompt: 'scene' },
    { template: 'final', text: 'The end', title: null, illustrationPrompt: 'ending' },
  ],
  discussionQuestions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
};

const mockBook = {
  id: 'book-1',
  child: { name: 'Маша', age: 6 },
  learningGoal: { title: 'дружба', description: 'научиться дружить' },
};

const mockPrisma = {
  book: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockOrchestrator = {
  generate: jest.fn(),
};

const mockImageGen = {
  generate: jest.fn(),
};

const makeJob = (data: GenerateBookPayload): Job<GenerateBookPayload> =>
  ({
    id: 'job-1',
    data,
    updateProgress: jest.fn(),
  }) as unknown as Job<GenerateBookPayload>;

describe('GenerationProcessor', () => {
  let processor: GenerationProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GenerationProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StoryOrchestratorService, useValue: mockOrchestrator },
        { provide: ImageGeneratorService, useValue: mockImageGen },
      ],
    }).compile();
    processor = module.get(GenerationProcessor);
  });

  it('persists storyJson before image-gen, then imageUrls + status=ready after', async () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique.mockResolvedValueOnce(mockBook);
    mockOrchestrator.generate.mockResolvedValueOnce({
      story: mockStory,
      evalId: 'eval-1',
      attempts: 1,
    });
    mockImageGen.generate.mockResolvedValueOnce(['url-1', 'url-2', 'url-3']);

    const job = makeJob({ bookId: 'book-1', userId: 'user-1' });
    await processor.process(job);

    expect(mockPrisma.book.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'book-1' },
      data: { status: BookStatus.generating },
    });
    expect(mockPrisma.book.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'book-1' },
      data: { storyJson: mockStory },
    });
    expect(mockImageGen.generate).toHaveBeenCalledWith({ story: mockStory, bookId: 'book-1' });
    expect(mockPrisma.book.update).toHaveBeenNthCalledWith(3, {
      where: { id: 'book-1' },
      data: { imageUrls: ['url-1', 'url-2', 'url-3'], status: BookStatus.ready },
    });
  });

  it('preserves storyJson when image-gen fails (status=failed but storyJson saved)', async () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique.mockResolvedValueOnce(mockBook);
    mockOrchestrator.generate.mockResolvedValueOnce({
      story: mockStory,
      evalId: 'eval-1',
      attempts: 1,
    });
    mockImageGen.generate.mockRejectedValueOnce(new Error('DALL-E rate limit'));

    const job = makeJob({ bookId: 'book-1', userId: 'user-1' });
    await expect(processor.process(job)).rejects.toThrow('DALL-E rate limit');

    expect(mockPrisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { storyJson: mockStory },
    });
    expect(mockPrisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { status: BookStatus.failed },
    });
  });

  it('sets status=failed and rethrows on orchestrator error before storyJson write', async () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique.mockResolvedValueOnce(mockBook);
    mockOrchestrator.generate.mockRejectedValueOnce(new Error('generation failed'));

    const job = makeJob({ bookId: 'book-1', userId: 'user-1' });
    await expect(processor.process(job)).rejects.toThrow('generation failed');

    expect(mockImageGen.generate).not.toHaveBeenCalled();
    expect(mockPrisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { status: BookStatus.failed },
    });
  });

  it('sets status=failed and rethrows when book not found after status=generating', async () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique.mockResolvedValueOnce(null);

    const job = makeJob({ bookId: 'missing-book', userId: 'user-1' });
    await expect(processor.process(job)).rejects.toThrow('missing-book not found');

    expect(mockPrisma.book.update).toHaveBeenCalledWith({
      where: { id: 'missing-book' },
      data: { status: BookStatus.failed },
    });
  });

  it('does not call setStatus(failed) when setStatus(generating) itself throws', async () => {
    mockPrisma.book.update.mockRejectedValueOnce(new Error('DB connection error'));

    const job = makeJob({ bookId: 'book-1', userId: 'user-1' });
    await expect(processor.process(job)).rejects.toThrow('DB connection error');

    expect(mockPrisma.book.update).toHaveBeenCalledTimes(1);
  });
});
