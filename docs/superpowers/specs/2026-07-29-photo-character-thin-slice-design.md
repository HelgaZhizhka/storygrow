# Photo-based character likeness — thin vertical slice

**Issue:** #128
**Date:** 2026-07-29
**Depends on:** #174 (reference-portrait pipeline, Gemini), ADR-0005 (decomposed pipeline)
**Supersedes the technical framing of:** #128 (pre-Gemini, assumed OpenAI `images.edit`)

## Problem

The book's premise is "your child is the hero", yet today the hero's likeness is
invented: `characterProfile` is a **text** description, from which we generate a
**synthetic** reference portrait that anchors every page. The parent cannot make
the hero actually resemble *their* child.

We want the parent to **upload one photo of the child** and get a hero who is
**recognisably that child** across the book. This is the product's core promise
and the feature to show at the defense.

### Correction to #128's technical framing

#128 (written pre-ADR-0005) claimed reference-image generation needs a direct
OpenAI `images.edit` call because "Vercel AI SDK `generateImage` does not support
input images". **This is no longer true.** The current `GeminiImageProvider`
already passes a reference image through the SDK
(`{ text, images: [reference] }` in `generatePage`). The reference-image path is
already open in code — no carve-out from the `generateImage` convention needed.

## Goal (thin slice)

Real upload → real reference-based generation → real book, wired into the
existing Gemini pipeline. Ship the convincing "upload Masha's photo → Masha in
the book" moment for the defense, with honest, cheap privacy mitigations.
Heavy production privacy machinery is **deliberately deferred** and documented,
not silently skipped.

## Decisions (from grilling)

1. **Scope — real thin vertical slice.** Works for defense now; grows into a
   product feature later. Not a smoke-and-mirrors demo.

2. **Likeness target — recognisably the same child, stylised (level A).** Not
   photorealism. Preserve features (hair/eye colour, freckles, face shape) but
   render in the book's Suteev/watercolour register. Photoreal faces in a
   watercolour scene read as uncanny collage and drift across pages; models hold
   *features* across scenes far better than a copied face.

