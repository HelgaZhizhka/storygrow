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
  prompt: string;
  artStyle: ArtStyle;
  imageSize: ImageSize;
  reference?: Uint8Array;
}

export interface ImageProvider {
  readonly usesReference: boolean;
  readonly modelLabel: string;
  generatePortrait(input: PortraitInput): Promise<Uint8Array>;
  // Stylise a real uploaded photo into a recognisable character portrait (#128).
  generatePortraitFromPhoto(input: PhotoPortraitInput): Promise<Uint8Array>;
  generatePage(input: PageInput): Promise<Uint8Array>;
}
