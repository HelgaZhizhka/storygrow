# ADR-0006: Photo-character likeness — thin slice and deferred privacy machinery

**Status:** Accepted
**Date:** 2026-07-31
**Issue:** #128 · **Spec:** `docs/superpowers/specs/2026-07-29-photo-character-thin-slice-design.md`

## Context

The product's promise is "your child is the hero", but the hero's likeness was
invented (a synthetic portrait from a text `characterProfile`). #128 adds an
optional **photo character**: a parent uploads one photo and the hero is drawn to
resemble that child. A photo of a child's face is **special-category / biometric
personal data** under GDPR Art. 9, so this feature carries real legal weight.

We deliberately shipped a **thin vertical slice** — genuinely working, but with
cheap privacy mitigations now and the heavier machinery documented and deferred,
rather than blocking the feature entirely (its previous "post-defense" status).

## Decision

**Model / provider.** Provider stays **Google Gemini** (same posture as the rest
of the pipeline). Default `gemini-2.5-flash-image`; `gemini-3-pro-image` opt-in
via `GEMINI_IMAGE_MODEL`. **Alibaba Qwen was rejected** — competitive on image
quality but it would send a minor's biometric image cross-border to Alibaba
Cloud (Singapore), a materially worse legal posture than Google, unjustified by
the (small) quality delta.

**Privacy mitigations shipped now:**
- **Explicit parental consent** is required per upload (checkbox; upload rejected
  without it) — not bundled into general ToS.
- **The raw photo is transient.** It is downscaled on upload (≤1024px), stored
  under a **private** S3 key (`Book.childPhotoKey`), used exactly once to produce
  the stylised portrait, and **deleted the moment book generation starts**
  (`GenerationService.enqueueBook`). What persists is a *drawing* (the portrait)
  and a short text descriptor — not the photo.
- **The photo never enters logs or LangFuse traces** (only `{ bookId }` metadata).
- **Face-present gate**: a photo with no drawable child face is rejected up front;
  there is **no silent fallback** to an invented face for a "book about my child".

## Known gaps (deferred — NOT yet implemented)

These are real and a reviewer/defense panel should expect them called out:

- **Encryption at rest** for the transient upload beyond bucket defaults.
- **Retention / TTL & erasure-on-request**: deletion is tied to generation-start,
  not a general right-to-erasure endpoint or a TTL sweep for abandoned drafts.
- **Upload moderation / age-of-consent verification**: we trust the consent
  checkbox; there is no proof the uploader is the guardian, and no content
  moderation of the uploaded image beyond the face-present check.
- **Legal copy**: no dedicated, reviewed privacy notice for biometric processing.
- **Data-processing assessment** of sending children's faces to Google, and
  documented sub-processor terms.
- **Portrait reuse** across books is out of scope (portrait is per-book).

## Consequences

The feature is demoable and honest: the raw photo lives seconds-to-minutes,
privately, and only a stylised drawing survives. Shipping it to real users at
scale requires closing the "known gaps" above — this ADR is the tracking record
for that follow-up. The preview + regenerate gate (human-in-the-loop) is
load-bearing, not polish: no single model nails every child, and the descriptor
can be mis-read (a tooth gap became "missing teeth" and rendered badly until the
editable descriptor was corrected — see the spec).
