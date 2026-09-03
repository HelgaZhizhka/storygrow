const mockGenerateImage = jest.fn();
class FakeNoImage extends Error {
  static isInstance(e: unknown): boolean {
    return e instanceof FakeNoImage;
  }
}
jest.mock('ai', () => ({
  generateImage: (...a: unknown[]): unknown => mockGenerateImage(...a),
  NoImageGeneratedError: FakeNoImage,
}));
const mockImage = jest.fn((id: string) => ({ id }));
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => ({ image: (id: string) => mockImage(id) }),
}));

import { GeminiImageProvider } from './gemini-image.provider';
import { ImageGenerationError } from '../errors';

const bytes = new Uint8Array([9, 9]);

describe('GeminiImageProvider', () => {
  beforeEach(() => {
    mockGenerateImage.mockReset();
    mockImage.mockClear();
  });

  it('generates a portrait with a 2:3 aspect ratio', async () => {
    mockGenerateImage.mockResolvedValue({ image: { uint8Array: bytes } });
    const out = await new GeminiImageProvider('key').generatePortrait({
      characterProfile: 'a girl',
      artStyle: 'watercolor',
    });
    expect(out).toBe(bytes);
    const [portraitArg] = mockGenerateImage.mock.calls[0] as [{ aspectRatio?: string }];
    expect(portraitArg.aspectRatio).toBe('2:3');
  });

  it('passes the reference image and the mapped aspect ratio on a page', async () => {
    mockGenerateImage.mockResolvedValue({ image: { uint8Array: bytes } });
    const ref = new Uint8Array([7]);
    await new GeminiImageProvider('key').generatePage({
      prompt: 'a fox',
      imageSize: '1536x1024',
      references: [ref],
    });
    const [arg] = mockGenerateImage.mock.calls[0] as [
      { aspectRatio?: string; prompt: { text?: string; images?: Uint8Array[] } },
    ];
    expect(arg.aspectRatio).toBe('3:2');
    expect(arg.prompt.images).toEqual([ref]);
    expect(typeof arg.prompt.text).toBe('string');
  });

  it('stylises a photo into a portrait: photo as reference, 2:3 aspect', async () => {
    mockGenerateImage.mockResolvedValue({ image: { uint8Array: bytes } });
    const photo = new Uint8Array([4, 2]);
    const out = await new GeminiImageProvider('key').generatePortraitFromPhoto({
      photo,
      descriptor: 'round face, blue eyes',
      artStyle: 'watercolor',
    });
    expect(out).toBe(bytes);
    const [arg] = mockGenerateImage.mock.calls[0] as [
      { aspectRatio?: string; prompt: { text?: string; images?: Uint8Array[] } },
    ];
    expect(arg.aspectRatio).toBe('2:3');
    expect(arg.prompt.images).toEqual([photo]);
    expect(arg.prompt.text).toContain('round face, blue eyes');
  });

  it('uses an overridden model id for label and the SDK call', async () => {
    mockGenerateImage.mockResolvedValue({ image: { uint8Array: bytes } });
    const provider = new GeminiImageProvider('key', 'gemini-3-pro-image');
    expect(provider.modelLabel).toBe('gemini-3-pro-image');
    await provider.generatePortrait({ characterProfile: 'a girl', artStyle: 'watercolor' });
    expect(mockImage).toHaveBeenCalledWith('gemini-3-pro-image');
  });

  it('maps a NoImageGeneratedError to a refusal', async () => {
    mockGenerateImage.mockRejectedValue(new FakeNoImage('blocked'));
    await expect(
      new GeminiImageProvider('key').generatePage({
        prompt: 'x',
        imageSize: '1024x1024',
        references: [],
      }),
    ).rejects.toBeInstanceOf(ImageGenerationError);
  });
});
