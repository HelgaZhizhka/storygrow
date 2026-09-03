# Visual Bible — structured visual continuity for illustrations

**Issue:** #348
**Date:** 2026-09-03
**Depends on:** ADR-0005 (Plan → Prose decomposition), #174 (reference-portrait
pipeline, Gemini), #128 (photo character), ADR-0006 (photo privacy)
**Context:** `docs/defense/storygrow-launch-plan.md` §7 (local, not committed)

## Problem

On the 2026-08-28 stream the demo book («Алиса и братик», goal «Забота о
младших») showed every illustration defect at once:

- the slide — the story's single location — looked different on every page,
  with a staircase on pages where the text has none;
- the younger brother, a recurring secondary character, changed appearance;
- one page had **two Alisas**;
- several scenes did not match the paragraph they illustrate.

The fixes proposed on the stream were "pass the portrait to every page" (already
done since #174), "pass more context", "chain pages", and "keep secondary
characters consistent". The verified state of the code explains the defects
precisely:

| Fact | Where |
|---|---|
| Each page is generated from **one ≤180-char `illustrationPrompt`** + the hero descriptor + a style suffix | `image-generator.service.ts:102-112`, `prose.prompt.ts:44-46` |
| Pages are generated **independently, in parallel**; page N knows nothing of N−1 | `image-generator.service.ts:71-82` |
| The Plan schema has **no visual fields**: no locations, no cast, no per-page scene | `story-plan.schema.ts:23-33` |
| Recurring non-hero characters exist only as a **soft prose rule** ("repeat a descriptor verbatim") | `prose.prompt.ts:47-54` |
| Nothing says "the hero appears exactly once" | `image-portrait.prompt.ts:23` |
| The Gemini provider already accepts `images: Uint8Array[]` but the interface exposes a single `reference` | `gemini-image.provider.ts:18,43`, `image-provider.interface.ts:19` |

The image model is asked to keep a slide consistent it has never been described,
and to keep a brother consistent whose description is re-invented per page by the
prose model. This is the illustration-side twin of the problem ADR-0005 solved
for text: one call overloaded with everything, and the fix is the same —
**decide the visual world once, structurally, in the Plan; render pages from that
decision.**

## Goal

1. A **Visual Bible** — the visual "bible" of the book, produced by the Plan phase
   alongside the narrative plan: hero, cast, locations, props, atmosphere, and a
   per-page **scene** (which location, who is on the page, framing).
2. **Deterministic illustration-prompt assembly** from the bible + the page's
   action, replacing the free-form 180-char prompt and prose rule 7.
3. **Reference sheets** (flagged): one establishing shot per location and one
   portrait per cast member, passed as extra Gemini reference images within the
   model's reference budget, so environment and cast are anchored by *images*, not
   only text.
4. An **`eval:images` harness** that renders a fixed set of stories under
   Baseline / Bible / Bible + sheets and records quality (manual rubric), cost
   and time, so the architecture decision is measured, not guessed (ADR-0005
   "validation gate" discipline).

Not in this spec (own specs/issues later): an automated multimodal image judge
and `ImageEval` gate; the cascade variant (page N−1 as reference); family members
with photos; a reusable `Character` entity. The bible's `cast[].id` is the
extension point for all of them.

## Decisions

1. **The bible is decided in the Plan phase, not in Prose and not at image time.**
   The Plan already owns structure and the hero anchor; it is the only phase that
   sees the whole scenario before wording exists. Prose *uses* the bible (names,
   which cast is on a page) and writes only the page **action**. This mirrors
   ADR-0005: structure in Plan, voice in Prose — here, world in Plan, action in
   Prose, rendering in code.

2. **The bible travels inside `Story`, merged in code, never re-emitted by an LLM.**
   `Book.storyJson` is the only persisted artefact and the image stage (and the
   `images_failed` retry path) reads it. The Plan is not persisted. So after the
   Prose call, `StoryGeneratorService` copies `plan.visualBible` and each page's
   `plan.pages[i].scene` into the `Story` deterministically (same pattern as
   `applyTitle`). The Prose model is **not** asked to carry a nested object
   verbatim — that is brittle and wastes tokens.

3. **Prompt assembly is deterministic and lives in `prompts/`.** The per-page
   prompt is built from fixed blocks in a fixed order (hero lock → cast on page →
   setting → props → action → framing → style → negatives). No LLM rewrites it.
   The 180-char cap and prose rule 7 are removed; the prose model writes the
   **action only** ("Alisa crouches next to her brother at the foot of the slide,
   holding his hand, both looking up"). Appearance and place come from the bible.

4. **Hero-once is a fixed prompt clause, not a schema field.** "The hero appears
   exactly once; never draw the hero twice" goes into the hero-lock block for every
   page where `scene.heroOnPage` is true. A `heroCount` field would be a magic
   number in the schema.

5. **Reference budget is a provider constant, chosen per page.** Gemini 2.5 Flash
   Image accepts at most 3 input images; Gemini 3 Pro Image up to 14 (Google docs,
   checked 2026-09-03 — see References). Priority on a page: hero portrait → cast
   portraits for `scene.castIds` (in order) → location sheet. What does not fit is
   carried by text only. Faces drift more than places, so cast outranks location.
   The budget is `MAX_REFERENCE_IMAGES` per model in `ai.config.ts`.

6. **Sheets are generated once per book, in parallel, before pages; pages stay
   parallel.** No cascade in this spec. Sheets add one image per location and per
   cast member (typically 2–4 extra images per book), keep the page fan-out, and
   do not propagate an early error into later pages. The cascade is a later
   experiment on the same harness, not a prerequisite.

7. **Photo flow precedence is unchanged.** When a parent-approved portrait and
   `characterDescriptor` exist (#128), they override the bible's `hero.descriptor`
   at image time — exactly the current precedence. The bible never sees the photo
   (ADR-0006: the photo lives once and never enters text prompts or traces).

8. **Legacy books keep working.** `visualBible` and `scene` are optional on
   `Story`. A stored story without them (books generated before this change,
   Fast Flow stories) takes the current prompt path unchanged. No data migration.

9. **Bible size is capped by constants.** `MAX_CAST = 3`, `MAX_LOCATIONS = 3`,
   `MAX_PROPS = 4`, `DESCRIPTOR_MAX_CHARS = 160`. A preschool story that needs
   more than three places or three companions is a planning smell, and every
   extra location is another sheet to pay for.

10. **Decision recorded after measurement.** The chosen production variant (B or
    C, and later whether to add D) is written as ADR-0007 "Visual continuity"
    only after the `eval:images` comparison (section "Validation"), with the
    baseline JSON stored under `docs/process/eval-baselines/`.

## Schema

All in `backend/src/ai/schemas/`. English descriptors (they feed the image model);
names in Russian where they must match the story text.

### `visual-bible.schema.ts` (new)

```ts
const id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/); // stable slug, e.g. "slide", "brother"
const descriptor = z.string().min(1).max(DESCRIPTOR_MAX_CHARS); // English, concrete, fixed for the book

export const CastMemberSchema = z.object({
  id,
  /** Name as used in the Russian text (e.g. "братик", "Миша"), so Prose and the bible agree. */
  name: z.string().min(1),
  /** Role in the story, Russian, short (e.g. "младший брат"). */
  role: z.string().min(1),
  /** Fixed English visual descriptor: kind/age + hair + outfit + one distinctive detail. */
  descriptor,
});

export const LocationSchema = z.object({
  id,
  name: z.string().min(1),           // Russian, e.g. "горка во дворе"
  /** Fixed English description of the place: the key object, its materials/colours, what surrounds it. */
  descriptor,
});

export const PropSchema = z.object({ id, descriptor });

export const VisualBibleSchema = z.object({
  hero: z.object({ name: z.string().min(1), descriptor }), // placeholder in child mode, see precedence
  cast: z.array(CastMemberSchema).max(MAX_CAST),
  locations: z.array(LocationSchema).min(1).max(MAX_LOCATIONS),
  props: z.array(PropSchema).max(MAX_PROPS),
  /** One English line fixed for the whole book: season, light, palette mood. */
  atmosphere: z.string().min(1).max(DESCRIPTOR_MAX_CHARS),
});

export const SceneSchema = z.object({
  locationId: id,
  castIds: z.array(id).max(MAX_CAST),
  propIds: z.array(id).max(MAX_PROPS),
  heroOnPage: z.boolean(),
  timeOfDay: z.enum(['morning', 'day', 'evening', 'night']),
  framing: z.enum(['wide', 'medium', 'close']),
});
```

### `story-plan.schema.ts`

- `StoryPlanSchema` gains `visualBible: VisualBibleSchema`.
- `PlanPageSchema` gains `scene: SceneSchema`.
- `characterProfile` stays (it is the existing anchor and the photo-flow
  discriminator); `visualBible.hero.descriptor` is *derived from it* in code after
  the existing `deriveCharacterProfile` override — the plan's own value is a
  placeholder, exactly as `characterProfile` is today.

### `story.schema.ts`

- `PageSchema` gains `scene: SceneSchema.optional()`.
- `baseStorySchema` gains `visualBible: VisualBibleSchema.optional()`.
- The **Prose model's output schema is the current shape without these fields**:
  introduce `buildProseSchema(ageBand)` (what `generateObject` receives) and keep
  `buildStorySchema(ageBand)` as the persisted contract = prose schema + optional
  bible/scene. Fast Flow keeps importing `StorySchema`; its stories simply carry
  no bible (decision 8).
- `illustrationPrompt` keeps its name (the frontend reads it as optional at
  `books/[id]/page.tsx:22`) but its **meaning changes to "page action"**; the JSDoc
  says so.

### Normalisation (code, no LLM)

`normalizeVisualBible(plan)` in `ai/validators/visual-bible.normalizer.ts`:

- unknown `castIds`/`propIds` on a page are dropped; unknown `locationId` falls
  back to the first location; duplicates are de-duplicated;
- cover and final pages get `heroOnPage = true` if the model left it false;
- every drop is counted and attached to the `story-planner` span metadata
  (`bibleRepairs: n`) so a noisy plan is visible in LangFuse.

Repair over rejection: a dangling id is not worth a full plan regeneration.

## Prompts

### Plan (`plan.prompt.ts`)

Add one rule and one output block to `PLAN_SYSTEM_PROMPT`:

> VISUAL BIBLE. Decide the visual world once: the places (1–3), the recurring
> people/animals besides the hero (0–3), the key objects (0–4), and one line of
> atmosphere. Every descriptor is ENGLISH, concrete and physical (materials,
> colours, one distinctive detail), and is FIXED for the whole book — it will be
> reused verbatim on every page. Then, for each page, choose the scene: which
> place, who is on the page, whether the hero is on the page, time of day, and
> framing. Do not describe actions here — the page's `intent` does that.

The catalogue of allowed enum values (`timeOfDay`, `framing`) is rendered from
the schema, not hand-written. Observer mode: the invented hero goes into
`visualBible.hero` like any other; nothing else differs.

### Prose (`prose.prompt.ts`)

- Rule 6 becomes: *`illustrationPrompt` is the ACTION of the page in English —
  what the hero and the listed characters are doing, their poses and expressions,
  one composition hint. Do NOT describe anyone's appearance or the place; both are
  fixed in the bible and added downstream.* No character cap (the assembler
  truncates at `ACTION_MAX_CHARS = 240`).
- Rule 7 (recurring-creature descriptor) is **removed** — superseded by `cast`.
- `renderPlanPages` renders the scene per page:
  `Page 3 [image-top] (Завязка) @горка во дворе · with: братик · hero on page: yes · text max 220 chars: <intent>`
  and the bible's cast list (name + role) is shown once above the pages so the
  prose uses the same names.

### Illustration prompt assembly (`prompts/illustration.prompt.ts`, new)

`buildIllustrationPrompt({ bible, scene, action, heroDescriptor, artStyle, references })`
returns the page text. Blocks, in order, each a named constant:

1. **Hero lock** (only if `scene.heroOnPage`): `Keep this exact child — same face,
   hair, and outfit — as in the first reference image. {heroName} appears EXACTLY
   ONCE in the picture; never draw the hero twice.` When no portrait reference is
   present (OpenAI provider), the descriptor is used instead of "first reference
   image".
2. **Cast on page**: `Also in the scene: {name} — {descriptor}. (as in reference
   image k)` for each cast id, the reference index appended only when that cast
   member's sheet is among the passed references.
3. **Setting**: `Setting: {location.descriptor}. Time: {timeOfDay}. {atmosphere}` —
   plus `(as in reference image k)` when the location sheet is passed.
4. **Props**: `Visible objects: {descriptors joined}` if any.
5. **Action**: the page's `illustrationPrompt`.
6. **Framing**: one fixed phrase per `framing` value.
7. **Style**: `STYLE_SUFFIXES[artStyle]` (unchanged).
8. **Negatives**: `No text or letters. No extra people. Exactly the characters
   listed above.`

`buildPagePrompt` in `image-portrait.prompt.ts` stays for the legacy path and is
called only when the story has no bible.

### Sheet prompts (same file)

- Location sheet: `Establishing shot of {location.descriptor}. {atmosphere}. No
  people, no animals, no text.` + style suffix, aspect `3:2`.
- Cast portrait: reuses `buildPortraitPrompt(descriptor, artStyle)` (full-body,
  neutral background, `2:3`).

## Architecture

### Generation flow

```
Plan (gpt-4o)  ─► StoryPlan { …, visualBible, pages[].scene }
   │  normalizeVisualBible; child-mode appearance override → hero.descriptor
Prose (gpt-5)  ─► prose output (pages with action-only illustrationPrompt)
   │  applyVisualBible(story, plan)  — deterministic merge
Title          ─► Story { …, visualBible, pages[].scene }  → Book.storyJson
Judge / retry  ─► unchanged (text only)
Images:
   portrait (existing: approved photo portrait | synthetic)
   sheets  (flag on): Promise.all(locations → location sheet, cast → cast portrait) → S3
   pages   (parallel, unchanged fan-out):
       refs = pickReferences({ portrait, castSheets, locationSheet, budget })
       text = buildIllustrationPrompt(...)
       provider.generatePage({ prompt: text, references: refs, imageSize, artStyle })
PDF            ─► unchanged
```

### `ImageGeneratorService`

- `ImageGenInput` unchanged externally (story now carries the bible).
- `generate()` → if `story.visualBible` is absent → current code path verbatim.
  Otherwise: `maybePortrait` → `maybeSheets` → pages. The service is close to the
  400-line limit; the sheet stage and reference picking go to a new
  `reference-sheets.service.ts` (S3 upload + spans), and prompt assembly to
  `prompts/illustration.prompt.ts`.
- `pickReferences` is a pure function: given the budget and the scene, returns
  `{ images: Uint8Array[], labels: ('hero'|`cast:${id}`|'location')[] }`; the
  labels drive the "(as in reference image k)" mentions in the prompt and are
  written to the page span metadata.
- Span metadata per page: `bible: true|false`, `references: labels`,
  `variant: 'baseline'|'bible'|'bible+sheets'`.

### Provider interface

`PageInput.reference?: Uint8Array` → `PageInput.references: Uint8Array[]`
(empty array = none). Gemini passes them through; OpenAI ignores them
(`usesReference = false`, as today). New `generateLocationSheet(input)` on the
interface; OpenAI throws the same "requires the Gemini image provider" error as
`generatePhotoPortrait`.

### Configuration (`ai.config.ts` + env)

```ts
export const MAX_REFERENCE_IMAGES: Record<string, number> = {
  'gemini-2.5-flash-image': 3,
  'gemini-3-pro-image': 14,
};
export const DEFAULT_MAX_REFERENCE_IMAGES = 3;
export const MAX_CAST = 3; MAX_LOCATIONS = 3; MAX_PROPS = 4;
export const DESCRIPTOR_MAX_CHARS = 160; ACTION_MAX_CHARS = 240;
```

Env (via `ConfigService`): `IMAGE_REFERENCE_SHEETS=on|off` (default `off` until
the comparison is done; flipped by the ADR). No new secrets.

### Persistence

- `Story` (JSON) carries the bible — no table change for it.
- `Book.referenceImageKeys String[] @default([])` — S3 keys of generated sheets
  (`books/{bookId}/ref-location-{id}.png`, `books/{bookId}/ref-cast-{id}.png`),
  so book deletion (`books.service.ts:461-468`) can remove them. One migration via
  `pnpm --filter backend prisma:migrate`.
- Sheets are regenerated on an `images_failed` retry (all pages regenerate
  together, so cross-retry sheet identity is not needed).

### Observability

New spans under `image-generation`: `image-generation.sheets`,
`image-generation.sheet-location-{id}`, `image-generation.sheet-cast-{id}`.
Page spans gain the metadata above. LangFuse remains the cost/latency source for
the comparison; no image bytes are ever attached to traces (ADR-0006).

## Validation (the gate before choosing a production variant)

### `eval:images` harness (`backend/src/scripts/eval-images.ts`)

- Input: a directory of fixed `Story` JSON fixtures (5 stories: both bands, both
  arcs, child + observer, at least one with a recurring secondary character and
  one with two locations). Produced once by `eval:batch --stories-out=<dir>` (small
  addition: write each generated story as JSON) and then **frozen** — text is not
  regenerated between variants, so only the image path varies.
- `--variant=baseline|bible|bible+sheets`, `--model=<gemini id>`, `--out=<json>`.
  `baseline` strips the bible from the fixture before rendering; `bible` runs
  with `IMAGE_REFERENCE_SHEETS=off`; `bible+sheets` with it on.
- Output: images under `output/eval-images/<variant>/<story>/page-N.png` (the
  `output/` directory is already ignored), plus a JSON with per-page reference
  labels, duration, and the LangFuse cost pulled per span.
- Cost: 5 stories × ~9 pages × 3 variants ≈ 135 page images + ~15 sheets — about
  $6 on Flash. Runs sequentially per story to keep the Gemini rate limit.

### Manual rubric (one row per book × variant, 1–5 each)

| Criterion | What is scored |
|---|---|
| heroConsistency | same child on every page (face, hair, outfit) |
| heroOnce | no page with a duplicated hero (count of violations, not a score) |
| castConsistency | recurring characters keep species/age/hair/outfit |
| locationConsistency | the same place looks like the same place |
| pageMatch | the picture shows what the page text says |
| artefacts | extra limbs, merged faces, text in image (count) |
| styleUnity | one style across the book |

Plus per variant: cost per book, P50/P95 time per book, number of content-policy
retries. Stored as `docs/process/eval-baselines/2026-09-XX-visual-bible.json`
(same convention as the text baselines).

Decision rule: pick the cheapest variant whose heroConsistency,
castConsistency and locationConsistency all improve over baseline and whose
pageMatch does not regress; `heroOnce` violations must go to zero for any
variant to be accepted. The rubric and scores also seed the calibration of the
future automated image judge.

### Unit tests

- `visual-bible.schema.spec.ts`: ids, caps, enum values, `max` limits.
- `visual-bible.normalizer.spec.ts`: dangling ids dropped/fell back, cover/final
  `heroOnPage` forced, repair count.
- `illustration.prompt.spec.ts`: block order, hero-once clause present iff
  `heroOnPage`, reference indices match labels, legacy path when no bible,
  action truncation.
- `pickReferences.spec.ts`: budget 3 → hero + 2 cast; budget 3 with 1 cast →
  hero + cast + location; hero off page → cast + location; budget 14 → all.
- `story-generator.service.spec.ts`: bible + scenes merged into `Story`; child-mode
  appearance override lands in `hero.descriptor`.
- `image-generator.service.spec.ts`: legacy story → old prompt path; bible story →
  sheets called once per location/cast when flag on, never when off;
  `referenceImageKeys` returned.
- `plan.prompt.spec.ts` / `prose.prompt.spec.ts`: rule text present / rule 7 gone.

### Live check (Definition of Done)

`eval:images` run for all three variants on the frozen fixtures, rubric filled,
baseline JSON committed, ADR-0007 written with the choice. Then one real book
generated through the UI on the chosen variant with its `StoryEval` row and
LangFuse trace (`image-generation.*` spans with `variant` metadata).

## Rollout

1. Schema + normaliser + plan/prose prompt changes + merge into `Story`
   (text-only; verify with `eval:text` that register did not move — the prose
   prompt changed).
2. Prompt assembly + `references[]` interface + legacy path guard.
3. Sheets service + flag + `referenceImageKeys` migration.
4. `eval:images` harness, fixtures, comparison, ADR-0007, flag default.

Steps 1–2 ship as one PR (the bible is useless without the assembler), 3 and 4
as one PR each. Total ≈ 3 PRs.

## Docs to update in the same PRs

- `CONTEXT.md`: add **Visual Bible**, **Scene**, **Reference Sheet**; mark
  **Companion Descriptor** as superseded by `cast`; update the Custom Flow line.
- `docs/ARCHITECTURE.md`: pipeline diagram (sheets stage, references per page).
- `docs/adr/0007-visual-continuity.md`: after the comparison (decision 10).
- `progress.md`: per session.

## Out of scope (deferred, tracked)

- **Image judge / `ImageEval` gate** — own spec; this spec's rubric is its
  calibration set.
- **Cascade (page N−1 as reference)** — experiment on the same harness after B/C
  are measured; sequential generation and error propagation are its known costs.
- **Family members with photos** — needs a `Character` entity (portrait reuse,
  per-person consent), ADR-0006 gaps (#332) closed first. The bible's `cast[].id`
  plus `pickReferences` already accept a cast portrait, so a photo-derived family
  portrait plugs in without changing this design.
- **Cover composition and 300 DPI print** — untouched (ADR-0002).

## References

- Google, *Gemini 2.5 Flash Image* model page — "maximum images per prompt: 3"
  (https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image).
- Google, *Image generation (Nano Banana)* — Gemini 3 Pro Image accepts up to 14
  reference images (https://ai.google.dev/gemini-api/docs/image-generation).
- `docs/superpowers/specs/2026-06-22-gemini-character-consistency-design.md` —
  the portrait-reference architecture this spec extends.
- `docs/superpowers/specs/2026-07-29-photo-character-thin-slice-design.md` —
  photo precedence and descriptor rules kept intact here.
