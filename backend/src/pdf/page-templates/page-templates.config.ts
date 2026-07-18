export type AspectRatio = 'portrait' | 'landscape' | 'square';
export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';

/**
 * All valid template names. This array is imported by StorySchema to build
 * the Zod enum — it is the single source of truth for template names.
 */
export const TEMPLATE_NAMES = [
  'cover',
  'image-top',
  'image-bottom',
  'image-left',
  'text-focus',
  'final',
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

/**
 * AgeBand — the single dispatch key for every age-dependent decision in the
 * generation pipeline (template caps, page count, beat sheet, exemplars,
 * judge calibration). Derived once per request via `ageToAgeBand`; nothing
 * downstream branches on a raw childAge number (#196).
 */
export type AgeBand = '3-4' | '5-6';

export const ageToAgeBand = (childAge: number): AgeBand => (childAge <= 4 ? '3-4' : '5-6');

export interface ImageSlot {
  slot: string;
  aspect: AspectRatio;
  imageSize: ImageSize;
}

export interface MaxChars {
  text?: number;
  title?: number;
}

export interface PageTemplateConfig {
  htmlFile: string;
  /**
   * Per-band character caps. 3–4's caps are much smaller (shorter,
   * repetition-driven pages). image-left/text-focus never render for 3–4
   * (excluded from `suitableFor`), so their '3-4' entry is a defensive
   * placeholder equal to '5-6' — present only so the type is total, never
   * actually read in practice.
   */
  maxChars: Record<AgeBand, MaxChars>;
  images: readonly ImageSlot[];
  /** Child ages (inclusive) for which this template is pedagogically appropriate. */
  suitableFor: readonly number[];
}

/**
 * PAGE_TEMPLATES — typed catalogue of all six page layouts.
 *
 * Physical sizing rationale (ADR 0002):
 *   A5 = 148 × 210 mm, target 150 DPI → ~874 × 1240 px canvas.
 *   gpt-image-1 sizes: 1024×1024 (square), 1536×1024 (landscape), 1024×1536 (portrait).
 *
 * `text-focus` is intentionally absent for ages 3–6:
 *   younger children need image-heavy layouts for comprehension.
 */
export const PAGE_TEMPLATES: Readonly<Record<TemplateName, PageTemplateConfig>> = {
  cover: {
    htmlFile: 'cover.html',
    maxChars: { '3-4': { title: 40 }, '5-6': { title: 60 } },
    images: [{ slot: 'main', aspect: 'portrait', imageSize: '1024x1536' }],
    suitableFor: [3, 4, 5, 6, 7, 8],
  },
  'image-top': {
    htmlFile: 'image-top.html',
    maxChars: { '3-4': { text: 110 }, '5-6': { text: 220 } },
    images: [{ slot: 'illustration', aspect: 'landscape', imageSize: '1536x1024' }],
    suitableFor: [3, 4, 5, 6],
  },
  'image-bottom': {
    htmlFile: 'image-bottom.html',
    maxChars: { '3-4': { text: 110 }, '5-6': { text: 220 } },
    images: [{ slot: 'illustration', aspect: 'landscape', imageSize: '1536x1024' }],
    suitableFor: [3, 4, 5, 6],
  },
  'image-left': {
    htmlFile: 'image-left.html',
    maxChars: { '3-4': { text: 200 }, '5-6': { text: 200 } },
    images: [{ slot: 'illustration', aspect: 'square', imageSize: '1024x1024' }],
    suitableFor: [6, 7, 8],
  },
  'text-focus': {
    htmlFile: 'text-focus.html',
    maxChars: { '3-4': { text: 350 }, '5-6': { text: 350 } },
    images: [{ slot: 'illustration', aspect: 'square', imageSize: '1024x1024' }],
    suitableFor: [7, 8],
  },
  final: {
    htmlFile: 'final.html',
    maxChars: { '3-4': { text: 90 }, '5-6': { text: 200 } },
    images: [{ slot: 'illustration', aspect: 'portrait', imageSize: '1024x1536' }],
    suitableFor: [3, 4, 5, 6, 7, 8],
  },
} as const;

/**
 * Template names pedagogically appropriate for a given child age — the single
 * source of truth for age filtering, used both to build the Plan prompt
 * catalogue and to constrain the Plan schema's template enum so an age-invalid
 * template cannot be emitted in the first place.
 */
export const templatesForAge = (childAge: number): TemplateName[] =>
  TEMPLATE_NAMES.filter((name) => PAGE_TEMPLATES[name].suitableFor.includes(childAge));
