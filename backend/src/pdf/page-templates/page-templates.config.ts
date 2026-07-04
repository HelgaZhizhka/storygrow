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

export interface ImageSlot {
  /** Slot identifier used as a CSS class and render target. */
  slot: string;
  aspect: AspectRatio;
  /** gpt-image-1 size that best fits this slot on an A5 page at 150 DPI. */
  imageSize: ImageSize;
}

export interface MaxChars {
  /** Max characters for the `text` field, if this template has a text block. */
  text?: number;
  /** Max characters for the `title` field, if this template has a title block. */
  title?: number;
}

export interface PageTemplateConfig {
  /** HTML stub filename under backend/src/pdf/page-templates/. */
  htmlFile: string;
  maxChars: MaxChars;
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
 * `text-focus` is intentionally absent for ages 5–6:
 *   younger children need image-heavy layouts for comprehension.
 */
export const PAGE_TEMPLATES: Readonly<Record<TemplateName, PageTemplateConfig>> = {
  cover: {
    htmlFile: 'cover.html',
    maxChars: { title: 60 },
    images: [{ slot: 'main', aspect: 'portrait', imageSize: '1024x1536' }],
    suitableFor: [5, 6, 7, 8],
  },
  'image-top': {
    htmlFile: 'image-top.html',
    maxChars: { text: 220 },
    images: [{ slot: 'illustration', aspect: 'landscape', imageSize: '1536x1024' }],
    suitableFor: [5, 6],
  },
  'image-bottom': {
    htmlFile: 'image-bottom.html',
    maxChars: { text: 220 },
    images: [{ slot: 'illustration', aspect: 'landscape', imageSize: '1536x1024' }],
    suitableFor: [5, 6],
  },
  'image-left': {
    htmlFile: 'image-left.html',
    maxChars: { text: 200 },
    images: [{ slot: 'illustration', aspect: 'square', imageSize: '1024x1024' }],
    suitableFor: [6, 7, 8],
  },
  'text-focus': {
    htmlFile: 'text-focus.html',
    maxChars: { text: 350 },
    images: [{ slot: 'illustration', aspect: 'square', imageSize: '1024x1024' }],
    suitableFor: [7, 8],
  },
  final: {
    htmlFile: 'final.html',
    maxChars: { text: 200 },
    images: [{ slot: 'illustration', aspect: 'portrait', imageSize: '1024x1536' }],
    suitableFor: [5, 6, 7, 8],
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
