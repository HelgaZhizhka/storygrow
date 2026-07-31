import type { ArtStyle } from '../ai.config';
import { STYLE_SUFFIXES } from '../ai.config';

export function buildPortraitPrompt(characterProfile: string, artStyle: ArtStyle): string {
  return (
    `Full-body character reference portrait of ${characterProfile}. ` +
    `The character is centered and clearly visible on a plain neutral background` +
    STYLE_SUFFIXES[artStyle]
  );
}

// Photo → stylised portrait (#128). The uploaded photo is the reference image;
// this text names the features to preserve. Wording validated in the spike.
export function buildPhotoPortraitPrompt(descriptor: string, artStyle: ArtStyle): string {
  return (
    `Full-body character portrait of this child: ${descriptor}. ` +
    `Redraw the same child, preserving those exact features, ` +
    `centered and clearly visible on a plain neutral background` +
    STYLE_SUFFIXES[artStyle]
  );
}

export function buildPagePrompt(pagePrompt: string, artStyle: ArtStyle): string {
  return (
    `Keep this exact child — same face, hair, and outfit — now in a new scene. ` +
    pagePrompt +
    STYLE_SUFFIXES[artStyle]
  );
}
