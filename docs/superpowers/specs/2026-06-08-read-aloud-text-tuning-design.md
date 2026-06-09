# Read-Aloud Story Quality — Design

**Date:** 2026-06-09 (revised after live testing + grilling session)
**Status:** In progress — strategy revised; implementation on branch `issue/160-read-aloud-tuning` (PR #161, **not merged**)
**Scope:** Custom (AI) flow story TEXT quality. No schema, no UI, no image changes.

## Problem

For ages 5–6 (read-aloud model) the generated text is too short, lexically flat,
and reads like captions to pictures rather than a story. Live testing also
surfaced a **safety regression**: pushing for engagement (tension) made the model
reach for a real physical danger (a wild bear the child approaches and befriends)
— see [ADR-0004](../../docs/adr/0004-safe-conflict-boundary.md).

Root insight: reactive prompt-tweaking does not converge. Each fix dents another
(engagement → safety, anti-repetition → length). Abstract rules do not compose;
the model imitates **examples** far better than it follows maxims.

## Strategy (resolved in the grilling session)

1. **Steer quality with Gold Exemplars (few-shot), not prose-rules.** 1 curated
   gold story injected into the generation prompt sets length, richness, tone,
   and safe conflict type by example. Rules stay only as a secondary backstop.
   See `Gold Exemplar` in [CONTEXT.md](../../CONTEXT.md).
2. **Exemplar provenance: draft → human approval.** A draft may be generated
   cheaply (text-only harness), but it becomes an exemplar only after the
   pedagogy expert approves it. Pure auto-generated, unreviewed stories are never
   exemplars. Start with **2–3** exemplars across different learning goals.
3. **Storage: static constants now, RAG later.** Exemplars live as TS constants
   in `backend/src/ai/prompts/`, selected by a simple goal→exemplar map. With
   only 2–3, retrieval is a lookup; pgvector RAG is over-engineering until the
   library grows to dozens.
4. **Safe-conflict boundary** ([ADR-0004](../../docs/adr/0004-safe-conflict-boundary.md)):
   the constraint is on the modelled **action**, not the scary element.
   Emotional/social/internal conflict is allowed; a real physical danger the hero
   approaches/befriends is forbidden. Enforced in BOTH the generation prompt and
   the judge's `safetyForChildren` criterion. Exemplars demonstrate it by example;
   this is the enforcement backstop.
5. **Text-only harness** (`pnpm --filter backend eval:text "<goal>" <age> [mode]`):
   runs VocabularyRag → StoryGenerator → StoryEvaluator only (no images, no PDF,
   no DB writes). Cents per run. This is the iteration loop AND the exemplar-draft
   generator.
6. **Eval enforces it.** The judge `engagement` criterion pushes thin stories to
   regenerate; the widened `safetyForChildren` criterion pushes unsafe ones out.

## Changes already made (on branch, NOT merged)

- Page text limit `image-top`/`image-bottom` 120 → 220 (`page-templates.config.ts`).
- `DEFAULT_TOP_K` 80 → 150 (wider vocabulary retrieval).
- Prompt vocabulary reframed: "use ONLY" → "prefer; you may also use simple
  spoken-comprehension words."
- Vocabulary compliance decoupled from the hard pass-gate → soft signal (kept in
  `StoryEval` + regeneration feedback).
- Judge `engagement` criterion added (`JudgeSchema` now 6 criteria) + storytelling
  brief in the generation prompt.
- Moral-repetition fix (lesson shown on content pages, stated once on `final`).
- Text-only eval harness (`backend/src/scripts/eval-text.ts`).

These verified live: length up (≈120→150), richer prose (dialogue, sensory
detail, show-don't-tell), regeneration loop engaging on `engagement`. But text is
still on the short side, and **safe-conflict is not yet enforced** — so the branch
can still produce unsafe stories.

## What's left (to finish before merge)

1. **Enforce safe-conflict** (ADR-0004) in the generation prompt (hard constraint
   on conflict type) and widen the judge `safetyForChildren` criterion to penalise
   modelling approach to real danger.
2. **Build 2–3 Gold Exemplars**: draft via the harness → expert approval → wire as
   static few-shot constants with a goal→exemplar map.
3. **Re-verify via the harness** (cheap) across the exemplar goals; confirm richer,
   safe, age-appropriate text before any image spend.

## Disposition of PR #161

Do **not** merge yet (can produce unsafe stories) and do **not** revert (nothing
is wrong, only incomplete). Finish the two items above on the same branch, verify
with the harness, then merge one coherent "read-aloud story quality" PR.

## Out of scope

- Photo / vision agent, reference-image models (separate, deferred).
- RAG retrieval of exemplars (only once the exemplar library is large).
- Fine-tuning (overkill for a course MVP).
- Audio narration / TTS — separate roadmap issue (#159).
- Age-adaptive lengths for 5 vs 6 (keep one band for now).

## Defense / metric note

Decoupling vocabulary from the hard gate and widening the safety/engagement
criteria changes "% passing on first attempt": vocabulary stops hard-failing
books, while engagement and safety push more regenerations. Net narrative is
stronger — vocabulary compliance becomes a tracked quality signal in a
multi-signal eval, and the regeneration loop visibly improves both richness and
safety. Language purity (Russian-only) remains a hard gate.