3. **Integration point — photo → ONE stylised portrait → anchors all pages.**
   Change exactly one step: the source of the reference portrait. Instead of
   "draw a portrait from text", do "img2img the uploaded photo into a stylised
   portrait". Every page still anchors on that single portrait — the proven
   consistency architecture (#174). Consequence for likeness: a single anchor is
   *why* the child stays recognisable across pages; 10 pages each re-interpreting
   the raw photo would drift.

4. **Model — RESOLVED: Gemini stays; prod default Flash.** Bake-off ran on 3 real
   child faces (`spike-photo-portrait.ts` / `-qwen.ts`).
   - **Qwen-Image-Edit (Alibaba DashScope) — rejected.** Not on picture quality
     (it was competitive) but on **privacy**: DashScope intl = Alibaba Cloud
     Singapore, i.e. cross-border transfer of a **minor's biometric image** to a
     Chinese cloud — a materially different legal posture than Google, which the
     defense will question and which decision 5 does not cover. No image win big
     enough to justify that. Grok/Aurora dropped earlier (weakest at "same face").
   - **Default `gemini-2.5-flash-image` (Nano Banana).** Recognisable, consistent,
     already integrated, ~3.4× cheaper than Pro.
   - **`gemini-3-pro-image` (Nano Banana Pro) — optional quality flag** (env
     `GEMINI_MODEL`). Richer watercolour texture; if anything slightly *better*
     than Flash across the board. Flash is the default on **cost** (~3.4× cheaper),
     not quality. (An earlier "Pro is worse on kid3" turned out to be a descriptor
     bug, not the model — see 6a.)
   - **Two fixes moved likeness more than the model did** (see decision 6a and
     Architecture): correct portrait aspect ratio, and a vision **descriptor**
     pre-step. These become core feature mechanics, not spike-only.

5. **Privacy — cheap mitigations now, heavy machinery deferred.**
   - **Now:** visible parental-consent checkbox (generation disabled without it);
     raw photo **deleted from S3 immediately after the portrait step** (thanks to
     decision 3 the raw photo is needed exactly once); photo never logged / never
     sent to LangFuse traces.
   - **Deferred (ADR + "known gaps"):** encryption at rest, TTL policy, erasure-
     on-request, upload moderation / age-of-consent checks, legal copy, portrait
     reuse across books.

6. **Modes — photo only in `child` mode; photo COMPLEMENTS text.** Observer mode
   has an invented character, no real child. In child mode the portrait step gets
   the photo (identity: who this is) **and** the optional text appearance
   (outfit / one detail the photo can't carry, e.g. "astronaut suit"). Text
   becomes optional; one good frontal photo alone suffices. `characterProfile` in
   child mode stops being purely textual → update `CONTEXT.md` (drop "there is no
   image of the child").

6a. **Vision descriptor pre-step (validated by the bake-off).** One vision call
   turns the photo into a compact named-feature line ("round face, wide-set
   blue-gray eyes, wavy strawberry-blonde hair, rosy cheeks, ~5-year-old girl").
   Empirically this was a bigger likeness lever than the model choice — it stops
   the generator regressing to a generic "average child". The descriptor is
   **auto-generated**, so the parent is never forced to type anything; best UX is
   to pre-fill decision 6's optional text field with it, **editable**, so a
   mis-read is correctable before generation. The photo stays the primary anchor;
   the descriptor reinforces. **Real mis-read example:** the vision step described
   kid3's *tooth gap* (diastema) as "missing front teeth", and Pro then rendered a
   disturbing gap where Flash coped. This is exactly why the field must be
   editable — the parent would fix "missing teeth" → "small gap between front
   teeth". **Confirmed by A/B:** re-running the *same* Pro model on kid3 with the
   phrase corrected to "small gap between her front teeth" (or omitted entirely)
   produced a natural smile — the model was faithfully rendering a bad instruction,
   not failing. One wrong token in the descriptor can wreck an image; a one-line
   edit fixes it. **Tuning:** also bias the descriptor toward *stable* identity
   features (face shape, eyes, hair) and downweight transient/awkward ones.

7. **Failure handling — no silent fallback to an invented look.**
   - No face on the photo → validate **before** generation via one cheap Gemini
     vision call ("is there a child's face?"); reject and ask for another photo.
     No new face-detection dependency.
   - Model refuses (content policy) → one retry (reuse the existing
     `simplifyIllustrationPrompt` pattern), then an honest error
     ("couldn't process this photo, try another"). Silently substituting an
     invented face into "a book about *my* child" is worse than an honest error.
   - Portrait looks wrong / not similar → handled by the **preview gate**
     (decision 8): the human decides, with "regenerate" / "change photo".

8. **Flow — two-phase with a preview gate; single photo.**
   - Phase 1 (interactive, short): upload photo (+ optional text) → validate face
     → generate stylised portrait → **show preview** → parent approves.
   - Phase 2 (async, ~3–10 min): the existing BullMQ pipeline, but `maybePortrait`
     loads the **approved** portrait instead of generating one.
   - One photo for the slice; multi-angle deferred.

9. **Likeness evaluation — human preview + visual bake-off; no auto judge.**
   The preview gate is the human quality check. No automated face-similarity
   judge (it *is* face-recognition → new heavy dependency + amplifies the
   biometric risk + unneeded for the demo). The bake-off comparison image is the
   defense-grade proof of model choice. `StoryEval`/LangFuse text discipline is
   untouched; the portrait step is **traced** in LangFuse (fact, latency, model)
   but carries no judge score.

## Architecture (thin slice)

Phase 1 — new, interactive:
- Frontend: photo upload UI + consent checkbox on the child/book form.
- Backend: upload endpoint (needs presigned PUT or multipart — `S3Service` today
  has only `uploadObject` + read `getSignedUrl`), stores raw photo under a
  private key.
- Portrait step: `photo (+ optional text) → stylised portrait` via
  `GeminiImageProvider` img2img (reference = the photo). Face-present vision
  pre-check. Persist portrait to S3 (`Book.characterPortraitKey`, already exists).
- Delete raw photo from S3 after the portrait is persisted.
- Preview/regenerate endpoint returning the portrait for approval.

Phase 2 — minimal change:
- `ImageGeneratorService.maybePortrait`: when an approved photo-derived portrait
  exists, **load it** instead of generating from text. Everything downstream
  (per-page reference anchoring) is unchanged.

Data model:
- `Child`/`Book`: a way to carry the (transient) raw `photoKey` and the consent
  flag through phase 1. Exact placement TBD in the plan.

Docs to update in the same PR:
- `CONTEXT.md`: `characterProfile` / "no image of the child" lines.
- New ADR: photo-likeness slice + deferred privacy gaps (the honest
  "known gaps" the defense will ask about).

## Out of scope (deferred, documented)

Multi-angle photos, portrait reuse across books, automated likeness judge,
Qwen in prod (unless bake-off wins), encryption-at-rest / TTL / erasure-on-request
/ moderation / legal copy, fast-flow support (photo likeness is custom-flow only).

## Bake-off first

Model choice (decision 4) gates the prod path, so the bake-off runs **before**
implementation. Extend `backend/src/scripts/spike-gemini-consistency.ts` into a
`photo → stylised portrait` comparison (Gemini vs Qwen) over 3–4 real frontal
child photos supplied by the user. Requires `GOOGLE_GENERATIVE_AI_API_KEY`
(present) and a DashScope key for Qwen.
