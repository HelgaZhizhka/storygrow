import { generateImage, NoImageGeneratedError } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GEMINI_IMAGE_MODEL, IMAGE_SIZE_TO_ASPECT_RATIO } from '../../ai.config';
import { buildPagePrompt, buildPortraitPrompt } from '../../prompts/image-portrait.prompt';
import { ImageGenerationError } from '../errors';
import type { ImageProvider, PageInput, PortraitInput } from './image-provider.interface';

type AspectRatio = '1:1' | '2:3' | '3:2';
type GeminiPrompt = string | { text: string; images: Uint8Array[] };

export class GeminiImageProvider implements ImageProvider {
  readonly usesReference = true;
  readonly modelLabel = GEMINI_IMAGE_MODEL;
  private readonly google: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(apiKey: string) {
    this.google = createGoogleGenerativeAI({ apiKey });
  }

  generatePortrait(input: PortraitInput): Promise<Uint8Array> {
    return this.run(buildPortraitPrompt(input.characterProfile, input.artStyle), '2:3');
  }

  generatePage(input: PageInput): Promise<Uint8Array> {
    const text = buildPagePrompt(input.prompt, input.artStyle);
    const prompt: GeminiPrompt = input.reference ? { text, images: [input.reference] } : text;
    return this.run(prompt, IMAGE_SIZE_TO_ASPECT_RATIO[input.imageSize]);
  }

  private async run(prompt: GeminiPrompt, aspectRatio: AspectRatio): Promise<Uint8Array> {
    try {
      const result = await generateImage({
        model: this.google.image(GEMINI_IMAGE_MODEL),
        prompt,
        aspectRatio,
      });
      return result.image.uint8Array;
    } catch (err: unknown) {
      if (NoImageGeneratedError.isInstance(err)) throw new ImageGenerationError('refused', err);
      throw err;
    }
  }
}
