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

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/** Transliterate Cyrillic → Latin so a slug survives (goal titles are Russian). */
export const translit = (raw: string): string =>
  raw.replace(/[а-яё]/gi, (c) => {
    const lower = c.toLowerCase();
    const mapped = TRANSLIT[lower] ?? '';
    return c === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
  });

/** Safe S3/-filesystem id segment (bookIds and folder names) from a fixture label. */
export const sanitizeId = (raw: string): string =>
  translit(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** Deterministic bookId for a variant × fixture render. */
export const evalBookId = (variant: ImageVariant, fixture: string): string =>
  `eval-${sanitizeId(variant)}-${sanitizeId(fixture)}`;
