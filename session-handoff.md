# Session Handoff

This file is **empty when no session was interrupted**.

Fill it only if you have to stop mid-feature and want the next session to pick up where you left off.

When the feature is done, **clear this file back to the empty template** (everything below the line).

---

## Feature: Safe-conflict boundary v2 — phase 0b of the Suteev register refactor

**Branch:** `issue/safety-boundary-v2-research` (pushed to origin; commit `f669cfe`, clean tree)

**Objective:** Replace ADR-0004's blunt "no wild animals" rule with a researched boundary that tells a fairy-tale antagonist (talking Wolf outwitted) apart from imitable real-world danger (child approaches a strange dog). Research + drafts only — **no prompt code touched yet**, because the owner reviews every prompt before it lands.

**Status — DONE (research + draft), NOT applied:**
- `docs/process/2026-09-safety-boundary-research.md` (182 lines) — full research summary: 11 competitor products, platform/regulatory guidelines (BBFC/Ofcom/PBS/ACMA/436-ФЗ/Apple/Google/PEGI/CSM/COPPA), child-psychology evidence, and the Russian canon. Every claim carries a source URL.
- `docs/adr/0004-safe-conflict-boundary.md` — v1 kept intact; **"Amendment v2 (2026-09-13)"** appended (status Proposed). Contains: the four-question scene test, a 10-row «Допустимо / Недопустимо» table with a cited rationale per row, the **proposed** rewrite of `plan.prompt.ts` rule 7 and `judge.prompt.ts` criterion 4 (as text, not applied), 4 eval cases + 1 negative probe.
- `progress.md` — dated entry added.
- Result already delivered to the cloud session **"Анализ сказки Сутеева"** via SendMessage (full research text inline). That session cannot reply back here; its response lands in its own transcript on claude.ai/code.

**Key decisions (this is the boundary the next session must implement once the owner approves):**
- Risk axis = **imitable real-world act by the hero**, NOT the presence of a scary element. Unanimous across BBFC U, Ofcom 1.13, PBS, 436-ФЗ ст. 5 п. 2, and the fantasy-transfer literature (Richert & Smith 2011; Walker 2015).
- **Allowed:** a fairy-tale antagonist (talking, clothed, story-animal world) that threatens/chases/grabs and is outwitted / driven off / left with nothing; a verbal threat that is never executed; fear that resolves as harmless.
- **Kept from v1 (absolute for the named hero, any outcome):** approaching/petting/feeding/trusting an unknown REAL animal, going with a stranger, fire, water without an adult, heights, going off alone.
- **New in v2:** no blow by the hero (imitable even in a cartoon — Bandura 1963, CSM 2–4); no on-page harm / grotesque antagonist (Cantor); no realistic disaster (house fire, drowning — that is 6+ per 436-ФЗ ст. 8).
- **Age nuance:** at 3–4 the antagonist must be comic with loud fairy-tale markers (the fantasy quarantine is weaker than at 5–6).
- **Deliberately NOT enabled:** the canon's companion-pays-for-disobedience pattern («Цыплёнок и Утёнок»). Documented as a future relaxation, owner's call.

**Assumptions:**
- `runTextEval` already accepts `seeds?: StorySeeds`, so the proposed eval premises travel as `seeds.motifs` with no pipeline change — `EvalCase` just gains an optional `seeds` field. Verified `seeds` is threaded through `eval-run.ts` → `generateStory`; NOT verified that the plan actually honours a motif as the antagonist premise (needs a live run).

**Rejected paths:**
- Keeping v1's category-based list (wild animal / stranger / fire) — it names *things* not *acts*, which is exactly why it blocks the whole Suteev cast. v2 rewrites every ban as an act.
- Writing the ADR in Russian — v1 is English, repo convention is English root-docs; only the «Допустимо/Недопустимо» table cells are Russian (product-facing examples).

**Blockers:**
- **Owner review gate.** Nothing lands in prompt code until the owner approves the table and both prompt texts. This is the only thing between the draft and the implementation PR.

**Next steps (for the implementation PR, after owner approval):**
1. Apply the proposed rule 7 to `backend/src/ai/prompts/plan.prompt.ts` and criterion 4 to `backend/src/ai/prompts/judge.prompt.ts`; align the legacy line in `backend/src/ai/prompts/story-generator.prompt.ts:43` ("SOCIAL, never physical danger").
2. Rewrite `CONTEXT.md` → **Safe Conflict** term from the v2 table (docs-currency rule: same PR).
3. Add the optional `seeds` field to `EvalCase` in `backend/src/scripts/eval-batch.ts` and append the 4 antagonist cases + the negative probe to `DEFAULT_SET`.
4. Run `./init.sh`; then a real batch through `eval:batch` to confirm the plan keeps the antagonist AND `safetyForChildren ≥ 7` on the new cases (that is the regression proof).
5. Flip the ADR amendment status Proposed → Accepted.
6. **Spec fix:** `docs/superpowers/specs/...suteev-register-refactor-design.md` §8 "Риски" still says «Волк из „Мешка яблок" к нам не переезжает. Safety-критерий судьи не меняется.» — v2 contradicts this; update after owner sign-off.

**Evidence:**
- Commit `f669cfe` — `git show f669cfe --stat`: ADR-0004 +171, research doc +182, progress.md +17.
- Branch pushed: `origin/issue/safety-boundary-v2-research`.

**Frictions:**
- The four web-research subagents from the first session were reported as "failed" by a stale task-notification after a process restart, but they had in fact completed and their results were already committed — cost a verification pass to confirm nothing was lost.
