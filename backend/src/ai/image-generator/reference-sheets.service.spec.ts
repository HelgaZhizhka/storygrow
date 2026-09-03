jest.mock('@langfuse/tracing', () => ({
  startActiveObservation: async <T>(_n: string, fn: (s: { update: jest.Mock }) => Promise<T>) =>
    fn({ update: jest.fn() }),
}));

import { ReferenceSheetsService } from './reference-sheets.service';
import { ImageGenerationError } from './errors';
import { visualBibleFixture } from '../schemas/__fixtures__/visual-bible.fixture';
import type { ImageProvider } from './providers/image-provider.interface';

const bible = visualBibleFixture({
  cast: [{ id: 'brother', name: 'братик', role: 'брат', descriptor: 'toddler boy' }],
  locations: [{ id: 'home', name: 'дом', descriptor: 'a room' }],
});

// Standalone mock fns so assertions never reference an unbound method.
const makeMocks = () => ({
  generatePortrait: jest.fn().mockResolvedValue(new Uint8Array([1])),
  generateLocationSheet: jest.fn().mockResolvedValue(new Uint8Array([2])),
});

const providerFrom = (mocks: ReturnType<typeof makeMocks>): ImageProvider => ({
  usesReference: true,
  modelLabel: 'gemini-2.5-flash-image',
  generatePortraitFromPhoto: jest.fn(),
  generatePage: jest.fn(),
  ...mocks,
});

describe('ReferenceSheetsService', () => {
  const s3 = { uploadObject: jest.fn().mockResolvedValue(undefined) };
  const service = new ReferenceSheetsService(s3 as never);

  beforeEach(() => jest.clearAllMocks());

  it('generates one location sheet and one cast portrait, uploads both, returns keys + bytes', async () => {
    const mocks = makeMocks();
    const set = await service.generate({
      bookId: 'b1',
      bible,
      artStyle: 'watercolor',
      provider: providerFrom(mocks),
    });

    expect(mocks.generateLocationSheet).toHaveBeenCalledTimes(1);
    expect(mocks.generatePortrait).toHaveBeenCalledWith({
      characterProfile: 'toddler boy',
      artStyle: 'watercolor',
    });
    expect(set.locationSheets.home).toEqual(new Uint8Array([2]));
    expect(set.castSheets.brother).toEqual(new Uint8Array([1]));
    expect(set.keys).toEqual(
      expect.arrayContaining(['books/b1/ref-location-home.png', 'books/b1/ref-cast-brother.png']),
    );
    expect(s3.uploadObject).toHaveBeenCalledTimes(2);
  });

  it('skips a refused sheet instead of failing the book', async () => {
    const mocks = makeMocks();
    mocks.generateLocationSheet.mockRejectedValue(new ImageGenerationError('refused'));
    const set = await service.generate({
      bookId: 'b2',
      bible,
      artStyle: 'watercolor',
      provider: providerFrom(mocks),
    });

    expect(set.locationSheets.home).toBeUndefined();
    expect(set.castSheets.brother).toEqual(new Uint8Array([1])); // cast still generated
    expect(set.keys).toEqual(['books/b2/ref-cast-brother.png']);
  });

  it('propagates a non-refusal error', async () => {
    const mocks = makeMocks();
    mocks.generatePortrait.mockRejectedValue(new Error('network'));
    await expect(
      service.generate({
        bookId: 'b3',
        bible,
        artStyle: 'watercolor',
        provider: providerFrom(mocks),
      }),
    ).rejects.toThrow('network');
  });
});
