import { XAI_IMAGE_MODEL, IMAGE_SIZE_TO_ASPECT_RATIO } from '../../ai.config';
import { buildPhotoPortraitPrompt, buildPortraitPrompt } from '../../prompts/image-portrait.prompt';
import { ImageGenerationError } from '../errors';
import type {
  ImageProvider,
  PageInput,
  PhotoPortraitInput,
  PortraitInput,
} from './image-provider.interface';

const GEN_URL = 'https://api.x.ai/v1/images/generations';
const EDIT_URL = 'https://api.x.ai/v1/images/edits';
type AspectRatio = '1:1' | '2:3' | '3:2';

/**
 * xAI Grok image provider (image experiment #348) — Grok Imagine Image 2.0.
 * Text-to-image via `/v1/images/generations`; single-reference editing via
 * `/v1/images/edits` (the model accepts ONE input image). With a reference
 * budget of 1 (see MAX_REFERENCE_IMAGES) this supports baseline + cascade
 * (each page edited from the previous), but not multi-reference sheets.
 * Implemented over the REST API with global fetch — no new dependency.
 */
export class XaiImageProvider implements ImageProvider {
  readonly usesReference = true;
  readonly modelLabel = XAI_IMAGE_MODEL;

  constructor(private readonly apiKey: string) {}

  generatePortrait(input: PortraitInput): Promise<Uint8Array> {
    return this.generate(buildPortraitPrompt(input.characterProfile, input.artStyle), '2:3');
  }

  generatePortraitFromPhoto(input: PhotoPortraitInput): Promise<Uint8Array> {
    return this.edit(
      buildPhotoPortraitPrompt(input.descriptor, input.artStyle),
      input.photo,
      '2:3',
    );
  }

  generateLocationSheet(): Promise<Uint8Array> {
    // Sheets need several references at once; Grok's edit takes only one.
    return Promise.reject(new Error('XaiImageProvider does not support location sheets'));
  }

  generatePage(input: PageInput): Promise<Uint8Array> {
    const aspect = IMAGE_SIZE_TO_ASPECT_RATIO[input.imageSize];
    return input.references.length > 0
      ? this.edit(input.prompt, input.references[0], aspect)
      : this.generate(input.prompt, aspect);
  }

  private generate(prompt: string, aspect: AspectRatio): Promise<Uint8Array> {
    return this.request(GEN_URL, {
      model: XAI_IMAGE_MODEL,
      prompt,
      n: 1,
      aspect_ratio: aspect,
      resolution: '1k',
      response_format: 'b64_json',
    });
  }

  private edit(prompt: string, image: Uint8Array, aspect: AspectRatio): Promise<Uint8Array> {
    const url = `data:image/png;base64,${Buffer.from(image).toString('base64')}`;
    return this.request(EDIT_URL, {
      model: XAI_IMAGE_MODEL,
      prompt,
      image: { url, type: 'image_url' },
      aspect_ratio: aspect,
      response_format: 'b64_json',
    });
  }

  private async request(url: string, body: Record<string, unknown>): Promise<Uint8Array> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 400 && /content|policy|moderat|safety/i.test(text)) {
        throw new ImageGenerationError('refused');
      }
      throw new Error(`xAI ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const item = json.data?.[0];
    if (item?.b64_json) return new Uint8Array(Buffer.from(item.b64_json, 'base64'));
    if (item?.url) {
      const img = await fetch(item.url);
      return new Uint8Array(await img.arrayBuffer());
    }
    throw new ImageGenerationError('refused');
  }
}
