jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

import { Test } from '@nestjs/testing';
import { type Job } from 'bullmq';
import { GenerationProcessor } from './generation.processor';
import { PrismaService } from '../prisma/prisma.service';
import { StoryOrchestratorService } from '../ai/story-generator/story-orchestrator.service';
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
      ],
    }).compile();
    processor = module.get(GenerationProcessor);
  });

  it('sets status=generating, calls orchestrator, saves storyJson, sets status=ready', async () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique.mockResolvedValueOnce(mockBook);
    mockOrchestrator.generate.mockResolvedValueOnce({
      story: mockStory,
      evalId: 'eval-1',
      attempts: 1,
    });

    const job = makeJob({ bookId: 'book-1', userId: 'user-1' });
    await processor.process(job);

    expect(mockPrisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { status: 'generating' },
    });
    expect(mockOrchestrator.generate).toHaveBeenCalledWith({
      bookId: 'book-1',
      childName: 'Маша',
      childAge: 6,
      topic: 'дружба',
      learningGoal: 'научиться дружить',
    });
    expect(mockPrisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { storyJson: mockStory, status: 'ready' },
    });
  });

  it('sets status=failed and rethrows on orchestrator error', async () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique.mockResolvedValueOnce(mockBook);
    const error = new Error('generation failed');
    mockOrchestrator.generate.mockRejectedValueOnce(error);

    const job = makeJob({ bookId: 'book-1', userId: 'user-1' });
    await expect(processor.process(job)).rejects.toThrow('generation failed');

    expect(mockPrisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { status: 'failed' },
    });
  });

  it('sets status=failed and rethrows when book not found in DB', async () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique.mockResolvedValueOnce(null);

    const job = makeJob({ bookId: 'missing-book', userId: 'user-1' });
    await expect(processor.process(job)).rejects.toThrow();

    expect(mockPrisma.book.update).toHaveBeenCalledWith({
      where: { id: 'missing-book' },
      data: { status: 'failed' },
    });
  });
});
