# ADR-0007: Visual continuity — portrait-as-reference, lean illustration prompt, Grok as default image model

**Status:** Accepted (amended 2026-09-05: reference sheets on by default, 5-reference budget on Grok)
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
4. **Reference sheets (#355) are ON by default** (`IMAGE_REFERENCE_SHEETS=on`,
   amended 2026-09-05): one stylised portrait per cast member and one
   establishing shot per location, generated once per book and passed as
   references next to the hero portrait (`pickReferences`: hero → cast →
   location, within the model budget). Grok's edit endpoint accepts **up to 5**
   input images via the `images` array (probed; the docs' single `image` field
   had misled us into a budget of 1), so the budget is 5 there and 3 on Gemini
   Flash. Cascade stays a flag-gated experiment.
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
- **Cast drifts without a picture anchor (2026-09-05, found by the product owner
  reviewing every page of the 5-book Grok set).** With only the hero portrait
  passed, cast members were text-only and their descriptors lacked outfit or skin
  tone: the toddler brother wore different clothes on every page, a friend's skin
  tone changed between pages, a page whose plan flag said `heroOnPage: false`
  (while its intent put the hero in the foreground) got no portrait and a generic
  child. Re-rendering the two worst books on Grok with cast + location sheets as
  references fixed it on **12/12 pages** (same text, same prompts); the
  normalizer now forces `heroOnPage` when the page intent names the hero.
- **Model:** Grok gives the best geometry and picture quality at ~$0.04/image +
  $0.01/reference (~$0.45/book); Gemini Flash is ~$0.35/book and acceptable with
  the lean prompt; Gemini Pro (~$1.20/book) improved geometry but degraded a face
  and is not justified.

## Alternatives rejected

- **Cascade as default** — best raw continuity, but inherits poses/locations and
  is sequential (~130 s/book).
- **Portrait-only (no sheets) as default** — the first version of this ADR chose
  it, believing Grok accepted a single reference and that the lean prompt covered
  the drift. A full-page review showed cast drift on 2 of 5 books; the sheets add
  ~3 images per book (~+30% image cost on Grok) and remove it.
- **Gemini Pro as default** — cost ×3.4 for mixed quality.
- **Per-object prompt rules** ("how to draw a slide") — whack-a-mole; replaced by
  general principles (no props line, no name) plus the judge.

## Consequences

- `IMAGE_PROVIDER=xai` + `XAI_API_KEY` must be set in Railway (`storygrow-api`)
  and locally; `.env.example` and `CLAUDE.md` updated. Gemini key remains
  required for the photo descriptor (vision) and as image fallback.
- Sheets are on unless `IMAGE_REFERENCE_SHEETS=off`; a book costs ~3 extra
  images plus $0.01 per reference per page on Grok.
- Open: the hero descriptor in the image prompt is the prose `characterProfile`
  (starts with the hero's name, prose phrasing, cut at 160 chars) — it should be
  a visual-only descriptor; and the Plan should be required to give every cast
  member an outfit and skin/hair colour (#360).
- The photo-character feature (#128) sends a child's photo to the active image
  provider; using xAI for that step is a separate privacy decision (ADR-0006
  gaps, #332) — the photo path is outside the launch flow.
- `gemini-2.5-flash` (vision) is unavailable on the new Google project — tracked
  as its own fix (`gemini-3.6-flash`).
- Prose rule 6 now keeps the hero's name out of the page action.
- Follow-ups: `ImageEval` judge + retry (#358); prose actions phrased for the
  illustrator; optional cartoon style (renders geometry more crisply).
