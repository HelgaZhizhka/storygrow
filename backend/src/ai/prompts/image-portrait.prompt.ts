import type { ArtStyle } from '../ai.config';
import { STYLE_SUFFIXES } from '../ai.config';

export function buildPortraitPrompt(characterProfile: string, artStyle: ArtStyle): string {
  return (
    `Full-body character reference portrait of ${characterProfile}. ` +
    `The character is centered and clearly visible on a plain neutral background` +
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
