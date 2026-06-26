# ADR-0004: Safe-conflict boundary for generated stories

**Status:** Accepted
**Date:** 2026-06-09

## Context

StoryGrow generates educational stories for ages 5–6. While tuning text quality
we added an `engagement` judge criterion and a storytelling brief that asked the
model to "build a real little moment of tension at the climax." A live generation
for the goal *Смелость* (courage) then produced a story where the scary element
was a **wild bear**, and the resolution had the child approach and befriend it
("the bear was friendly — go play").

The story passed the judge's `safetyForChildren` criterion, because that
criterion only screened for **violence** — a friendly bear is not violent. But
the story modelled dangerous real-world behaviour: it would teach a 5-year-old
that the brave thing to do when meeting a bear (or a strange dog, or a stranger)
is to approach it.

Root cause: pushing for engagement made the model reach for *tension*, and the
cheapest source of tension is a real physical threat. Nothing in the prompt or
the rubric constrained **what kind of conflict** is acceptable.

## Decision

A generated story for this age band may use fear and tension, but the
**modelled action in the resolution must never approach or befriend a real-world
danger.** The boundary is about the action, not the scary element.

- **Allowed** — emotional / social / internal conflict: fear of the dark, trying
  something new, speaking up in a group, a friend is upset, making a mistake and
  fixing it, missing a parent.
- **Forbidden** — a real physical danger the hero approaches or befriends: wild
  animal, stranger, fire, water, heights, getting lost.
- **Test by the action:** "a dog as a known friend" is fine; "approach an unknown
  dog" is not. The animal is not the problem — the modelled behaviour is.

This boundary is enforced in **two places**:

1. **Generation prompt** — a hard constraint on the conflict type.
2. **Judge rubric** — the `safetyForChildren` criterion is widened to penalise
   heavily any story that could teach a child to approach a real danger.

Curated [Gold Exemplars](../../CONTEXT.md) remain the primary steer (they
demonstrate safe conflict by example); this boundary is the enforcement backstop.

## Clarification — Stakes vs Danger

Real stakes and real consequences are **required** for an engaging story — the
flaw-arc model (see `CONTEXT.md`) even mandates a "Расплата" (consequence) beat
where the flaw visibly backfires. What ADR-0004 forbids is **physical danger**,
not stakes. A consequence here is always EMOTIONAL or SOCIAL: losing a friend's
trust, a treasured thing broken, being left out of the game. That kind of
consequence is painful and age-appropriate — it is the engine of the lesson, not
a safety violation. "No physical danger" ≠ "no consequences".

## Consequences

- Engagement/tension may not come from physical peril — it must come from
  emotional or social stakes. This is a deliberate cap on one source of drama in
  exchange for child-safety.
- The `safetyForChildren` judge criterion's definition changes; thin or unsafe
  stories now score lower there and the regeneration loop pushes them out.
- "% passing on first attempt" may dip for goals like *courage* / *fear*, where
  the model's instinct is a physical threat. That is the loop doing its job.
- The boundary is a pedagogical product stance, captured as the `Safe Conflict`
  term in `CONTEXT.md`. If the target age range widens (e.g., 9–10), revisit —
  older children can handle real-world-danger themes with explicit "do not do
  this" framing.
