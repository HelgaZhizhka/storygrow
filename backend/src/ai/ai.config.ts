import type { ImageSize } from '../pdf/page-templates/page-templates.config';

export const GENERATION_MODEL = 'gpt-4o-mini';
// Story TEXT uses a stronger model: voice, humour and originality are the
// bottleneck, and the text call (~$0.02/book) is negligible beside images
// (~$0.30/book). The judge and other calls stay on the cheaper model.
export const STORY_MODEL = 'gpt-4o';
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const DEFAULT_TOP_K = 150;
// Share of meaningful (non-stop) story words whose stem must appear in the
// child's full grade-level corpus. Empirically calibrated: quality stories
// score ~0.45–0.54 against the ~436-word grade-≤1 corpus (proper nouns and
// common connectives are legitimately out-of-corpus), so 0.85 was unreachable.
export const COMPLIANCE_THRESHOLD = 0.4;
export const PAGES_MIN = 6;
export const PAGES_MAX = 12;
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

export type ImageProviderName = 'gemini' | 'openai';
export const DEFAULT_IMAGE_PROVIDER: ImageProviderName = 'gemini';

// Resolves to the GA id gemini-2.5-flash-preview-image. If it 404s, set that
// explicit id here. Gemini takes no `size`, only an aspect ratio.
export const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

export const IMAGE_SIZE_TO_ASPECT_RATIO: Record<ImageSize, '1:1' | '2:3' | '3:2'> = {
  '1024x1024': '1:1',
  '1024x1536': '2:3',
  '1536x1024': '3:2',
};
