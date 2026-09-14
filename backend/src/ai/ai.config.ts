import type { AgeBand, ImageSize } from '../pdf/page-templates/page-templates.config';

export const GENERATION_MODEL = 'gpt-4o-mini';
// Story TEXT uses a stronger model: voice, humour and originality are the
// bottleneck, and the text call is negligible beside images (~$0.30/book).
// The judge and other calls stay on the cheaper model.
export const STORY_MODEL = 'gpt-4o';
// Decomposed generation (ADR-0005). The Plan phase is structural reasoning, so a
// cheaper model suffices. The Prose phase carries the VOICE — measured under the
// registerMatch judge, gpt-5 clearly beats gpt-4o on prose ONLY once the plan
// frees it from structure (gpt-5 on the old single call was within noise).
export const PLAN_MODEL = 'gpt-4o';
export const PROSE_MODEL = 'gpt-5';
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const DEFAULT_TOP_K = 150;
// Share of meaningful (non-stop) story words whose stem must appear in the
// child's full grade-level corpus. Empirically calibrated: quality stories
// score ~0.45–0.54 against the ~436-word grade-≤1 corpus (proper nouns and
// common connectives are legitimately out-of-corpus), so 0.85 was unreachable.
export const COMPLIANCE_THRESHOLD = 0.4;
/**
 * Page count bounds per age band (#196). 3-4 books are shorter — repetition-
 * driven structure doesn't need 12 pages and a toddler's attention span is
 * shorter. 5-6 is unchanged from before this band existed.
 */
export const PAGE_COUNT_BY_BAND: Record<AgeBand, { min: number; max: number }> = {
  '3-4': { min: 6, max: 8 },
  '5-6': { min: 6, max: 12 },
};
export const DISCUSSION_QUESTIONS_COUNT = 5;
export const EVAL_THRESHOLD_DEFAULT = 7.0;
export const EVAL_MAX_RETRIES_DEFAULT = 2;
// Floor each guardrail criterion must clear for a story to be accepted (ADR-0005).
// Guardrails are pass/fail gates; the craft signal (registerMatch) is gated
// separately at EVAL_THRESHOLD so prose quality is never averaged away.
export const GUARDRAIL_FLOOR_DEFAULT = 6;

// Image judge (#358): a vision model checks every rendered page against its
// action + references; a failing page is regenerated (same prompt, fresh
// sample) at most this many times. Rows are written for EVERY attempt.
export const IMAGE_EVAL_MAX_RETRIES_DEFAULT = 1;

// OpenAI gpt-image-1 is NOT a book-pipeline provider any more (#375: it took no
// references, so no portrait, no sheets, no photo). Only the one-off seed
// scripts (fast-flow illustrations, style previews) still call it directly.
export const IMAGE_MODEL = 'gpt-image-1';
export const IMAGE_QUALITY = 'medium';
export type ArtStyle = 'watercolor' | 'cartoon' | 'storybook' | 'pixel' | 'realistic';

export const STYLE_SUFFIXES: Record<ArtStyle, string> = {
  watercolor:
    ", soft watercolour painting, children's book illustration, gentle pastel colours, warm lighting, no text in image",
  cartoon:
    ', flat cartoon illustration, bold clean outlines, bright saturated colours, playful, no text in image',
  storybook:
    ', classic storybook illustration, richly detailed, warm traditional colours, no text in image',
  pixel: ', pixel art, 16-bit retro game style, crisp pixels, vibrant palette, no text in image',
  realistic:
    ', semi-realistic 3D render, soft cinematic lighting, detailed, child-friendly, no text in image',
};

export const IMAGE_PROVIDERS = ['xai'] as const;
export type ImageProviderName = (typeof IMAGE_PROVIDERS)[number];
// xAI Grok is the production default (ADR-0007). The app needs a Gemini key
// anyway (vision judge, photo descriptor), so "boots without an xAI key" was
// never a real property; CI uses a dummy value.
export const DEFAULT_IMAGE_PROVIDER: ImageProviderName = 'xai';

/** Strict: an unknown value must fail at startup, never silently select another paid model (#373). */
export const parseImageProvider = (raw: string | undefined): ImageProviderName => {
  if (raw === undefined || raw === '') return DEFAULT_IMAGE_PROVIDER;
  if ((IMAGE_PROVIDERS as readonly string[]).includes(raw)) return raw as ImageProviderName;
  throw new Error(
    `IMAGE_PROVIDER must be "xai" (the Gemini fallback was removed in #397), got "${raw}"`,
  );
};

// Resolves to the GA id gemini-2.5-flash-preview-image. If it 404s, set that
// explicit id here. Gemini takes no `size`, only an aspect ratio.

// xAI Grok image model (ADR-0007 default) — its edit endpoint accepts up to 5
// reference images via the `images` array (probed 2026-09-05).
export const XAI_IMAGE_MODEL = 'grok-imagine-image-2.0';

// xAI vision (#397): Grok reads a child's photo where Gemini's content filter
// blocks it (measured 4/4 on a real photo, 2026-09-14). xAI's chat API is
// OpenAI-compatible, so we reach it through @ai-sdk/openai's createOpenAI with a
// custom baseURL — no new dependency, generateObject + Zod unchanged.
export const XAI_BASE_URL = 'https://api.x.ai/v1';
export const XAI_VISION_MODEL = 'grok-4';

/**
 * USD per generated image (#379), from the ADR-0007 measurements (2026-09-04):
 * Grok ~$0.04 per image + $0.01 per input reference; Gemini Flash image ~$0.039.
 * The vision judge (Gemini) is not priced here. Update when the vendors change
 * prices; the admin dashboard derives cost from these at read time.
 */
export const IMAGE_COST_USD: Record<string, { perImage: number; perReference: number }> = {
  [XAI_IMAGE_MODEL]: { perImage: 0.04, perReference: 0.01 },
};

export const imageCostUsd = (model: string, referenceCount: number): number => {
  const price = IMAGE_COST_USD[model];
  if (!price) return 0;
  return price.perImage + price.perReference * referenceCount;
};

export const IMAGE_SIZE_TO_ASPECT_RATIO: Record<ImageSize, '1:1' | '2:3' | '3:2'> = {
  '1024x1024': '1:1',
  '1024x1536': '2:3',
  '1536x1024': '3:2',
};

// ─── Visual Bible (#348) — structured visual continuity across pages ─────────
// The bible fixes the book's visual world once (hero, cast, locations, props,
// atmosphere); a per-page Scene selects from it. Caps keep a preschool book
// small and bound the number of paid reference sheets.
export const MAX_CAST = 3;
export const MAX_LOCATIONS = 3;
export const MAX_PROPS = 4;
// A story descriptor is RENDERED from structured appearance fields (#360), so
// it may be longer than a free-text one; each appearance field is capped.
export const DESCRIPTOR_MAX_CHARS = 320;
export const APPEARANCE_FIELD_MAX_CHARS = 60;
// The per-page ACTION line (what the characters DO) — appearance and place come
// from the bible, so the action itself is short.
export const ACTION_MAX_CHARS = 240;
