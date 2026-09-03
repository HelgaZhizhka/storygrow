import type { ArtStyle } from '../../ai.config';
import type { ImageSize } from '../../../pdf/page-templates/page-templates.config';

export interface PortraitInput {
  characterProfile: string;
  artStyle: ArtStyle;
}

export interface PhotoPortraitInput {
  photo: Uint8Array;
  descriptor: string;
  artStyle: ArtStyle;
}

export interface PageInput {
  /** The fully-assembled page prompt (hero-lock, cast, setting, action, style). */
  prompt: string;
  imageSize: ImageSize;
  /** Reference images to condition on, aligned to the prompt's "reference image k" mentions. */
  references: Uint8Array[];
}

export interface ImageProvider {
  readonly usesReference: boolean;
  readonly modelLabel: string;
  generatePortrait(input: PortraitInput): Promise<Uint8Array>;
  // Stylise a real uploaded photo into a recognisable character portrait (#128).
  generatePortraitFromPhoto(input: PhotoPortraitInput): Promise<Uint8Array>;
  generatePage(input: PageInput): Promise<Uint8Array>;
}
