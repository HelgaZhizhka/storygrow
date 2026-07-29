# Session Handoff

This file is **empty when no session was interrupted**.

Fill it only if you have to stop mid-feature and want the next session to pick up where you left off.

When the feature is done, **clear this file back to the empty template** (everything below the line).

---

<!--
Template to fill when interrupting mid-feature. Compact handoff format —
favors durable artefacts over conversational context (the chat may be
compacted or lost; this file survives).

## Feature: <issue number and title>

**Branch:** <branch name>
**Objective:** <one-line goal — what this feature delivers>
**Status:** <what works, what's broken — be specific, no vibes>
**Key decisions:** <decisions made this session — and the reason for each>
**Assumptions:** <things you're treating as true but haven't verified — flag for next session>
**Rejected paths:** <approaches tried or considered and discarded — and why, so the next agent doesn't re-litigate>
**Blockers:** <what's stopping forward progress — or "none">
**Next steps:** <concrete next 1-3 actions, in order>
**Evidence:** <commit SHAs, test output snippet, LangFuse trace ID, screenshot path — what proves the status above>
**Frictions:** <1-3 things that slowed you down this session — feeds the CDD loop in progress.md>
-->

## Wayfinder: photo-upload character-likeness (no issue yet — stopped before the map existed)

**Branch:** main
**Objective:** User invoked `/wayfinder` with a loose idea — add photo upload so book illustrations look like the actual child, not just a text-described/invented likeness (current state: `characterProfile` text + a generated reference portrait, no real photo — see `docs/defense/qa-prep.md` Q8, which already flagged this as GDPR-blocked backlog: biometric data of a minor needs explicit parental consent + a data processor agreement).
**Status:** Tracker prep done, chartering barely started. No `wayfinder:map` issue exists yet — stopped mid-way through naming the **destination** (step 1 of "Chart the map"), before the user answered.
**Key decisions:**
- Established this repo's Wayfinding-operations convention in `docs/agents/issue-tracker.md` (merged, PR #328) — confirmed via `gh api .../sub_issues` and `.../dependencies/blocked_by` that this GitHub instance supports native sub-issues and native issue dependencies, so wayfinder uses those directly, no body-convention fallback.
- Created the 5 `wayfinder:*` labels (`map`, `research`, `prototype`, `grilling`, `task`) on the repo.
**Assumptions:** None yet — no domain decisions were reached.
**Rejected paths:** None yet.
**Blockers:** None technical — just needs the destination-naming conversation to resume.
**Next steps:**
1. Resume the grilling question already on the table: what does "reaching the end of this map" look like for this effort — a **spec** (my recommendation, given the real GDPR/consent uncertainty — the spec should carry the legal-requirements section as part of the answer, not defer it), a narrower **decision** ("do we do this, and how"), or the **shipped feature** itself (would require an explicit Notes override, since wayfinder defaults to planning-not-doing)?
2. Once the destination is named, continue "Chart the map" step 2 (breadth-first grilling to surface the frontier — likely touches: GDPR/consent flow, which image-consistency technique — Gemini reference-image vs. IP-Adapter/Flux vs. current portrait-anchor approach, storage/retention of uploaded photos, moderation of uploaded child photos, opt-out/deletion).
3. Create the `wayfinder:map` issue once destination + first-pass frontier are clear.
**Evidence:** PR #328 (merged), 5 labels visible via `gh label list --search wayfinder`.
**Frictions:** None — just an ordinary session-end interruption before the first decision landed.
