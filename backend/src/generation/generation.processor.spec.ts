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

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}));

import { Test } from '@nestjs/testing';
import { type Job } from 'bullmq';
import { BookStatus } from '../generated/prisma/client';
import { GenerationProcessor } from './generation.processor';
import { PrismaService } from '../prisma/prisma.service';
import { StoryOrchestratorService } from '../ai/story-generator/story-orchestrator.service';
import { ImageGeneratorService } from '../ai/image-generator/image-generator.service';
import { BookImageService } from '../books/book-image.service';
import { BookProgressService } from '../books/book-progress.service';
import { PdfRenderService } from '../pdf/pdf-render.service';
import type { GenerateBookPayload } from './generation.types';
import type { Story } from '../ai/schemas';

const mockStory: Story = {
  title: 'Test Story',
  characterProfile: '6-year-old boy with blond hair',
  pages: [
    { template: 'cover', text: null, title: 'Test Story', illustrationPrompt: 'cover art' },
    { template: 'image-top', text: 'Once upon a time', title: null, illustrationPrompt: 'scene' },
    { template: 'final', text: 'The end', title: null, illustrationPrompt: 'ending' },
  ],
  discussionQuestions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
};

const mockBook = {
  id: 'book-1',
  storyJson: null,
  imageKeys: [] as string[],
  protagonistMode: 'child' as const,
  artStyle: 'watercolor' as const,
  child: { name: 'Маша', age: 6, gender: 'female', appearance: 'brown hair' },
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

const mockBookImage = {
  signKeys: jest.fn(),
  signKey: jest.fn(),
};

const mockPdfRender = {
  render: jest.fn(),
};

const mockBookProgress = {
  emit: jest.fn(),
  stream: jest.fn(),
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
        { provide: BookImageService, useValue: mockBookImage },
        { provide: PdfRenderService, useValue: mockPdfRender },
        { provide: BookProgressService, useValue: mockBookProgress },
      ],
    }).compile();
    processor = module.get(GenerationProcessor);
  });

  it('runs full pipeline: story → persist → images → persist → pdf → ready', async () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique.mockResolvedValueOnce(mockBook);
    mockOrchestrator.generate.mockResolvedValueOnce({
      story: mockStory,
      evalId: 'eval-1',
      attempts: 1,
    });
    const keys = ['books/book-1/page-1.png', 'books/book-1/page-2.png', 'books/book-1/page-3.png'];
    mockImageGen.generate.mockResolvedValueOnce({
      imageKeys: keys,
      characterPortraitKey: 'books/book-1/portrait.png',
    });
    mockBookImage.signKeys.mockResolvedValueOnce([
      'https://signed/p1',
      'https://signed/p2',
      'https://signed/p3',
    ]);
    mockPdfRender.render.mockResolvedValueOnce('books/book-1/book.pdf');

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
    expect(mockOrchestrator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        protagonistMode: 'child',
        gender: 'female',
        appearance: 'brown hair',
      }),
    );
    expect(mockImageGen.generate).toHaveBeenCalledWith({
      story: mockStory,
      bookId: 'book-1',
      artStyle: 'watercolor',
    });
    expect(mockPrisma.book.update).toHaveBeenNthCalledWith(3, {
      where: { id: 'book-1' },
      data: { imageKeys: keys, characterPortraitKey: 'books/book-1/portrait.png' },
    });
    expect(mockBookImage.signKeys).toHaveBeenCalledWith(keys);
    expect(mockPdfRender.render).toHaveBeenCalledWith({
      bookId: 'book-1',
      story: mockStory,
      illustrationUrls: ['https://signed/p1', 'https://signed/p2', 'https://signed/p3'],
    });
    expect(mockPrisma.book.update).toHaveBeenNthCalledWith(4, {
      where: { id: 'book-1' },
      data: { pdfKey: 'books/book-1/book.pdf', status: BookStatus.ready },
    });
  });

  it('preserves storyJson + imageKeys when PDF render fails (ordered)', async () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique
      .mockResolvedValueOnce(mockBook)
      .mockResolvedValueOnce({ storyJson: mockStory });
    mockOrchestrator.generate.mockResolvedValueOnce({
      story: mockStory,
      evalId: 'eval-1',
      attempts: 1,
    });
    mockImageGen.generate.mockResolvedValueOnce({
      imageKeys: ['k1', 'k2', 'k3'],
      characterPortraitKey: null,
    });
    mockBookImage.signKeys.mockResolvedValueOnce(['u1', 'u2', 'u3']);
    mockPdfRender.render.mockRejectedValueOnce(new Error('puppeteer crashed'));

    const job = makeJob({ bookId: 'book-1', userId: 'user-1' });
    await expect(processor.process(job)).rejects.toThrow('puppeteer crashed');

    // Asserting ORDER (not just presence): storyJson MUST be persisted before
    // imageKeys, and both before status=images_failed. A regression that reorders the
    // pipeline would lose the validated story on PDF failure.
    expect(mockPrisma.book.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'book-1' },
      data: { status: BookStatus.generating },
    });
    expect(mockPrisma.book.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'book-1' },
      data: { storyJson: mockStory },
    });
    expect(mockPrisma.book.update).toHaveBeenNthCalledWith(3, {
      where: { id: 'book-1' },
      data: { imageKeys: ['k1', 'k2', 'k3'], characterPortraitKey: null },
    });
    expect(mockPrisma.book.update).toHaveBeenNthCalledWith(4, {
      where: { id: 'book-1' },
      data: { status: BookStatus.images_failed },
    });
  });

  it('sets status=images_failed when image-gen fails after storyJson is saved', async () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique
      .mockResolvedValueOnce(mockBook)
      .mockResolvedValueOnce({ storyJson: mockStory });
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
      data: { status: BookStatus.images_failed },
    });
  });

  it('sets status=failed and rethrows on orchestrator error before storyJson write', async () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique
      .mockResolvedValueOnce(mockBook)
      .mockResolvedValueOnce({ storyJson: null });
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
    mockPrisma.book.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

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

  it('skips orchestrator on retry when storyJson is already saved', async () => {
    const bookWithStory = { ...mockBook, storyJson: mockStory, imageKeys: [] };
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique.mockResolvedValueOnce(bookWithStory);
    const keys = ['k1', 'k2', 'k3'];
    mockImageGen.generate.mockResolvedValueOnce({ imageKeys: keys, characterPortraitKey: null });
    mockBookImage.signKeys.mockResolvedValueOnce(['u1', 'u2', 'u3']);
    mockPdfRender.render.mockResolvedValueOnce('books/book-1/book.pdf');

    const job = makeJob({ bookId: 'book-1', userId: 'user-1' });
    await processor.process(job);

    expect(mockOrchestrator.generate).not.toHaveBeenCalled();
    expect(mockImageGen.generate).toHaveBeenCalledWith({
      story: mockStory,
      bookId: 'book-1',
      artStyle: 'watercolor',
    });
  });

  it('skips both orchestrator and image-gen on retry when both storyJson and imageKeys are saved', async () => {
    const savedKeys = ['k1', 'k2', 'k3'];
    const bookWithStoryAndImages = { ...mockBook, storyJson: mockStory, imageKeys: savedKeys };
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique.mockResolvedValueOnce(bookWithStoryAndImages);
    mockBookImage.signKeys.mockResolvedValueOnce(['u1', 'u2', 'u3']);
    mockPdfRender.render.mockResolvedValueOnce('books/book-1/book.pdf');

    const job = makeJob({ bookId: 'book-1', userId: 'user-1' });
    await processor.process(job);

    expect(mockOrchestrator.generate).not.toHaveBeenCalled();
    expect(mockImageGen.generate).not.toHaveBeenCalled();
    expect(mockBookImage.signKeys).toHaveBeenCalledWith(savedKeys);
  });
});
