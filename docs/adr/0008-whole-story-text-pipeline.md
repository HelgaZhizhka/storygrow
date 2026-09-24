---
status: Proposed
date: 2026-09-23
revised: 2026-09-24
---

# ADR 0008 — Whole-story text pipeline

**Ticket:** [STO-14](https://linear.app/storygrow/issue/STO-14) · **Spec:** [2026-09-23 whole-story text design](../superpowers/specs/2026-09-23-whole-story-text-design.md) · **Relates to:** [ADR-0005](0005-decomposed-generation-pipeline.md) (decomposed pipeline, partly superseded here), [ADR-0004](0004-safe-conflict-boundary.md) (safe conflict, unchanged), [ADR-0007](0007-visual-continuity.md) (images, unchanged)

## Context

ADR-0005 decomposed generation into Plan → Prose → (Edit) → Judge so that one call would no longer carry structure, safety and voice at once. It delivered the structure, but the prose it produces is page-shaped: the author renders per-page intents into ~220-character slots and never holds a tale it is free to shape. The 2026-09-18 whole-story pilot (branch `issue/387-whole-story-pilot`, `91253c0`) showed a single call can carry causality, dialogue and consequences in one text — and also that it overshoots length (6/6), reuses a plot skeleton per goal, and slips into decorative similes. The owner rejected all six pilot texts and, on 2026-09-23, approved a direction rather than a further round of prompt patching.

Two of ADR-0005's own premises have since failed in production: exemplar-as-few-shot copied plots instead of craft (#311/#313, ADR-0005 amendment 2026-07-25), and the exemplars the judge is calibrated on were never accepted by the owner as gold.

## Decision

**1. The text is written first, as one whole tale; pages come after it.** Order: goal brief → whole tale → text checks → page split + Visual Bible → book check → images → PDF. The author is given **no layout constraint** — no page or character limits in its prompt. The split chooses boundaries only at paragraph and sentence ends of the final text and never re-emits it; code extracts every page's fragment verbatim and asserts contiguity, coverage, order and exact reconstruction of the whole text. A fragment that cannot fit any page fails the split explicitly — it is never cut, re-flowed or shrunk. Today's page templates, character caps and page counts are **not requirements of the new path**: the layout is chosen on rendered samples of an accepted text (spec §7, stage 1b) and may differ per age band under one style. The Plan phase and its `StoryPlan` schema are retired as the primary artefact; page layout, scenes and the bible are derived from the finished text.

**2. One universal style; Suteev is a reference for clarity, not a voice to imitate.** No style catalogue, switch or device quota. The register description in ADR-0005 §2 ("rich, warm, musical Сутеев voice") and the `registerMatch` two-sided craft score are retired with it.

**3. Gold texts are evaluation material, not the author's few-shot.** Three owner-approved texts (one per supported combination) calibrate the judge and anchor reading tests. Showing a full example to the author is a testable variant, off by default. `exemplars.ts` as a Prose few-shot is superseded.

**4. Length, language and text preservation are deterministic gates.** Word range per band, Russian-only text, layout feasibility of the finished text, split legality and exact reconstruction are checked in code; a length miss gets a targeted revision inside the existing retry budget; an unplaceable sentence is first a layout question (decision 1), and the targeted edit is only a rare fallback for an outlier. A revision is a **new text version**: the earlier one is kept, every text check runs again on the new one, and the pages are reconstructed against it. Word ranges are never narrowed to fit templates. This gives ADR-0005's optional Edit pass its concrete job. The concrete revision policy is a proposal (spec §6), not a product rule.

**5. Safety is a separate, blocking verdict; the judge's craft criteria are informational until they prove themselves on new results.** The finished tale receives a binary `pass | fail` safety verdict with reasons, evaluated as a gate against the ADR-0004 boundary; an error or undetermined verdict **fails closed**. No craft score accepts or rejects a book until the judge's agreement with the owner has been re-measured on the portability matrix (spec §8, stage 3) — agreement on the gold and pilot texts alone is not evidence of portability. Every attempt still writes a `StoryEval` row and a LangFuse trace (hard constraints 9–10 unchanged). The custom-goal safety gate (input) is kept and is not a substitute for the story gate (output).

**6. One source of text.** The accepted whole tale is stored immutably as the audit source; page texts are derived from it and must reconstruct it exactly. There are never two independently editable copies.

**7. Release requires the portability check.** The new path is not released before the owner has read the stage-3 matrix (nine unedited results across all three combinations, custom goals and a repeat) and real books exist for each combination. Technical integration earlier is readiness to test, not readiness to ship.

**8. Kept from ADR-0005, unchanged.** Decomposition by concern rather than by page (the split is still one whole-story call); guardrails as pass/fail gates separate from craft; vocabulary-RAG stays out of generation; the safe-conflict boundary lives upstream of the prose (now in the brief and the gate, per ADR-0004 v2 wording once applied); the `Story` contract that images and PDF consume.

**9. Supported combinations are unchanged:** 3–4/virtue, 5–6/virtue, 5–6/flaw. No 3–4/flaw.

## What is approved vs. what is a hypothesis or a proposal

| Approved by the owner (2026-09-23) | Hypothesis or proposal — must be tested or may change at implementation |
| --- | --- |
| Whole tale first, pages after; text preserved on split; never cut or shrunk | Word ranges 150–250 (3–4) and 350–550 (5–6) [hypothesis] |
| One universal style; two arcs; three launch combinations | gpt-5 as the author model [hypothesis] |
| Gold texts as evaluation material by default | The premise stage is useless (the pilot could not show either way) [hypothesis] |
| Length is gated; safety blocks; an uncalibrated judge never accepts a book | Targeted-revision policy, participants/events guidance, flaw cast ≥ 2, sentence feasibility bound [proposal] |
| Judge v2 criteria (language, causality, goal/arc, age, title, diversity) | Shape of the safety contract (own call vs. sub-object), `wholeText` / `parentNote` fields, flag name [proposal] |
| No new UI mode for independent readers | Layout: more text area vs. more pages, possibly per band — on rendered samples (stage 1b) |

## Consequences

- **ADR-0005 is partly superseded**, not withdrawn: §1's Plan phase, §2's register target, §3's exemplar few-shot and §4's `registerMatch` are replaced by decisions 1–3 and 5 here; §1's by-concern principle, §4's guardrail/craft split, §5 (no vocabulary-RAG) and §6 (model choice by measurement) stand.
- **The orchestrator loop changes**, not just the prompts: it owns the attempt budget, chooses between a targeted revision and a fresh tale, drives the single re-split, and writes one `StoryEval` row per attempt when the attempt ends. The `StoryEval` columns stay; the JSON grows.
- **The 2026-09-13 refactor plan** (`STORY_ENGINES`, `SUTEEV_STYLE` device catalogue, per-engine exemplars, eight phases; GitHub #404/#407) is no longer the implementation plan. Its corpus analysis stays a reference. Nothing from it is deleted; the #407 phase-1 work was not found in any checkout (spec §9).
- **The image contract is untouched; the PDF templates are not.** HTML/CSS templates, per-band caps, `suitableFor` and page counts are expected to change; `pdf-render.service.ts` stays only if the layout comparison confirms compatibility. Capacity (spec §7, estimates) is resolved by the owner on rendered samples with readable type — never by cutting text, shrinking type or narrowing word ranges. Rendering the parent note, if chosen, changes the `final` template — a later decision.
- **Cost** rises by one small split call per book, plus one for the safety gate if it is a separate call; the tale call is comparable to today's Prose call. Images still dominate.
- **Rollback** is a flag flip (`TEXT_PIPELINE=plan|whole`); the Plan path — prompts, schemas and their dependencies — is kept intact for one release after the switch, and its removal is a separate step after that window, never part of the release itself.
- **Release prerequisites:** the stage-3 portability check (decision 7) and STO-6 (LangFuse in production) — neither is resolved by this ADR.

## Status

Proposed. Becomes Accepted when stage 1 of the spec's rollout (one owner-approved 5–6/virtue tale from the new pipeline) is done and its evidence is linked here.
