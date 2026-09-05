# ADR-0007: Visual continuity — portrait-as-reference, lean illustration prompt, Grok as default image model

**Status:** Accepted
**Date:** 2026-09-04
**Issues:** #348 (tracker), #350/#351/#352 (rollout), PRs #353/#355/#356 · **Spec:** `docs/superpowers/specs/2026-09-03-visual-bible-design.md`

## Context

On the 2026-08-28 stream, illustrations drifted between pages: the same
playground looked different on every spread, a secondary character changed
appearance, the hero was drawn twice, and a slide was drawn with steps on the
sliding surface. The Visual Bible (#353) fixed *what* is drawn — one fixed set
of descriptors for hero, cast, locations, props — and the harness (#356) let us
compare rendering strategies on five frozen stories with a vision judge instead
of by taste.

## Decision

1. **Reference strategy: the hero's neutral portrait is the reference on every
   page; each page is composed fresh.** No cascade (page N edited from page N−1)
   by default. Pages render in parallel (~30–35 s/book).
2. **The illustration prompt is deliberately lean**: identity line (no hero
   name) · cast · setting + atmosphere · the page ACTION last and unqualified ·
   style suffix. No standalone props line, no framing phrase, no negatives, no
   "as in reference image k" mentions (`illustration.prompt.ts`).
3. **Default image model: xAI Grok Imagine 2.0** (`IMAGE_PROVIDER=xai`,
   `XAI_API_KEY`). Gemini `gemini-2.5-flash-image` stays the fallback behind the
   same flag; OpenAI `gpt-image-1` remains legacy. The code default constant stays
   `gemini` so the app boots without an xAI key; production sets `xai` via env.
4. **Reference sheets (#355) and cascade stay flag-gated experiments** — not
   defaults. Grok's edit endpoint takes one reference, so sheets do not apply
   to it anyway.
5. **Correctness for unforeseen objects is handled by a judge + per-page retry**
   (`ImageEval`, #358), not by per-object prompt rules.

## Evidence (all judged by a vision model and checked by eye)

- **Cascade over-preserves.** Edit-from-previous-page inherited the prior pose
  (hero on the slide chute) and bled locations (a slide inside the kitchen).
- **Portrait-as-reference holds identity and removes bleed** on both Grok and
  Gemini; the kitchen page rendered clean once nothing was inherited.
- **The dense prompt itself broke poses, model-independently.** Same page, same
  portrait, 3 samples per shape: dense prompt 0/3 correct, lean 3/3; the old
  pipeline prompt 0/3, the fixed pipeline prompt 3/3. Two general causes: a
  standalone `Visible: <prop>` line before the action made the prop the focal
  subject (child ends up on it); the hero's name in the image prompt was drawn as
  a signpost ("Alice").
- **Whole hardest book with the lean prompt**: slide correct (judge PASS), kitchen
  clean, adult scale natural, hero consistent — on Grok *and* Gemini Flash.
- **Model:** Grok gives the best geometry and picture quality at ~$0.04/image +
  $0.01/reference (~$0.45/book); Gemini Flash is ~$0.35/book and acceptable with
  the lean prompt; Gemini Pro (~$1.20/book) improved geometry but degraded a face
  and is not justified.

## Alternatives rejected

- **Cascade as default** — best raw continuity, but inherits poses/locations and
  is sequential (~130 s/book).
- **Reference sheets as default** — location/cast anchors helped on Gemini, but
  the lean prompt + portrait covers the drift they targeted, they add ~60% images,
  and the chosen model accepts a single reference.
- **Gemini Pro as default** — cost ×3.4 for mixed quality.
- **Per-object prompt rules** ("how to draw a slide") — whack-a-mole; replaced by
  general principles (no props line, no name) plus the judge.

## Consequences

- `IMAGE_PROVIDER=xai` + `XAI_API_KEY` must be set in Railway (`storygrow-api`)
  and locally; `.env.example` and `CLAUDE.md` updated. Gemini key remains
  required for the photo descriptor (vision) and as image fallback.
- The photo-character feature (#128) sends a child's photo to the active image
  provider; using xAI for that step is a separate privacy decision (ADR-0006
  gaps, #332) — the photo path is outside the launch flow.
- `gemini-2.5-flash` (vision) is unavailable on the new Google project — tracked
  as its own fix (`gemini-3.6-flash`).
- Prose rule 6 now keeps the hero's name out of the page action.
- Follow-ups: `ImageEval` judge + retry (#358); prose actions phrased for the
  illustrator; optional cartoon style (renders geometry more crisply).
