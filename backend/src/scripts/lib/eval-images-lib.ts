/**
 * Pure helpers for the eval:images harness (#348, PR 3) — kept separate from the
 * script so the variant logic is unit-tested without touching the image API.
 */
import type { Story } from '../../ai/schemas';

export type ImageVariant = 'baseline' | 'bible' | 'bible+sheets';

export const IMAGE_VARIANTS: readonly ImageVariant[] = ['baseline', 'bible', 'bible+sheets'];

/** Whether a variant turns IMAGE_REFERENCE_SHEETS on. */
export const sheetsFlagFor = (variant: ImageVariant): 'on' | 'off' =>
  variant === 'bible+sheets' ? 'on' : 'off';

/**
 * Shape the fixture story for a variant. `baseline` strips the Visual Bible and
 * per-page scenes so the image path falls back to the pre-#348 legacy prompt;
 * `bible` and `bible+sheets` keep the bible (they differ only by the sheets flag).
 */
export const storyForVariant = (story: Story, variant: ImageVariant): Story => {
  if (variant !== 'baseline') return story;
  return {
    ...story,
    visualBible: undefined,
    pages: story.pages.map((p) => ({ ...p, scene: undefined })),
  };
};

/** Safe S3/-filesystem id segment (bookIds and folder names) from a fixture label. */
export const sanitizeId = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** Deterministic bookId for a variant × fixture render. */
export const evalBookId = (variant: ImageVariant, fixture: string): string =>
  `eval-${sanitizeId(variant)}-${sanitizeId(fixture)}`;
