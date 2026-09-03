import { generateImage, NoImageGeneratedError } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GEMINI_IMAGE_MODEL, IMAGE_SIZE_TO_ASPECT_RATIO } from '../../ai.config';
import { buildPhotoPortraitPrompt, buildPortraitPrompt } from '../../prompts/image-portrait.prompt';
import { ImageGenerationError } from '../errors';
import type {
  ImageProvider,
  PageInput,
  PhotoPortraitInput,
  PortraitInput,
} from './image-provider.interface';

type AspectRatio = '1:1' | '2:3' | '3:2';
type GeminiPrompt = string | { text: string; images: Uint8Array[] };

export class GeminiImageProvider implements ImageProvider {
  readonly usesReference = true;
  readonly modelLabel: string;
  private readonly google: ReturnType<typeof createGoogleGenerativeAI>;
  private readonly model: string;

  constructor(apiKey: string, model: string = GEMINI_IMAGE_MODEL) {
    this.google = createGoogleGenerativeAI({ apiKey });
    this.model = model;
    this.modelLabel = model;
  }

  generatePortrait(input: PortraitInput): Promise<Uint8Array> {
    return this.run(buildPortraitPrompt(input.characterProfile, input.artStyle), '2:3');
  }

  generatePortraitFromPhoto(input: PhotoPortraitInput): Promise<Uint8Array> {
    const text = buildPhotoPortraitPrompt(input.descriptor, input.artStyle);
    return this.run({ text, images: [input.photo] }, '2:3');
  }

  generatePage(input: PageInput): Promise<Uint8Array> {
    // The service supplies the complete prompt (hero-lock, setting, style); the
    // provider only attaches reference images.
    const prompt: GeminiPrompt =
      input.references.length > 0 ? { text: input.prompt, images: input.references } : input.prompt;
    return this.run(prompt, IMAGE_SIZE_TO_ASPECT_RATIO[input.imageSize]);
  }

  private async run(prompt: GeminiPrompt, aspectRatio: AspectRatio): Promise<Uint8Array> {
    try {
      const result = await generateImage({
        model: this.google.image(this.model),
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
