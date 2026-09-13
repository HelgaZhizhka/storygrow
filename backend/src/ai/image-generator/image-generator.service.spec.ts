jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

const mockGenerateImage = jest.fn();

jest.mock('ai', () => ({
  generateImage: (...args: unknown[]): unknown => mockGenerateImage(...args),
  NoImageGeneratedError: class NoImageGeneratedError extends Error {
    static isInstance(e: unknown): boolean {
      return e instanceof Error && e.constructor.name === 'NoImageGeneratedError';
    }
  },
}));

const mockGoogleImage = jest.fn((id: string) => ({ id }));
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => ({ image: (id: string) => mockGoogleImage(id) }),
}));

jest.mock('@langfuse/tracing', () => ({
  startActiveObservation: async <T>(
    _name: string,
    fn: (span: { update: jest.Mock }) => Promise<T>,
  ): Promise<T> => fn({ update: jest.fn() }),
}));

jest.mock('../telemetry', () => ({
  createTelemetry: jest.fn(() => ({ isEnabled: false })),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ImageGeneratorService } from './image-generator.service';
import { ReferenceSheetsService } from './reference-sheets.service';
import { ImageJudgeService } from './image-judge.service';
import { S3Service } from '../../s3/s3.service';
import type { Story } from '../schemas';
import { visualBibleFixture, sceneFixture } from '../schemas/__fixtures__/visual-bible.fixture';

const mockS3 = {
  uploadObject: jest.fn(),
  getSignedUrl: jest.fn(),
  getObjectBytes: jest.fn(),
};

const makeMockConfig = (imageProvider: string) => ({
  get: jest.fn((key: string) => {
    if (key === 'IMAGE_PROVIDER') return imageProvider;
    return undefined;
  }),
  getOrThrow: jest.fn(() => 'test-key'),
});

// Every story carries a Visual Bible + a scene per page: the pre-#348 legacy
// path was removed in #378 and a bible-less story is now a hard error.
const makeStory = (opts: { characterProfile?: string; pageCount?: number } = {}): Story => {
  const pageCount = opts.pageCount ?? 3;
  const characterProfile = opts.characterProfile ?? '5-year-old girl with red hair';
  return {
    title: 'Test',
    characterProfile,
    visualBible: visualBibleFixture({ hero: { name: 'Алиса', descriptor: characterProfile } }),
    pages: Array.from({ length: pageCount }, (_, i) => ({
      template: i === 0 ? ('cover' as const) : ('image-top' as const),
      text: i === 0 ? null : `page ${i}`,
      title: i === 0 ? 'Cover' : null,
      illustrationPrompt: `prompt-${i}`,
      scene: sceneFixture({ locationId: 'home', heroOnPage: true }),
    })),
    discussionQuestions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
  };
};

const makeBibleStory = (): Story => ({
  ...makeStory({ pageCount: 2 }),
  visualBible: visualBibleFixture({
    hero: { name: 'Алиса', descriptor: '5-year-old girl, red hair' },
    locations: [{ id: 'home', name: 'дом', descriptor: 'a green slide in a yard' }],
  }),
});

// The judge is a required dependency (#373); these tests exercise the image
// path, so a pass-through judge with no re-renders keeps them focused.
const passThroughJudge = () => ({
  maxRetries: 0,
  judge: jest.fn().mockResolvedValue({ passed: true, failures: [] }),
});

const makeService = async (imageProvider = 'gemini'): Promise<ImageGeneratorService> => {
  const module = await Test.createTestingModule({
    providers: [
      ImageGeneratorService,
      ReferenceSheetsService,
      { provide: ImageJudgeService, useValue: passThroughJudge() },
      { provide: S3Service, useValue: mockS3 },
      { provide: ConfigService, useValue: makeMockConfig(imageProvider) },
    ],
  }).compile();
  return module.get(ImageGeneratorService);
};

describe('ImageGeneratorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('page images (every provider takes references, #375)', () => {
    it('generates one image per page and uploads each with image/png and a deterministic key', async () => {
      const service = await makeService();
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const story = makeStory({ pageCount: 2 });
      const result = await service.generate({ story, bookId: 'book-xyz', artStyle: 'watercolor' });

      expect(result.imageKeys).toEqual(['books/book-xyz/page-1.png', 'books/book-xyz/page-2.png']);
      for (const key of result.imageKeys) {
        expect(mockS3.uploadObject).toHaveBeenCalledWith(
          expect.objectContaining({ key, contentType: 'image/png' }),
        );
      }
    });

    it('propagates a provider error as-is (no simplify-and-retry)', async () => {
      const service = await makeService();
      mockGenerateImage.mockRejectedValueOnce(new Error('network timeout'));

      const story = makeStory({ pageCount: 1 });
      await expect(
        service.generate({ story, bookId: 'b', artStyle: 'watercolor' }),
      ).rejects.toThrow('network timeout');
    });
  });

  describe('Gemini provider', () => {
    it('generates a portrait then one image per page and returns the portrait key', async () => {
      const service = await makeService('gemini');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const story = makeStory({ characterProfile: 'a girl with red curls', pageCount: 2 });
      const result = await service.generate({ story, bookId: 'book-1', artStyle: 'watercolor' });

      expect(result.imageKeys).toHaveLength(2);
      expect(result.characterPortraitKey).toBe('books/book-1/portrait.png');
      // 1 portrait + 1 location sheet + 2 pages
      expect(mockS3.uploadObject).toHaveBeenCalledTimes(4);
    });

    it('skips portrait when characterProfile is empty', async () => {
      const service = await makeService('gemini');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const story: Story = {
        title: 'No Profile',
        characterProfile: '',
        visualBible: visualBibleFixture({ hero: { name: 'Алиса', descriptor: '' } }),
        pages: [
          {
            template: 'image-top',
            text: 'text',
            title: null,
            illustrationPrompt: 'p1',
            scene: sceneFixture({ locationId: 'home', heroOnPage: true }),
          },
        ],
        discussionQuestions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
      };
      const result = await service.generate({ story, bookId: 'book-3', artStyle: 'cartoon' });

      expect(result.characterPortraitKey).toBeNull();
      // 1 location sheet + 1 page (no portrait upload)
      expect(mockS3.uploadObject).toHaveBeenCalledTimes(2);
    });

    it('photo flow: loads the approved portrait, generates no portrait, folds descriptor into pages', async () => {
      const service = await makeService('gemini');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);
      mockS3.getObjectBytes.mockResolvedValue(new Uint8Array([5, 5]));

      const story = makeStory({ characterProfile: 'a girl', pageCount: 2 });
      const result = await service.generate({
        story,
        bookId: 'book-9',
        artStyle: 'watercolor',
        approvedPortraitKey: 'books/book-9/portrait.png',
        characterDescriptor: 'round face, blue eyes',
      });

      // Approved portrait is loaded, not generated, and reused as the key.
      expect(mockS3.getObjectBytes).toHaveBeenCalledWith('books/book-9/portrait.png');
      expect(result.characterPortraitKey).toBe('books/book-9/portrait.png');
      // 1 location sheet + 2 page images are uploaded (no portrait upload).
      expect(mockS3.uploadObject).toHaveBeenCalledTimes(3);
      // Descriptor is folded into each page prompt (the provider wraps it further).
      // page calls only — the location sheet is a peopleless establishing shot
      const pageCalls = (
        mockGenerateImage.mock.calls as Array<[{ prompt: string | { text?: string } }]>
      ).filter(
        (call): call is [{ prompt: { text?: string } }] => typeof call[0].prompt === 'object',
      );
      expect(pageCalls).toHaveLength(2);
      expect(pageCalls.every(([arg]) => arg.prompt.text?.includes('round face, blue eyes.'))).toBe(
        true,
      );
    });
  });

  describe('Visual Bible path (#348)', () => {
    it('assembles the hero-lock + location prompt and passes the portrait as reference 1', async () => {
      const service = await makeService('gemini');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const result = await service.generate({
        story: makeBibleStory(),
        bookId: 'book-b',
        artStyle: 'watercolor',
      });

      expect(result.imageKeys).toHaveLength(2);
      // page calls are the ones whose prompt is an object { text, images }
      const pageCalls = mockGenerateImage.mock.calls
        .map(([arg]) => arg as { prompt: unknown })
        .filter((a) => typeof a.prompt === 'object') as Array<{
        prompt: { text: string; images: Uint8Array[] };
      }>;
      expect(pageCalls).toHaveLength(2);
      for (const call of pageCalls) {
        expect(call.prompt.text).toContain('appears exactly once');
        expect(call.prompt.text).toContain('a green slide in a yard');
        expect(call.prompt.images).toHaveLength(2); // the hero portrait + the location sheet (sheets always on)
      }
    });

    it('generates location + cast sheets and passes them as page references', async () => {
      const service = await makeService('gemini');
      mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([2]) } });
      mockS3.uploadObject.mockResolvedValue(undefined);

      const base = makeBibleStory();
      const story: Story = {
        ...base,
        visualBible: {
          ...base.visualBible!,
          cast: [
            { id: 'brother', name: 'братик', role: 'младший брат', descriptor: 'toddler boy' },
          ],
        },
        pages: base.pages.map((p) => ({
          ...p,
          scene: sceneFixture({ locationId: 'home', castIds: ['brother'], heroOnPage: true }),
        })),
      };

      const result = await service.generate({ story, bookId: 'book-on', artStyle: 'watercolor' });

      // Two sheets generated (one location + one cast) and their keys returned.
      expect(result.referenceImageKeys).toEqual(
        expect.arrayContaining([
          'books/book-on/ref-location-home.png',
          'books/book-on/ref-cast-brother.png',
        ]),
      );
      // Each page cites all three references (hero, cast, location) and passes 3 images.
      const pageCalls = mockGenerateImage.mock.calls
        .map(([arg]) => arg as { prompt: unknown })
        .filter((a) => typeof a.prompt === 'object') as Array<{
        prompt: { text: string; images: Uint8Array[] };
      }>;
      for (const call of pageCalls) {
        expect(call.prompt.images).toHaveLength(3);
        expect(call.prompt.text).toContain('братик — toddler boy');
      }
    });
  });
});

