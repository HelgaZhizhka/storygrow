import { generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { IMAGE_MODEL, IMAGE_QUALITY } from '../../ai.config';
import { ImageGenerationError } from '../errors';
import type { ImageProvider, PageInput } from './image-provider.interface';

const OPENAI_MAX_RETRIES = 1;

export class OpenAiImageProvider implements ImageProvider {
  readonly usesReference = false;
  readonly modelLabel = IMAGE_MODEL;

  generatePortrait(): Promise<Uint8Array> {
    return Promise.reject(new Error('OpenAiImageProvider does not generate portraits'));
  }

  generatePortraitFromPhoto(): Promise<Uint8Array> {
    // Photo-likeness (#128) is Gemini-only; the photo path never selects OpenAI.
    return Promise.reject(new Error('OpenAiImageProvider does not support photo portraits'));
  }

  async generatePage(input: PageInput): Promise<Uint8Array> {
    // references are ignored (usesReference=false); the service already baked the
    // style suffix into input.prompt.
    try {
      const result = await generateImage({
        model: openai.imageModel(IMAGE_MODEL),
        prompt: input.prompt,
        size: input.imageSize,
        maxRetries: OPENAI_MAX_RETRIES,
        providerOptions: { openai: { quality: IMAGE_QUALITY } },
      });
      return result.image.uint8Array;
    } catch (err: unknown) {
      if (isContentPolicyError(err)) throw new ImageGenerationError('refused', err);
      throw err;
    }
  }
}

function isContentPolicyError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object') {
    const code = (cause as Record<string, unknown>).code;
    if (code === 'content_policy_violation') return true;
    const body = (cause as Record<string, unknown>).responseBody;
    if (typeof body === 'string' && body.includes('content_policy_violation')) return true;
  }
  return err.message.toLowerCase().includes('content_policy');
}
