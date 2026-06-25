# Consistent character illustrations via reference portrait (Gemini)

**Issue:** #174
**Date:** 2026-06-22
**Depends on:** #158 (`characterProfile` in `StorySchema`), #136 (per-template `imageSize`)

## Problem

Illustrations for a personalised book are generated page-by-page, independently.
Character consistency rests only on the text `characterProfile` prefix prepended
to each page prompt — which is weak: the protagonist often looks like a
different child on each page. For a book whose whole premise is "your child is
the hero", a recognisably-consistent protagonist is the core value.

A validated spike (`backend/src/scripts/spike-gemini-consistency.ts`) showed that
**Google Gemini 2.5 Flash Image** via the Vercel AI SDK holds the same character
across scenes when given a **reference portrait** as an input image.

## Goal

Add a reference-portrait stage to the custom-flow image pipeline: generate one
portrait of the protagonist, then render every page with that portrait passed as
a reference image, so the same character appears throughout. Keep the existing
gpt-image-1 path selectable as an escape hatch.

Fast flow (pre-rendered `FastIllustration`s) is unaffected.

## Decisions (from brainstorming)

1. **Provider is config-selected, not auto-fallback.** `IMAGE_PROVIDER=gemini|openai`,
   default `gemini`. One provider per generation run (single runtime path). If
   Gemini fails (depleted prepaid credits, billing), flip the env var and
   regenerate. No per-image automatic fallback (it would silently mix providers
   → inconsistent character, the bug we're removing).
2. **Portrait is persisted** to S3 + `Book.characterPortraitKey`, not in-memory
   only. The image stage can retry (`images_failed`); an in-memory portrait would
   regenerate on retry and the hero's face would drift across already-uploaded
   pages. Persistence makes the hero deterministic and reusable.
3. **Scope:** generate a portrait whenever `story.characterProfile` is present
   (both protagonist modes — for `observer` the invented character still needs
   consistency). Pass the portrait as a reference to **every** page (scenery-only
   pages are rare; refine later if needed).

## Configuration

In `ai.config.ts` (constants) + `ConfigService` (secrets/env):

- `IMAGE_PROVIDER`: `'gemini' | 'openai'`, default `'gemini'` (env-overridable).
- `GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'` (resolves to the GA
  `gemini-2.5-flash-preview-image`; if it 404s, fall back to that explicit id).
- `GOOGLE_GENERATIVE_AI_API_KEY` via `ConfigService` (already in `.env`; add to
  `.env.example`). Gemini API key from Google AI Studio — **not** the OAuth
  `GOOGLE_CLIENT_ID/SECRET`. Requires a billing-enabled project with prepaid
  credits.
- `IMAGE_SIZE_TO_ASPECT_RATIO`: map from the per-template `imageSize`
  (`gpt-image-1` sizes) to Gemini `aspectRatio`, since Gemini takes no `size`:
  `'1024x1024' → '1:1'`, `'1024x1536' → '2:3'`, `'1536x1024' → '3:2'`.

## Architecture

A small **provider strategy** inside `image-generator/`. Two implementations
behind one interface, selected by `IMAGE_PROVIDER`:

```ts
interface ImageProvider {
  // Stage 0: portrait from the character description. Returns raw bytes.
  generatePortrait(opts: { characterProfile: string; artStyle: ArtStyle }): Promise<Uint8Array>;
  // Per page: returns PNG bytes. `reference` is the portrait (gemini uses it; openai ignores).
  generatePage(opts: {
    prompt: string;
    artStyle: ArtStyle;
    imageSize: ImageSize;
    reference?: Uint8Array;
  }): Promise<Uint8Array>;
  // Whether this provider supports/uses the portrait reference.
  readonly usesReference: boolean;
}
```

Both providers use the SAME `generateImage` shape (verified via spike), so the
service's S3 upload is uniform — each returns `result.image` (`.uint8Array`):

- `GeminiImageProvider` — `generateImage({ model: google.image(GEMINI_IMAGE_MODEL),
  prompt, aspectRatio })`. Portrait: `prompt` is the text portrait prompt.
  Page: `prompt = { text: keepCharacterWrapper(pagePrompt), images: [reference] }`
  (the portrait bytes) — this is the reference-editing path. `aspectRatio` from
  the map. `usesReference = true`. A `NoImageGeneratedError` from the SDK (safety
  refusal) → mapped to the typed `ImageGenerationError({ refused: true })`.
- `OpenAiImageProvider` — wraps the current `generateImage({ model:
  openai.imageModel(IMAGE_MODEL), size, providerOptions: { openai: { quality }}})`
  path; `usesReference = false`; `generatePortrait` is never called when provider
  is openai. Content-policy errors → `ImageGenerationError({ refused: true })`.

`ImageGeneratorService.generate(input)` orchestrates (keeps S3 upload + LangFuse
spans + the simplify-on-refusal retry here, provider-agnostic) and returns
`{ imageKeys: string[]; characterPortraitKey: string | null }`:

1. Resolve provider from config.
2. If `provider.usesReference && story.characterProfile`: `generatePortrait` →
   upload to `books/{bookId}/portrait.png` → set `characterPortraitKey` → hold
   bytes as `reference`. (Span `image-generation.portrait`.) Otherwise
   `characterPortraitKey = null`, `reference = undefined`.
3. For each page: `provider.generatePage({ prompt, artStyle, imageSize, reference })`
   → on `ImageGenerationError({ refused: true })`, simplify the prompt once and
   retry; still refused → propagate → `images_failed`. Upload to
   `books/{bookId}/page-{n}.png`. (Span per page, as today.)

The **processor** (`generation.processor.ts`) persists the result — it already
persists `imageKeys`; extend that update to also write `characterPortraitKey`.
This keeps Prisma out of `ImageGeneratorService` (current separation).

Prompt fragments live in `prompts/` as constants (rule #11/#4): the portrait
prompt template and the `keepCharacterWrapper` ("keep this exact child — same
face, hair, outfit — new scene: …") used to wrap each page prompt for Gemini.

## Data flow

```
story (characterProfile, pages[]) + artStyle + bookId
  → resolve IMAGE_PROVIDER
  → [gemini] generatePortrait(characterProfile) → S3 portrait.png → Book.characterPortraitKey
  → for each page:
        [gemini]  generateImage(prompt={text:keepCharacterWrapper(prompt)+style, images:[portrait]}, aspectRatio) → image
        [openai]  generateImage(prompt=characterProfile-prefixed prompt+style, size)                              → image
     → S3 page-{n}.png
  → return imageKeys[]
```

## Error handling

- **Gemini empty/refused image** (no image in `result.files`): mirror the
  existing safety path — simplify the prompt once and retry; if still empty,
  throw a typed `ImageGenerationError` → book status `images_failed` (existing).
- **Portrait generation fails:** fail the image stage (`images_failed`) — without
  a portrait there is no consistency to proceed with. Operator flips
  `IMAGE_PROVIDER=openai` if Gemini is persistently down.
- The existing `gpt-image-1` content-policy → simplify path is preserved on the
  openai provider unchanged.

## Schema / migration

```prisma
model Book {
  // ...
  characterPortraitKey String?   // S3 key of the reference portrait (gemini provider)
}
```

Apply via `pnpm --filter backend prisma:migrate` (the wrapper — never raw
`migrate dev`, which drops the pgvector HNSW index; see #133).

## Observability

Keep the manual `startActiveObservation` spans (provider-agnostic). Add
`image-generation.portrait`. Span metadata records the active provider + model so
LangFuse shows which engine produced each image.

## Out of scope

- Detecting whether the protagonist appears on a given page (reference goes to
  every page).
- gpt-image-1 reference/edit mode (only Gemini provides consistency here).
- Frontend display of the portrait (possible later).
- FLUX Kontext provider (researched; parked — different key).

## Testing

- **Unit:**
  - provider selection by `IMAGE_PROVIDER` (gemini vs openai).
  - `imageSize → aspectRatio` mapping (all template sizes covered).
  - `Book.characterPortraitKey` persisted when gemini + `characterProfile`.
  - portrait skipped when provider=openai or no `characterProfile`.
  - empty-files / refusal path throws → `images_failed`.
- **Manual (end-to-end on a clean DB):**
  - custom book with `IMAGE_PROVIDER=gemini`: same child across all pages;
    `portrait.png` + `characterPortraitKey` present; LangFuse shows the portrait
    span + provider metadata.
  - flip `IMAGE_PROVIDER=openai`: the original gpt-image-1 path still works.

## Files touched

- `backend/src/ai/ai.config.ts` — provider/model/aspect-ratio constants.
- `backend/src/ai/image-generator/` — provider strategy + portrait stage
  (split into `providers/gemini.provider.ts`, `providers/openai.provider.ts`,
  keep the service under the 400-line limit).
- `backend/src/ai/prompts/` — portrait + keep-character prompt constants.
- `backend/prisma/schema.prisma` + migration — `characterPortraitKey`.
- `.env.example` — `GOOGLE_GENERATIVE_AI_API_KEY`, `IMAGE_PROVIDER`.
- `backend/package.json` — `@ai-sdk/google` (added).
