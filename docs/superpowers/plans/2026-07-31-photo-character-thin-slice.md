# Photo-Character Thin Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Design spec:** [`docs/superpowers/specs/2026-07-29-photo-character-thin-slice-design.md`](../specs/2026-07-29-photo-character-thin-slice-design.md) · **Issue:** #128

**Goal:** In `child` mode, let a parent upload one photo of their child, turn it into a stylised portrait that is recognisably that child, approve it in a preview, and have every page of the book anchor on that approved portrait — so the hero looks like the real child throughout.

**Architecture:** Two phases. **Phase 1 (interactive, new):** upload photo → one vision call that both checks a child's face is present *and* extracts an editable feature descriptor → generate a stylised portrait (photo as reference, aspect 2:3) → persist to `Book.characterPortraitKey` → **delete the raw photo** → show a preview the parent approves/regenerates. **Phase 2 (async, minimal change):** the existing BullMQ pipeline's `ImageGeneratorService.maybePortrait` **loads the approved portrait** instead of generating one from text, and the descriptor is folded into `characterProfile`. The per-page reference-anchoring architecture (#174) is unchanged.

**Model:** Provider stays Google Gemini. Prod default `gemini-2.5-flash-image`; `gemini-3-pro-image` selectable via `GEMINI_MODEL`. (Bake-off resolved — spec decision 4.)

**Tech Stack:** NestJS, Prisma, Zod, Vercel AI SDK (`generateObject` for the descriptor, `generateImage` for the portrait), Next.js App Router, react-hook-form, Jest, Vitest + Testing Library.

## Global Constraints

- No `any` — `unknown` + Zod parse or explicit type guards.
- `pnpm` only. No inline styles — Tailwind / existing `sg-*` classes.
- Files > 400 lines split before commit; functions > 30 lines or 3+ params use an object parameter.
- The vision descriptor call goes through `generateObject` with a Zod schema, a `createTelemetry(...)` LangFuse trace, and its prompt lives in `backend/src/ai/prompts/` as an exported constant.
- Prisma migrations via `pnpm --filter backend prisma:migrate` (never raw `migrate dev` — protects the pgvector HNSW index).
- **Privacy invariants (spec decision 5):** the raw photo is written to a **private** S3 key, is **deleted immediately after** the portrait is persisted, and is **never** logged or attached to a LangFuse trace. Only the *stylised portrait* and the *text descriptor* survive.
- **No silent fallback to an invented look** (spec decision 7): on failure, surface an honest error; never quietly generate a generic child for a "book about my child".
- Photo path is **`child` mode + custom flow only**. Observer mode and fast flow are untouched.

---

### Task 1: Prisma — per-book photo/descriptor/consent fields

**Files:** Modify `backend/prisma/schema.prisma`; migration via wrapper.

**Interfaces (produced, read by later tasks):**
- `Book.childPhotoKey: String?` — transient private S3 key of the raw upload; nulled after the portrait step.
- `Book.characterDescriptor: String?` — the editable extracted feature line.
- `Book.photoConsent: Boolean @default(false)` — parental consent gate.
- (`Book.characterPortraitKey` already exists — reuse for the approved portrait.)

- [x] Add the three fields to `model Book`.
- [x] `pnpm --filter backend prisma:migrate` (name: `book-photo-character`). Confirm no HNSW drift in the diff. → `20260731065221_book_photo_character` (3 `ADD COLUMN`s only).

---

### Task 2: Vision descriptor + face-present check (one `generateObject` call)

**Files:** New `backend/src/ai/prompts/photo-descriptor.prompt.ts`; new `backend/src/ai/schemas/photo-descriptor.schema.ts`; new service method (e.g. in a new `backend/src/ai/photo/photo-descriptor.service.ts`).

**Interfaces:**
- `PhotoDescriptorSchema` (Zod): `{ hasChildFace: boolean; ageYears: number | null; descriptor: string }`.
- `describePhoto(photo: Uint8Array, mime: string): Promise<PhotoDescriptor>` — one `generateObject` call on the vision model (`gemini-2.5-flash`), traced via `createTelemetry('photo.descriptor', …)` **without** the image bytes in metadata.

- [ ] Prompt: extract *stable* facial-identity features (face shape, eye shape+colour, hair colour+style, skin tone, freckles), name apparent age + gender, and **downweight transient/awkward features** (missing/gappy teeth → describe as "small gap" or omit — see spec 6a mis-read). Also return `hasChildFace`.
- [ ] Schema + prompt-constant tests (shape, no clothing/background leakage in a fixture).

**Test:** unit test the service with a mocked model returning a fixture object; assert trace name and that the photo is not in trace metadata.

---

### Task 3: Stylised-portrait-from-photo on the image provider

**Files:** Modify `backend/src/ai/image-generator/providers/image-provider.interface.ts`, `providers/gemini-image.provider.ts`, `backend/src/ai/prompts/image-portrait.prompt.ts`.

**Interfaces:**
- Extend `ImageProvider` with `generatePortraitFromPhoto(input: { photo: Uint8Array; descriptor: string; artStyle: ArtStyle }): Promise<Uint8Array>`.
- `buildPhotoPortraitPrompt(descriptor, artStyle)` in the prompt file — "Full-body character portrait of this child: {descriptor}. Redraw as {style}, preserving those exact features. Centered, plain neutral background." (validated wording from the spike).

- [ ] Gemini impl: `generateImage({ model: google.image(model), prompt: { text, images: [photo] }, aspectRatio: '2:3' })` — **explicit 2:3** (the spike proved a missing aspect silently defaulted to 1:1 and shrank the face).
- [ ] OpenAI provider: throw `not-supported` (photo path is Gemini-only for the slice); keep the interface honest.

**Test:** provider unit test with a stubbed SDK asserting aspect `2:3` and that the photo is passed as the reference image.

---

### Task 3b: Env-selectable image model (Flash default, Pro opt-in)

**Files:** Modify `backend/src/ai/ai.config.ts`, `backend/src/ai/image-generator/image-generator.service.ts`, `backend/src/ai/image-generator/providers/gemini-image.provider.ts`, `.env.example`.

**Why:** prod is currently hardcoded to `gemini-2.5-flash-image` (`ai.config.ts:59`), so the app cannot use Nano Banana Pro. Make the Gemini image model env-overridable so the demo can run `gemini-3-pro-image` without a code change (spec decision 4).

**Interfaces:**
- `GEMINI_IMAGE_MODEL` stays the default constant; add an env read `config.get<string>('GEMINI_IMAGE_MODEL') ?? GEMINI_IMAGE_MODEL` in `ImageGeneratorService`, passed into `GeminiImageProvider` (constructor takes the model id instead of reading the constant directly).

- [ ] Thread the resolved model id from `ConfigService` → provider; keep `modelLabel` reporting the actual id (it already flows into the LangFuse span).
- [ ] `.env.example`: document `GEMINI_IMAGE_MODEL` (default `gemini-2.5-flash-image`; `gemini-3-pro-image` = Nano Banana Pro, ~3.4× cost).
- [ ] Guard: the photo path (Task 3) is Gemini-only, so this switch only ever selects between Gemini image models.

**Test:** unit test that a set env value overrides the default and reaches the provider's `modelLabel`.

---

### Task 4: Phase-1 portrait orchestration service

**Files:** New `backend/src/ai/photo/photo-portrait.service.ts` (or fold into an existing generator module).

**Interfaces:**
- `buildApprovedPortrait(input: { bookId: string; photoKey: string; descriptorOverride?: string; artStyle: ArtStyle }): Promise<{ portraitKey: string; descriptor: string }>`:
  1. load raw photo from S3 (`photoKey`);
  2. `describePhoto` → if `!hasChildFace`, throw `NoChildFaceError`;
  3. descriptor = `descriptorOverride ?? extracted` (parent edits win);
  4. `generatePortraitFromPhoto` (one retry via the existing `simplifyIllustrationPrompt`/refusal pattern, then honest `ImageContentPolicyError`);
  5. upload portrait → `books/{bookId}/portrait.png` → set `Book.characterPortraitKey`;
  6. **`s3.deleteObjects([photoKey])` and null `Book.childPhotoKey`**;
  7. wrap in `startActiveObservation('photo.portrait', …)` — no photo in the span.

- [ ] Implement; regeneration = call again (raw photo still present until first success — see Task 5 ordering note).

**Test:** unit test the happy path (portrait persisted, raw photo deleted, key set) and the `NoChildFaceError` path (no portrait, no deletion, raw photo retained for a retry with a different photo).

---

### Task 5: Phase-1 HTTP endpoints

**Files:** Modify `backend/src/books/books.controller.ts`, `books.service.ts`; DTOs.

**Interfaces (endpoints, all `child`-mode + custom-flow guarded, consent-gated):**
- `POST /books/:id/photo` — multipart upload (Nest `FileInterceptor`; validate mime ∈ {jpeg,png,webp} and size), store via `s3.uploadObject` to a **private** `books/{id}/upload` key, set `Book.childPhotoKey`. Requires `Book.photoConsent === true` (set from the consent checkbox on the create form / a companion field on this request).
- `POST /books/:id/portrait` — run `buildApprovedPortrait`; return `{ portraitUrl: signedUrl, descriptor }`.
- `POST /books/:id/portrait/regenerate` — same, accepts `{ descriptor?: string }` (edited descriptor); re-runs while a raw photo is still present.
- Approval is implicit: the book advances to generation only after a portrait exists (Task 6 guard).

- [ ] Ordering note: keep the raw photo until the parent **approves**; delete on approval (move the Task-4 deletion to a small `approvePortrait` step, or delete on "start generation"). Pick one and document it in the service — the invariant is "raw photo gone by the time async generation starts".
- [ ] Guards: reject on non-child mode, missing consent, missing photo.

**Test:** e2e/controller tests for consent-gate rejection, mime/size rejection, and the happy upload→portrait→regenerate flow with S3 mocked.

---

### Task 6: Phase-2 wiring — load the approved portrait; fold descriptor into `characterProfile`

**Files:** Modify `backend/src/ai/image-generator/image-generator.service.ts` (`maybePortrait`), and the generation entry that builds `characterProfile` (`story-generator.service.ts` / orchestrator).

- [ ] `maybePortrait`: if `Book.characterPortraitKey` already exists **and** it came from a photo (e.g. `Book.characterDescriptor` set), **load** those bytes from S3 and use them as the reference — skip the synthetic text-portrait generation entirely.
- [ ] Prepend `Book.characterDescriptor` into the effective `characterProfile` used for page prompts (keeps named features on every page; the portrait remains the visual anchor).
- [ ] Leave the existing text-only path untouched when no photo/descriptor is present.

**Test:** unit test that with a photo-derived portrait present, no portrait generation call is made and the stored bytes are used as the page reference.

---

### Task 7: Frontend — upload, consent, editable descriptor, preview/regenerate

**Files:** book create flow under `frontend/` (the `child`-mode/custom-flow form + a new portrait-preview step/component).

- [ ] Consent checkbox (parent/guardian) — generation CTA disabled until checked.
- [ ] Photo upload (single image; client-side type/size hint) → `POST /books/:id/photo`.
- [ ] Trigger portrait → show preview image; **editable descriptor text field pre-filled** from the response; "Regenerate" (posts edited descriptor) and "Change photo".
- [ ] "Looks like them → create book" advances to the existing async generation + SSE progress.
- [ ] Only render this step in `child` mode + custom flow.

**Test:** component tests — CTA gating on consent, preview render, regenerate posts the edited descriptor.

---

### Task 8: Docs — CONTEXT + ADR

**Files:** `CONTEXT.md`; new `docs/adr/000X-photo-character-likeness.md`.

- [ ] `CONTEXT.md`: update the `characterProfile` entry and **remove** the "there is no image of the child; text description only" line (spec decision 6); add `Child Photo` / `Character Descriptor` terms.
- [ ] ADR: record the shipped slice **and the deferred privacy gaps as explicit "known gaps"** (encryption at rest, TTL, erasure-on-request, moderation/age-of-consent, legal copy, portrait reuse) — the honest list the defense will probe. Note the Gemini/Qwen privacy rationale (cross-border minor biometrics).

---

### Task 9: Live verification (Definition of Done)

Not optional — this materially exercises a new AI path.

- [ ] Real run: consent → upload a real (consented) photo → approve portrait → full book generates with a real `StoryEval` row + LangFuse traces (`photo.descriptor`, `photo.portrait`, page images), hero recognisable across pages.
- [ ] Confirm the **raw photo is gone** from S3 after generation starts; confirm no photo bytes in any LangFuse trace.
- [ ] `./init.sh` exits 0. Update `progress.md`. Close #128 referencing the PR.

---

## Open confirmations (resolve at implementation time)

- Exact `books.controller.ts` / create-flow shape (consent field placement; whether photo upload is a step in the existing wizard or a new sub-route).
- Frontend component/file names for the create wizard (not yet read).
- Whether the descriptor should also gate `simplifyIllustrationPrompt` reuse or get its own refusal handling.
