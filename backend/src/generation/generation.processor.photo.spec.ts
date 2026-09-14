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

import type { GenerationProcessor } from './generation.processor';
import {
  buildProcessor,
  makeJob,
  mockBook,
  mockBookImage,
  mockImageGen,
  mockPdfRender,
  mockPrisma,
  mockStory,
} from './generation.processor.test-helpers';

describe('GenerationProcessor photo mode hero look (#376)', () => {
  let processor: GenerationProcessor;

  beforeEach(async () => {
    processor = await buildProcessor();
  });

  const photoBook = {
    ...mockBook,
    storyJson: mockStory,
    imageKeys: [],
    characterDescriptor: 'Овальное лицо, светлая кожа, большие серые глаза',
    characterPortraitKey: 'books/book-1/portrait.png',
  };
  const finish = () => {
    mockPrisma.book.update.mockResolvedValue({});
    mockImageGen.generate.mockResolvedValueOnce({
      imageKeys: ['k1'],
      characterPortraitKey: 'books/book-1/portrait.png',
      referenceImageKeys: [],
    });
    mockBookImage.signKeys.mockResolvedValueOnce(['u1']);
    mockPdfRender.render.mockResolvedValueOnce('books/book-1/book.pdf');
  };

  it('passes the English structured look (kind from age + gender) to the image pipeline', async () => {
    mockPrisma.book.findUnique.mockResolvedValueOnce({
      ...photoBook,
      characterAppearance: {
        kind: 'x',
        skin: 'light skin',
        hair: 'blond hair',
        outfit: 'a red hoodie',
        detail: 'freckles',
      },
    });
    finish();
    await processor.process(makeJob({ bookId: 'book-1', userId: 'user-1' }));
    expect(mockImageGen.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        approvedPortraitKey: 'books/book-1/portrait.png',
        characterDescriptor:
          '6-year-old girl, light skin, blond hair, wearing a red hoodie, freckles',
      }),
    );
  });

  it('falls back to the Russian face line for books uploaded before #376', async () => {
    mockPrisma.book.findUnique.mockResolvedValueOnce({ ...photoBook, characterAppearance: null });
    finish();
    await processor.process(makeJob({ bookId: 'book-1', userId: 'user-1' }));
    expect(mockImageGen.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        characterDescriptor: 'Овальное лицо, светлая кожа, большие серые глаза',
      }),
    );
  });
});
