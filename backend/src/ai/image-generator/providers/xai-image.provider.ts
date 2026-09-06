import { XAI_IMAGE_MODEL, IMAGE_SIZE_TO_ASPECT_RATIO } from '../../ai.config';
import { buildLocationSheetPrompt } from '../../prompts/illustration.prompt';
import { buildPhotoPortraitPrompt, buildPortraitPrompt } from '../../prompts/image-portrait.prompt';
import { ImageGenerationError } from '../errors';
import type {
  ImageProvider,
  LocationSheetInput,
  PageInput,
  PhotoPortraitInput,
  PortraitInput,
} from './image-provider.interface';

const GEN_URL = 'https://api.x.ai/v1/images/generations';
const EDIT_URL = 'https://api.x.ai/v1/images/edits';
type AspectRatio = '1:1' | '2:3' | '3:2';

/**
 * xAI Grok image provider (image experiment #348) — Grok Imagine Image 2.0.
 * Text-to-image via `/v1/images/generations`; multi-reference editing via
 * `/v1/images/edits` with the `images` array — the API accepts up to 5 input
 * images (probed 2026-09-05: 8 → "supports at most 5 input image(s)"), so the
 * hero portrait, cast portraits and a location sheet all fit (see
 * MAX_REFERENCE_IMAGES). Implemented over the REST API with global fetch — no
 * new dependency.
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
      [input.photo],
      '2:3',
    );
  }

  generateLocationSheet(input: LocationSheetInput): Promise<Uint8Array> {
    return this.generate(
      buildLocationSheetPrompt(input.descriptor, input.atmosphere, input.artStyle),
      '3:2',
    );
  }

  generatePage(input: PageInput): Promise<Uint8Array> {
    const aspect = IMAGE_SIZE_TO_ASPECT_RATIO[input.imageSize];
    return input.references.length > 0
      ? this.edit(input.prompt, input.references, aspect)
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

  private edit(
    prompt: string,
    references: readonly Uint8Array[],
    aspect: AspectRatio,
  ): Promise<Uint8Array> {
    const images = references.map((bytes) => ({
      url: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`,
      type: 'image_url',
    }));
    return this.request(EDIT_URL, {
      model: XAI_IMAGE_MODEL,
      prompt,
      images,
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
