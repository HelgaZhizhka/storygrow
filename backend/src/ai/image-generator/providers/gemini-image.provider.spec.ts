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
    expect(mockGenerateImage.mock.calls[0][0].aspectRatio).toBe('2:3');
  });

  it('passes the reference image and the mapped aspect ratio on a page', async () => {
    mockGenerateImage.mockResolvedValue({ image: { uint8Array: bytes } });
    const ref = new Uint8Array([7]);
    await new GeminiImageProvider('key').generatePage({
      prompt: 'a fox',
      artStyle: 'watercolor',
      imageSize: '1536x1024',
      reference: ref,
    });
    const arg = mockGenerateImage.mock.calls[0][0];
    expect(arg.aspectRatio).toBe('3:2');
    expect(arg.prompt.images).toEqual([ref]);
    expect(typeof arg.prompt.text).toBe('string');
  });

  it('maps a NoImageGeneratedError to a refusal', async () => {
    mockGenerateImage.mockRejectedValue(new FakeNoImage('blocked'));
    await expect(
      new GeminiImageProvider('key').generatePage({
        prompt: 'x',
        artStyle: 'watercolor',
        imageSize: '1024x1024',
      }),
    ).rejects.toBeInstanceOf(ImageGenerationError);
  });
});
