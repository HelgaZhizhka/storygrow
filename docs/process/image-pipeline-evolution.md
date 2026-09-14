# Image pipeline — how it works, what we tried, what it costs (2026-09-14)

**Status:** living document, written at the end of the 2026-09 image cycle (#348 → #381). The
point-in-time records it summarises stay where they are: the design spec
(`docs/superpowers/specs/2026-09-03-visual-bible-design.md`), ADR-0007, the judge calibration
report (`image-judge-calibration-2026-09-06.md`), the independent review
(`image-pipeline-review-2026-09-09.md`) and the `progress.md` entries from 2026-09-03 on. When the
code moves, update this file in the same PR (see `docs/agents/domain.md`).

Companion for the text side: `ai-text-quality-evolution.md`.

## 1. How a book gets its pictures today

```
Plan (gpt-4o)          → story structure + the Visual Bible: hero / cast Appearance
                          (kind, skin, hair, outfit, detail — all required), Locations
                          (key object, size next to the child, materials, surroundings),
                          props, atmosphere; one Scene per page (location, cast, props,
                          hero on page). Repairs counted by kind (normalizer).
Prose (gpt-5)          → text + one ACTION line per page, exactly the plan's pages,
                          only the names «в кадре»; the world is fixed.
Portrait + sheets      → 1 hero portrait (or the parent-approved photo portrait),
  (Grok, once/book)       1 sheet per cast member, 1 establishing shot per location.
Page render            → per page, in parallel: lean prompt (identity line without
  (Grok, ≤5 references)   the name · cast · setting · ACTION last · style) + up to 5
                          reference images (hero → cast → location). A refusal fails
                          the page loud; no prompt rewriting.
ImageEval judge        → Gemini 3.6 Flash answers boolean criteria against the very
  (per attempt)           references the page came from (heroMatch, heroOnce,
                          sceneMatch, cast/locationConsistency, proportionsNatural,
                          ageSafe, artefacts). Preflight on bytes/aspect first.
Retry                  → a failing page is re-rendered (same prompt, fresh sample)
                          up to IMAGE_EVAL_MAX_RETRIES (default 1); the attempt with
                          the fewest failures ships. Soft gate: a judge false negative
                          never blocks a book. Every attempt writes an ImageEval row
                          with model, prompt and reference labels.
PDF                    → Puppeteer; per-page SSE progress on the way («Иллюстрация 3 из 8»).
```

Where it lives: `backend/src/ai/image-generator/` (providers, `reference-sheets.service.ts`,
`page-renderer.ts`, `image-judge.service.ts`, `pick-references.ts`), prompts in
`backend/src/ai/prompts/illustration.prompt.ts`, `image-portrait.prompt.ts`,
`image-judge.prompt.ts`; schemas in `backend/src/ai/schemas/visual-bible.schema.ts`,
`image-judge.schema.ts`; the S3 layout in `backend/src/s3/book-keys.ts`; the glossary in
`CONTEXT.md` (Visual Bible, Scene, Reference Sheet, Image Eval, Character Appearance).

**Configuration** (all validated at startup, `backend/src/config/env.schema.ts`): `IMAGE_PROVIDER`
(only `xai` since #397 removed the Gemini fallback; anything else fails the boot),
`XAI_API_KEY`, `IMAGE_EVAL_MAX_RETRIES` (the only kill switch: 0 = judge and record,
never re-render). No Google key: Grok does the images and the vision (judge, photo
descriptor) since #397. There are
no other image flags; every finished experiment is a constant or is gone.

**Reading a bad page without LangFuse:** `pnpm --filter backend check:book --book=<id>` lists every
attempt; the `ImageEval` row carries the criteria, the reasoning, the model, the full prompt and
the reference labels. `/admin/metrics/images` aggregates the last 7 days.

## 2. Timeline — what we tried and what each step changed

| Date | Step | What it changed | Evidence |
|---|---|---|---|
| 2026-08-28 | The problem | The same playground looked different on every spread, a secondary character changed clothes, the hero was drawn twice, a slide had steps on its chute. | owner review of a live stream |
| 09-03 | **Visual Bible** (#348 → #350, #351) | The Plan fixes *what* is drawn once (hero, cast, locations, props, atmosphere) and selects per page; a deterministic normalizer repairs dangling ids instead of regenerating the plan; reference sheets behind a flag. | spec, 5 frozen stories |
| 09-03 | **Harness** `eval:images` (#352) | Five frozen stories rendered under strategies and models, judged by a vision model instead of by taste. | `backend/output/eval-images` |
| 09-04 | **Findings that changed the design** | Cascade (page N edited from page N−1) inherits poses and bleeds locations → rejected. A neutral hero portrait as the reference on every page holds identity. The *dense* prompt itself broke poses model-independently (dense 0/3, lean 3/3): a standalone `Visible: <prop>` line makes the prop the subject; the hero's name gets drawn as a sign. | progress 2026-09-04 |
| 09-04 | **ADR-0007** | Portrait-as-reference, fresh composition per page, lean prompt, Grok Imagine 2.0 as default (Gemini Flash fallback), judge + retry instead of per-object prompt rules. | ADR-0007 |
| 09-06 | **Cast drift root cause** (#356) | The owner reviewed every page and found the brother's clothes changing: only 1 reference was passed to Grok. Probed the API: 5 references accepted. Sheets on by default, budget 5, normalizer forces the hero and named cast onto the page. | 5 books × every page |
| 09-06 | **ImageEval judge** (#358 → #362) | Gemini 3.6 Flash + `generateObject`, boolean criteria against the page's own references, one row per attempt, re-render on FAIL, soft gate. Calibrated on labelled pages. | calibration v1–v3 |
| 09-06 | **Structured appearance** (#360 → #363) | Outfit and skin tone can no longer be omitted: `Appearance {kind, skin, hair, outfit, detail}` rendered into descriptors; implied nouns added in code. | brother's sweater stopped changing |
| 09-07 | **Judge was silently off** (#364 → #365) | `@Optional` + a union type made Nest inject `null`; the first real book had no rows. Explicit injection, then (#373) a required dependency and an `AiModule` compile test. | first real book with rows |
| 09-09 | **Independent review** (#368 → #370) | A fresh session reviewed the pipeline: 24 decisions in four waves (delete, contract, ops, docs). Also corrected the calibration: six `judge:unavailable` rows had been counted as PASS. | review doc |
| 09-11 | **Judge blind spot** (#369 → #371) | Gemini's `PROHIBITED_CONTENT` filter tripped on the child's text descriptor; hidden as "Invalid JSON". Point the judge at the portrait, retry identity-only, always write a row (`judge:blocked:<reason>`, `judge:unavailable`). Durable calibration set (52 pages, 3 bad): 3/3 caught, 0/49 false fails. | calibration v4 |
| 09-13 | **Wave A: delete + fail loud** (#372, #373, #374) | Cascade, `timeOfDay`/`framing`, Pro leftovers, harness variants gone; Zod env validation, default `xai`, `check:book`; `images_failed` retry reuses portrait and sheets and numbers attempts per run. | 22 tests fewer, 1 migration |
| 09-13 | **Wave B: the contract** (#367, #366, #376, #378) | Prose sees the world it may write in («в кадре» per page) and no longer owns the hero's look; Location gets a *size next to the child* and the judge a `proportionsNatural` criterion (the huge girl on the slide); one hero-appearance source in every mode incl. photo; the Plan owns the page count; `.describe()` on every model-facing field; repairs counted by kind. | real books after each PR |
| 09-13 | **Wave A tail** (#375) | OpenAI image provider, `usesReference` and the DALL-E prompt simplifier deleted; a refusal fails the page loud. | Grok book unchanged |
| 09-14 | **Wave C: ops** (#380, #379) | ESLint enforces 400 / 30 / 3; one S3 key layout; provenance (model, prompt, labels) on every `ImageEval` row and `Book.imageModel`; cost per provider on `/admin/metrics/images`; per-page SSE progress. | this document |

Things that were tried and are **not** in the code any more, with the evidence kept in ADR-0007:
cascade rendering; Gemini Pro as default (×3.4 cost for mixed quality); portrait-only references;
the dense prompt; the DALL-E prompt simplifier; the OpenAI image provider; `IMAGE_EVAL` /
`IMAGE_REFERENCE_SHEETS` flags.

## 3. Numbers

**Judge calibration** (durable set, `backend/output/calibration/`, 52 pages, 3 labelled bad):
v4 3/3 caught, 0/49 false fails; v5 (with `proportionsNatural`) 3/3, 1/49 — the one false fail is
the judge being right about a pre-#360 cast sheet. Not re-measured since the scratchpad loss:
recall on "child on the chute" (the 21 controlled ladder samples are gone).

**Local production-path runs since the judge went live** (2026-09-07 → 09-14, the only place the
new pipeline has run — see §5): 9 books, 79 judged renders, first-attempt pass 63/71 (89%), 8
re-renders, 5 judge safety blocks answered identity-only, 0 unavailable. Top failures:
`artefact:wrongSurface` 8, `proportionsNatural` 5, `sceneMatch` 2.

**Cost per book** (Grok, `IMAGE_COST_USD`, ADR-0007 measurements): a page render is $0.04 +
$0.01 per reference; a portrait or sheet $0.04. A 7-page book with 2 references per page, 1
portrait and 2 sheets ≈ 7 × 0.06 + 3 × 0.04 = **$0.54**; each judge re-render adds one page
price. The vision judge is ≈ $0.002 per call and is not counted in the dashboard. Gemini Flash
image would be ≈ $0.039 per image with no reference surcharge (≈ $0.35/book).

**Total spend, estimate** (no vendor export in the repo — the xAI and Google consoles are the
source of truth): the harness runs of 09-03 → 09-06 rendered ≈ 211 pages across variants and
models plus their portraits/sheets, the calibration re-judged 52 pages five times, and the local
production-path runs above bought 79 + 32 images. Order of magnitude **$25–40 on images and
under $2 on the judge** for the whole cycle. From #379 on, spend per provider is counted per row
and readable on `/admin/metrics/images`.

## 4. Open limits and decisions that are not ours to make

- **Nothing of this has run in production yet.** The 18 ready books in Railway are all pre-#348
  (Gemini, no bible, no judge rows); every verification in this cycle was a real book through
  the *local* API. The first production book on the new pipeline is the owner's call and needs
  `IMAGE_PROVIDER=xai`, `XAI_API_KEY` and the migrations (Railway applies them on deploy).
- **LangFuse is off in production** (#382): hard constraint 10 is not met there; the DB now
  carries enough to diagnose a page, but span-level cost and latency are local-only.
- **Prose can still invent a character the Plan never declared** (#390: an empty cast, a brother
  on pages 4–6, the girl alone in the pictures). Rule 7 forbids it; nothing checks it. Text track,
  with the illustrator brief (#377) and the register work (#387).
- **Gemini's safety filter** blocks the judge's full task on innocent child pages a few times per
  book; the identity-only fallback keeps the page checked but `sceneMatch` is then unknown.
- **Proportions** remain the most frequent honest failure (`proportionsNatural`): a table «twice
  the child's height» still comes out waist-high; the judge catches it, the re-render sometimes
  does not fix it, and the page ships with the failure on record (soft gate by design).
- **Style previews are not Grok** (#392): the thumbnails a parent picks from were made with
  `gpt-image-1`.
- **Photo mode** is unit-tested only in this cycle (no local photo); the structured look path
  (#376) has not been exercised with a real upload since.

## 5. Where to look

| Question | Place |
|---|---|
| Why does page N look wrong? | `check:book --book=<id>`; the `ImageEval` row (prompt, labels, reasoning); the images under `books/<id>/` (`bookKeys`) |
| Is the judge still calibrated? | `pnpm --filter backend eval:image-judge --manifest=output/calibration/manifest.json` |
| How much did images cost this week? | `/admin/metrics/images` (admin) |
| What does the model see? | `illustration.prompt.ts` (page), `image-portrait.prompt.ts`, `image-judge.prompt.ts` |
| What did we decide and why? | ADR-0007, the review doc, `progress.md` 2026-09-03 → 09-14 |
