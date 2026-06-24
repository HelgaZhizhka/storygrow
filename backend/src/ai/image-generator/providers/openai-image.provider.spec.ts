const mockGenerateImage = jest.fn();
jest.mock('ai', () => ({ generateImage: (...a: unknown[]): unknown => mockGenerateImage(...a) }));
jest.mock('@ai-sdk/openai', () => ({ openai: { imageModel: (id: string) => ({ id }) } }));

import { OpenAiImageProvider } from './openai-image.provider';
import { ImageGenerationError } from '../errors';

const bytes = new Uint8Array([1, 2, 3]);

describe('OpenAiImageProvider', () => {
  beforeEach(() => mockGenerateImage.mockReset());

  it('generates a page and returns bytes', async () => {
    mockGenerateImage.mockResolvedValue({ image: { uint8Array: bytes } });
    const provider = new OpenAiImageProvider();
    const out = await provider.generatePage({
      prompt: 'a fox',
      artStyle: 'watercolor',
      imageSize: '1024x1024',
    });
    expect(out).toBe(bytes);
    expect(provider.usesReference).toBe(false);
    const call = mockGenerateImage.mock.calls[0][0];
    expect(call.size).toBe('1024x1024');
  });

  it('maps a content-policy error to a refusal', async () => {
    mockGenerateImage.mockRejectedValue(
      Object.assign(new Error('bad'), { cause: { code: 'content_policy_violation' } }),
    );
    const provider = new OpenAiImageProvider();
    await expect(
      provider.generatePage({ prompt: 'x', artStyle: 'watercolor', imageSize: '1024x1024' }),
    ).rejects.toBeInstanceOf(ImageGenerationError);
  });

  it('does not generate portraits', async () => {
    await expect(
      new OpenAiImageProvider().generatePortrait({ characterProfile: 'x', artStyle: 'watercolor' }),
    ).rejects.toThrow();
  });
});
