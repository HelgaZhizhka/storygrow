---
status: Proposed
date: 2026-09-23
---

# ADR 0008 — Whole-story text pipeline

**Ticket:** [STO-14](https://linear.app/storygrow/issue/STO-14) · **Spec:** [2026-09-23 whole-story text design](../superpowers/specs/2026-09-23-whole-story-text-design.md) · **Relates to:** [ADR-0005](0005-decomposed-generation-pipeline.md) (decomposed pipeline, partly superseded here), [ADR-0004](0004-safe-conflict-boundary.md) (safe conflict, unchanged), [ADR-0007](0007-visual-continuity.md) (images, unchanged)

## Context

ADR-0005 decomposed generation into Plan → Prose → (Edit) → Judge so that one call would no longer carry structure, safety and voice at once. It delivered the structure, but the prose it produces is page-shaped: the author renders per-page intents into ~220-character slots and never holds a tale it is free to shape. The 2026-09-18 whole-story pilot (branch `issue/387-whole-story-pilot`, `91253c0`) showed a single call can carry causality, dialogue and consequences in one text — and also that it overshoots length (6/6), reuses a plot skeleton per goal, and slips into decorative similes. The owner rejected all six pilot texts and, on 2026-09-23, approved a direction rather than a further round of prompt patching.

Two of ADR-0005's own premises have since failed in production: exemplar-as-few-shot copied plots instead of craft (#311/#313, ADR-0005 amendment 2026-07-25), and the exemplars the judge is calibrated on were never accepted by the owner as gold.

## Decision

**1. The text is written first, as one whole tale; pages come after it.** Order: goal brief → whole tale → text checks → page split + Visual Bible → images → PDF. The split works on paragraph **index ranges** and never re-emits text, so what the owner reads is what the book prints. The Plan phase and its `StoryPlan` schema are retired as the primary artefact; page layout, scenes and the bible are derived from the finished text.

**2. One universal style; Suteev is a reference for clarity, not a voice to imitate.** No style catalogue, switch or device quota. The register description in ADR-0005 §2 ("rich, warm, musical Сутеев voice") and the `registerMatch` two-sided craft score are retired with it.

**3. Gold texts are evaluation material, not the author's few-shot.** Three owner-approved texts (one per supported combination) calibrate the judge and anchor reading tests. Showing a full example to the author is a testable variant, off by default. `exemplars.ts` as a Prose few-shot is superseded.

**4. Length, language and text preservation are deterministic gates.** Word range per band, Russian-only text, paragraph caps, split contiguity and coverage are checked in code before any judge call; a length miss gets one targeted shortening revision inside the existing retry budget. This gives ADR-0005's optional Edit pass its concrete job.

**5. The judge stays, but an uncalibrated score never accepts a book.** Until the judge is calibrated on the gold texts and the rejected pilot texts, only safety and the deterministic gates block; craft is read by a human. Every attempt still writes a `StoryEval` row and a LangFuse trace (hard constraints 9–10 unchanged).

**6. Kept from ADR-0005, unchanged.** Decomposition by concern rather than by page (the split is still one whole-story call); guardrails as pass/fail gates separate from craft; vocabulary-RAG stays out of generation; the safe-conflict boundary lives upstream of the prose (now in the brief and the checks, per ADR-0004 v2 wording once applied); the `Story` contract that images and PDF consume.

**7. Supported combinations are unchanged:** 3–4/virtue, 5–6/virtue, 5–6/flaw. No 3–4/flaw.

## What is approved vs. what is a hypothesis

| Approved by the owner (2026-09-23) | Hypothesis — must be tested before it is treated as fact |
| --- | --- |
| Whole tale first, pages after; text preserved on split | Word ranges 150–250 (3–4) and 350–550 (5–6) |
| One universal style; two arcs; three launch combinations | gpt-5 as the author model |
| Gold texts as evaluation material by default | The premise stage is useless (the pilot could not show either way) |
| Deterministic length gate + bounded revision | A short brief alone yields plot diversity across goals |
| Judge v2 criteria (language, causality, goal/arc, age, title, safety, diversity) | Judge v2 agrees with the owner after calibration on three texts |
| No new UI mode for independent readers | PDF capacity lever (pages vs. caps vs. template) |

## Consequences

- **ADR-0005 is partly superseded**, not withdrawn: §1's Plan phase, §2's register target, §3's exemplar few-shot and §4's `registerMatch` are replaced by decisions 1–3 and 5 here; §1's by-concern principle, §4's guardrail/craft split, §5 (no vocabulary-RAG) and §6 (model choice by measurement) stand.
- **The 2026-09-13 refactor plan** (`STORY_ENGINES`, `SUTEEV_STYLE` device catalogue, per-engine exemplars, eight phases; GitHub #404/#407) is no longer the implementation plan. Its corpus analysis stays a reference. Nothing from it is deleted; the #407 phase-1 work was not found in any checkout (spec §9).
- **Images and PDF are untouched** in contract; PDF *capacity* is a real, numbered conflict (spec §7) resolved by the owner on a rendered check, never by cutting text or shrinking type.
- **Cost** rises by one small split call per book; the tale call is comparable to today's Prose call. Images still dominate.
- **Rollback** is a flag flip (`TEXT_PIPELINE=plan|whole`); the Plan path is kept for one release after the switch.
- **Release prerequisite:** STO-6 (LangFuse in production) must be answered before the flag flips by default; it is not resolved by this ADR.

## Status

Proposed. Becomes Accepted when stage 1 of the spec's rollout (one owner-approved 5–6/virtue tale from the new pipeline) is done and its evidence is linked here.
