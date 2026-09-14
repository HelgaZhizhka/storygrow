// jest.mock is per test file (hoisted above the imports of THIS module), so
// the Prisma client and puppeteer mocks are repeated here, not in the helpers.
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
jest.mock('puppeteer', () => ({ __esModule: true, default: { launch: jest.fn() } }));

import { BookStatus } from '../generated/prisma/client';
import type { GenerationProcessor } from './generation.processor';
import {
  buildProcessor,
  makeJob,
  mockBook,
  mockBookImage,
  mockImageGen,
  mockOrchestrator,
  mockPdfRender,
  mockPrisma,
  mockStory,
} from './generation.processor.test-helpers';

describe('GenerationProcessor', () => {
  let processor: GenerationProcessor;

  beforeEach(async () => {
    processor = await buildProcessor();
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
      data: { storyJson: mockStory, title: mockStory.title },
    });
    expect(mockOrchestrator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        protagonistMode: 'child',
        gender: 'female',
        appearance: 'brown hair',
      }),
    );
    expect(mockImageGen.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        story: mockStory,
        bookId: 'book-1',
        artStyle: 'watercolor',
        approvedPortraitKey: null,
        characterDescriptor: null,
        run: 1,
        reuse: undefined,
      }),
    );
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
      data: { storyJson: mockStory, title: mockStory.title },
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
      data: { storyJson: mockStory, title: mockStory.title },
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
    expect(mockImageGen.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        story: mockStory,
        bookId: 'book-1',
        artStyle: 'watercolor',
        approvedPortraitKey: null,
        characterDescriptor: null,
        run: 1,
        reuse: { portraitKey: null, referenceImageKeys: [] },
      }),
    );
  });

  it('retry after images_failed: run 2, reuses the saved portrait + sheets, persists artefacts early (#374)', async () => {
    const bookWithArtefacts = {
      ...mockBook,
      storyJson: mockStory,
      imageKeys: [],
      characterPortraitKey: 'books/book-1/portrait.png',
      referenceImageKeys: ['books/book-1/ref-location-home.png'],
    };
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique.mockResolvedValueOnce(bookWithArtefacts);
    mockPrisma.imageEval.aggregate.mockResolvedValueOnce({ _max: { run: 1 } });
    mockImageGen.generate.mockImplementationOnce(
      async (input: {
        onArtefacts?: (a: {
          characterPortraitKey: string | null;
          referenceImageKeys: string[];
        }) => Promise<void>;
      }) => {
        await input.onArtefacts?.({
          characterPortraitKey: 'books/book-1/portrait.png',
          referenceImageKeys: ['books/book-1/ref-location-home.png'],
        });
        return {
          imageKeys: ['k1'],
          characterPortraitKey: 'books/book-1/portrait.png',
          referenceImageKeys: ['books/book-1/ref-location-home.png'],
        };
      },
    );
    mockBookImage.signKeys.mockResolvedValueOnce(['u1']);
    mockPdfRender.render.mockResolvedValueOnce('books/book-1/book.pdf');

    await processor.process(makeJob({ bookId: 'book-1', userId: 'user-1' }));

    expect(mockImageGen.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        run: 2,
        reuse: {
          portraitKey: 'books/book-1/portrait.png',
          referenceImageKeys: ['books/book-1/ref-location-home.png'],
        },
      }),
    );
    // artefacts were written to the Book before the pages finished
    expect(mockPrisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: {
        characterPortraitKey: 'books/book-1/portrait.png',
        referenceImageKeys: ['books/book-1/ref-location-home.png'],
      },
    });
  });

  it('does not reuse artefacts when the story itself was regenerated', async () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.book.findUnique.mockResolvedValueOnce({
      ...mockBook,
      characterPortraitKey: 'books/book-1/portrait.png',
      referenceImageKeys: ['books/book-1/ref-location-home.png'],
    });
    mockOrchestrator.generate.mockResolvedValueOnce({ story: mockStory, attempts: 1 });
    mockImageGen.generate.mockResolvedValueOnce({
      imageKeys: ['k1'],
      characterPortraitKey: null,
      referenceImageKeys: [],
    });
    mockBookImage.signKeys.mockResolvedValueOnce(['u1']);
    mockPdfRender.render.mockResolvedValueOnce('books/book-1/book.pdf');

    await processor.process(makeJob({ bookId: 'book-1', userId: 'user-1' }));

    expect(mockImageGen.generate).toHaveBeenCalledWith(
      expect.objectContaining({ reuse: undefined }),
    );
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