describe('ImageJudgeService wiring (DI)', () => {
  it('receives the judge through Nest DI and judges bible pages', async () => {
    mockGoogleImage.mockClear();
    mockGenerateImage.mockResolvedValue({ image: { uint8Array: new Uint8Array([1]) } });
    const judge = {
      maxRetries: 0,
      judge: jest.fn().mockResolvedValue({ passed: true, failures: [] }),
    };
    const module = await Test.createTestingModule({
      providers: [
        ImageGeneratorService,
        ReferenceSheetsService,
        { provide: ImageJudgeService, useValue: judge },
        { provide: S3Service, useValue: mockS3 },
        { provide: ConfigService, useValue: makeMockConfig('gemini') },
      ],
    }).compile();
    const service = module.get(ImageGeneratorService);
    const story: Story = {
      ...makeStory({ pageCount: 2 }),
      visualBible: visualBibleFixture(),
      pages: makeStory({ pageCount: 2 }).pages.map((p) => ({ ...p, scene: sceneFixture() })),
    };
    await service.generate({ story, bookId: 'b-di', artStyle: 'watercolor' });
    expect(judge.judge).toHaveBeenCalledTimes(2);
  });
});

describe('no Visual Bible (#378)', () => {
  it('fails loud instead of falling back to the removed legacy prompt', async () => {
    const service = await makeService('gemini');
    const { visualBible: _omit, ...legacy } = makeStory({ pageCount: 1 });
    void _omit;
    await expect(
      service.generate({
        story: { ...legacy, pages: legacy.pages.map(({ scene: _s, ...p }) => (void _s, p)) },
        bookId: 'book-legacy',
        artStyle: 'watercolor',
      }),
    ).rejects.toThrow(/no Visual Bible/);
  });
});
