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

export type ImageProviderName = 'gemini' | 'openai' | 'xai';
export const DEFAULT_IMAGE_PROVIDER: ImageProviderName = 'gemini';

// Resolves to the GA id gemini-2.5-flash-preview-image. If it 404s, set that
// explicit id here. Gemini takes no `size`, only an aspect ratio.
export const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

// xAI Grok image model (image experiment) — its edit endpoint accepts ONE
// reference image, so it can do baseline + cascade, but not multi-ref sheets.
export const XAI_IMAGE_MODEL = 'grok-imagine-image-2.0';

// Text/vision model for reading a child photo into a feature descriptor (#128).
// An image-OUT model (GEMINI_IMAGE_MODEL) can't return structured text, so the
// descriptor step uses a normal multimodal text model. `gemini-2.5-flash` returns
// 404 "no longer available to new users" on the current Google project (#359);
// 3.6-flash is verified live with generateObject + image input.
export const GEMINI_VISION_MODEL = 'gemini-3.6-flash';

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
export const DESCRIPTOR_MAX_CHARS = 160;
// The per-page ACTION line (what the characters DO) — appearance and place come
// from the bible, so the action itself is short.
export const ACTION_MAX_CHARS = 240;

// Per-model cap on INPUT reference images (Google docs, checked 2026-09-03):
// gemini-2.5-flash-image accepts 3; gemini-3-pro-image up to 14.
export const MAX_REFERENCE_IMAGES: Record<string, number> = {
  'gemini-2.5-flash-image': 3,
  'gemini-3-pro-image': 14,
  'grok-imagine-image-2.0': 5,
};
export const DEFAULT_MAX_REFERENCE_IMAGES = 3;
