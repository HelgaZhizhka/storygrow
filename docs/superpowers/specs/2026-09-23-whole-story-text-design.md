# Whole-story text pipeline — design

**Status:** Proposal for review (STO-14, review round 2). Documentation only — no generator code, no paid runs, no production change.
**Date:** 2026-09-23 (revised 2026-09-24 after local Codex review)
**Ticket:** [STO-14](https://linear.app/storygrow/issue/STO-14) · **ADR:** [ADR-0008](../../adr/0008-whole-story-text-pipeline.md) (supersedes parts of [ADR-0005](../../adr/0005-decomposed-generation-pipeline.md))
**Supersedes as an implementation plan:** [2026-09-13 Suteev register refactor](2026-09-13-suteev-register-refactor-design.md) — its corpus analysis (§1–3) remains a reference; its 8-phase plan (§5) is no longer the plan.

> Three markers are used. **[approved]** — owner-approved direction (discussion with Codex, 2026-09-23). **[hypothesis]** — a literary or age assumption a reading test must confirm. **[proposal]** — a technical mechanism this document proposes; not separately approved by the owner, open to change at implementation.

---

## 1. Goal

Generate one Russian children's tale as a **single whole text** from `learning goal + age band + arc`, check it, and only then split it into pages, derive the Visual Bible, and hand it to the existing image and PDF stages. The tale must be clear, causal, concrete and alive; its learning goal must matter to what happens; different goals must produce visibly different stories.

**Why now.** The owner rejected all six texts of the 2026-09-18 pilot (see §9): artificial similes and titles («Солнышко из ошибки», «Алиса и подсолнуховый микрофон»), a shared plot skeleton across goals, and 847–930 words against a 500–800 request. The current Plan → Prose pipeline (ADR-0005) produces page-shaped prose from page-shaped intents; the whole-story pipeline lets the author hold one story in one context and lets pages follow the story instead of the other way round.

## 2. Scope and non-goals

**In scope (this document).** Target process and stage contracts; age/arc rules; text checks, the safety gate and refusal handling; the change map against `main` `9b6ff57`; rollout stages; risks; open questions.

**Approved frames [approved].**

1. One universal literary style for launch: clear natural Russian, concrete events, causality, live dialogue, understandable humour, an earned ending. Suteev is a reference for *clarity*, not an author to imitate. No style catalogue, no style switch, no device quotas.
2. The learning goal is material to actions and consequences. Two arcs stay: **virtue** (the quality shown through action) and **flaw** (an undesirable act → understandable consequence → repair; no humiliation, no "bad child" label). An arc is not a fixed step-by-step plot. A definition of the virtue in the finale does not replace a resolution.
3. Supported combinations at launch: **3–4/virtue, 5–6/virtue, 5–6/flaw**. No 3–4/flaw. Verified against code: `books.service.ts` excludes flaw goals for the 3–4 band and forces custom goals to `virtue` there; `BEAT_SHEETS['3-4']` has no `flaw` entry and `getBeatSheet` throws on it; ADR-0005 amendment 2026-06-27 states the same.
4. Working ranges **[hypothesis]**: 150–250 words for 3–4, 350–550 for 5–6. Age adaptation also covers the number of participants and events, syntax, and the complexity of causal links. Some 5–6 children read on their own; this is noted for the register, not turned into a UI mode.
5. Gold corpus: first **three** owner-approved texts, one per supported combination — not one per goal. Gold texts may be edited; the original and the edit are both kept. Unedited generations are checked separately. By default gold texts are **evaluation material**; giving the author a full example is a testable decision, not the default, because of plot copying (#311/#313).
6. Catalogue and custom goals go through the same short **goal brief** (wanted behaviour + arc meaning). The existing custom-goal safety gate stays. Vague or inadmissible goals and model refusals get explicit handling, not a new subsystem.
7. Target order: goal + age + arc → **whole tale** → **text checks** → **pages + Visual Bible** → existing images → PDF. A short preliminary premise is **not** declared useful and is **not** a mandatory stage.
8. Splitting preserves the text, the order of events and the cast. The child's appearance from photo/description is preserved. PDF capacity is verified; text is never silently cut and fonts are never shrunk to discomfort. The moral / parent material is separated from the tale's own ending.

**Non-goals.** Implementing the generator; paid generations; changing production; a style catalogue or switch; a premise stage; a 3–4/flaw arc; a new UI mode; a memory of the child's previous books (a later hypothesis, §10); resolving [STO-6](https://linear.app/storygrow/issue/STO-6) (LangFuse in production) — a release prerequisite tracked on its own; pulling [STO-7](https://linear.app/storygrow/issue/STO-7) out of Backlog — it is the natural implementation of stage 4 below and is referenced, not scheduled.

## 3. Current process (as built, `main` 9b6ff57)

`GenerationProcessor` → `StoryOrchestratorService.generate` runs up to `EVAL_MAX_RETRIES + 1 = 3` attempts of:

| Stage | Call | Model | Output |
| --- | --- | --- | --- |
| Plan | `story-generator.service.ts#generatePlan` · `plan.prompt.ts` | `PLAN_MODEL` gpt-4o | `StoryPlan`: hero, `characterProfile`, lesson, 5 questions, **Visual Bible**, `pages[]` with template + arc beat + Russian intent + scene. Page count `PAGE_COUNT_BY_BAND` (3–4: 6–8, 5–6: 6–12). Beat sheet from `story-generator.prompt.ts`; one Gold Exemplar as craft reference; template catalogue with per-band char caps. |
| Hero look | `resolveHeroAppearance` (+ `character-profile.prompt.ts` in child mode with a description) | gpt-4o-mini | Structured `Appearance` written back into the bible (#376). Photo mode overrides again at image time. |
| Prose | `generateProse` · `prose.prompt.ts` | `PROSE_MODEL` gpt-5 | `ProseOutput`: exactly `plan.pages.length` pages, each `text` ≤ template cap, `illustrationPrompt` (English action), cover title; the exemplar is shown again as the voice target. |
| Merge | `mergeVisualBible` | code | Persisted `Story` = prose + bible + per-page scene + `characterProfile`. |
| Title | `deriveTitle` · `title.prompt.ts` · `isConcreteTitle` | gpt-4o | Concrete title from the finished text, ≤ 3 attempts. |
| Checks | `story-evaluator.service.ts` | gpt-4o-mini judge | `validateBookPlan` (cover/final, per-page caps, age templates, scenes present), language purity, soft vocabulary compliance, judge with 6 guardrails (floor 6, `safetyForChildren` among them as a 0–10 score) + `registerMatch` craft (≥ `EVAL_THRESHOLD` 7) + informational `pictureConsistency`. One `StoryEval` row per attempt; failure feedback goes into the next Plan. |

The loop receives an already assembled `Story` from `generateStory`, checks pages and scenes, and writes the row — there is no text-level check before pages exist. Then images (`ImageGeneratorService`: portrait → reference sheets → pages from `buildIllustrationPrompt(bible, scene, action)` → image judge) and PDF (`PdfRenderService`, six templates, A5; no truncation logic — an over-cap page is rejected upstream, never cut). Eval harness: `eval:text`, `eval:batch --set=core|full|antagonist`, `eval:metrics`, `scripts/lib/prose-metrics.ts`. Goals: 20 seeded (14 virtue, 6 flaw) + per-user custom goals with an LLM safety gate on the *goal text* (`learning-goal-safety.service.ts`) — that gate screens input, not the finished story. Exemplars: 9 (`exemplars.ts`), used both as the Prose few-shot and as the judge's register references.

**What the current shape makes hard.** The author never sees a whole story it is free to shape — it renders intents into page-sized slots (~220 chars for 5–6), so pages read as beats, not as a tale. Structure, safe conflict, bible and page layout are all decided before a word exists. The judge's craft signal is calibrated on exemplars the owner has not accepted as gold.

## 4. Target process

```
Input: goal (catalogue or custom) · child age → age band · arc · protagonist mode ·
       hero identity (name, gender, appearance / photo Appearance) · seeds
  1. Goal brief        code for catalogue goals; one small LLM call for custom goals
  2. Whole tale        one generateObject call → WholeStory { title, paragraphs[] }
                       natural paragraphs; NO layout constraint in the authoring prompt
  3. Text checks       deterministic gates → blocking SAFETY gate → informational judge v2
                       fail → targeted revision or fresh tale (§6), within the budget
  4. Pages + bible     one call over the FINAL text → boundaries, actions, bible, scenes,
                       questions, parent note; fragments extracted verbatim by code
  4b. Book check       structural validation of the assembled Story (caps, cover/final,
                       reconstruction of the whole text); fail → one re-split, then fail
  5. Title             existing post-text derivation + isConcreteTitle gate
     → one StoryEval row per attempt, written when the attempt ends (§6)
  6. Images            unchanged (Story contract preserved)
  7. PDF               unchanged renderer; capacity verified, never truncated
```

### Stage contracts

**1. Goal brief** — `StoryBrief { goalTitle, wantedBehaviour, arcMeaning, ageBand, arc }`. For catalogue goals it is assembled in code from `LearningGoal.title/description/arcType` and a per-arc meaning sentence (virtue: the quality shown through the hero's own action; flaw: the act, a consequence the listener can picture, a repair the hero works for). For custom goals the existing safety gate runs first (fail closed, as today); a safe but unwritable goal (`usable: false`) is refused with a parent-facing Russian reason and no book is created, mirroring the custom-goal spec's error handling [proposal]. The brief is short by design — no premise, no beats.

**2. Whole tale** — `WholeStory { title: string; paragraphs: string[] }`. Input: the brief, the age-band profile (word range, participants/events guidance, sentence guidance — §5), hero identity, seeds, protagonist mode, the safe-conflict boundary (ADR-0004 v2 wording once applied). The author writes **natural paragraphs**; the prompt carries **no page or character limits** — layout is stage 4's problem, not the author's. No exemplar text by default [approved]. Model: gpt-5 as in the pilot [hypothesis — start there, compare only if stage 3 gives a reason]. Every call is `generateObject` + Zod with `experimental_telemetry` (hard constraints 9–10).

**3. Text checks** — see §6.

**4. Pages + Visual Bible** — `PageSplit { pages: [{ boundary, template, action, scene }], visualBible, discussionQuestions, parentNote }`. The model never re-emits the text. It chooses **boundaries at allowed positions only** — paragraph ends and sentence ends of the final text — and code extracts each page's fragment **verbatim** from `wholeText` by explicit delimiter rules recorded in the implementation (paragraph separator, sentence-end rule). The exact boundary encoding (indices, offsets, anchors) is an implementation choice [proposal]; the invariants are not: fragments are **contiguous, cover the whole text, keep its order**, and their concatenation under the declared joiner **reconstructs `wholeText` exactly**. A fragment longer than the band's largest page cap cannot be placed without a layout change: the split **fails explicitly** — it is never cut, re-flowed or shrunk, and "more pages" does not help a single over-long fragment; the orchestrator then applies one targeted revision to the text (§6) or the attempt fails. The bible is extracted from the final text: every cast name must occur in the text; hero appearance is set in code exactly as today (`resolveHeroAppearance`, photo `Appearance` override at image time). `normalizeVisualBible` runs unchanged. Discussion questions and the **parent note** (the moral, stated for the adult) are derived here from the final text, so the tale's ending stays a scene. This stage is the shape of STO-7's "post-Prose illustrator brief".

**4b. Book check** — the existing `validateBookPlan` (cover/final, per-page caps for the band, age templates, scenes present) plus the reconstruction assertion above, run on the assembled `Story`. A failure triggers **one** re-split of the same text; a second failure fails the attempt.

**5. Title** — the author may propose one inside `WholeStory`; `isConcreteTitle` gates it and `deriveTitle` regenerates from the text as today.

**Persisted contract [proposal].** `Story` keeps its shape (`title`, `pages[].text/title/illustrationPrompt/scene`, `visualBible`, `characterProfile`, `discussionQuestions`) so the image stage, PDF, admin and the reader UI are untouched. Two optional fields are added. `wholeText` is the **immutable source** of the accepted tale, kept for audit and re-splitting; `pages[].text` is **derived** from it and the reconstruction check ties the two together — there are not two editable truths, and an edit (if ever) goes to `wholeText` followed by a re-split. `parentNote` is a **storage** contract only: nothing renders it until the owner decides its place with the layout (§11); until then "PDF/UI unchanged" holds, and rendering it will change the `final` template. `StoryEval` keeps its columns; `judgeScores` (JSON) carries the v2 scores, the safety verdict and the gate results — no migration.

## 5. Age bands and arcs

| | 3–4 / virtue | 5–6 / virtue | 5–6 / flaw |
| --- | --- | --- | --- |
| Words [hypothesis] | 150–250 | 350–550 | 350–550 |
| Participants / events [proposal — guidance, not a gate] | hero + 1–2, one problem, one solution | hero + 2–3, one problem with 2–3 attempts or turns | hero + 2–3; act → consequence → repair |
| Syntax | short simple sentences, repetition welcome | mixed, dialogue-led | mixed, dialogue-led |
| Arc | quality shown once, then shown again | quality shown through action, earned ending | consequence the listener can picture, repair by effort, no shaming |

Corpus check: the 2026-09-13 analysis measured Suteev's shortest tier at **90–150 words** and the middle tier at 280–500. Those are what one author wrote, not an age norm; the 3–4 range above stays the owner's working hypothesis until the first 3–4 reading. The **independent-reader note** for 5–6 changes nothing in the pipeline: it argues for clear syntax and unambiguous dialogue attribution, which the universal style already demands.

## 6. Checks, safety gate, judge, refusals

**Deterministic gates (code, before any model-based check).** Word count inside the band range (one counting rule, the pilot's — no standalone dashes — recorded in code); Russian-only text (existing `checkLanguagePurity`); title gate (`isConcreteTitle`); **layout feasibility** — the longest sentence must fit the band's largest page cap, checked here so an unplaceable sentence is caught before a paid split call [proposal; a check on the finished text, not an authoring instruction]; for flaw arcs at least one character besides the hero [proposal].

**Safety gate (blocking) [contract: proposal; that safety blocks: approved].** The finished tale gets a **separate, binary safety verdict** — `StorySafety { verdict: 'pass' | 'fail'; reasons: string[] }` with its own Zod schema. Whether it is its own `generateObject` call or a required sub-object of the judge v2 output is an implementation choice; what is fixed is that it is read as a **gate, not a score**, and is kept apart from every informational criterion. Boundary: ADR-0004 (v2 wording once applied) — the *modelled action* in the resolution, not the presence of a scary element. `fail` → the attempt is rejected, its `StoryEval` row is written with `passed = false` and the reasons, and the next attempt's feedback names the violated boundary. **Error, timeout or an unparsable verdict → fail closed**: the attempt is rejected exactly as a `fail`, matching the custom-goal gate's policy; no book proceeds on an undetermined verdict. `pass` + all deterministic gates → the tale proceeds to the split even though craft is informational. This replaces today's `safetyForChildren` 0–10 score with a floor of 6, which cannot be told apart from the other guardrails. The custom-goal safety gate (input text) stays and does **not** substitute for this one (output).

**Judge v2 (LLM, informational until calibrated).** Criteria [approved]: language (clean, natural Russian), causality, goal/arc (the goal drives actions and consequences; flaw arc has consequence + repair), age fit, title, and plot diversity against the other results of the same run. Scores are stored in `StoryEval.judgeScores`. **Rule:** a high score from an uncalibrated judge is never sufficient; until stage 3 (§8) shows the judge agrees with the owner on *new* results, no craft criterion blocks a book. Calibration on the three gold texts and the six rejected pilot texts (stage 2) is a sanity check, not proof of portability. `registerMatch` is retired with the exemplar-as-target model (ADR-0008).

**Revision policy (bounded) [proposal].** `EVAL_MAX_RETRIES` stays the single budget, owned by the orchestrator. A length miss or an unplaceable sentence triggers a **targeted revision** of the same tale ("shorten to N–M words / split this sentence; keep the events, the characters and the consequences; cut description and repetition" — dialogue may be trimmed; nothing here is a product rule); a safety `fail`, a language failure or a judge-flagged causality failure triggers a **fresh tale** with feedback. A failed book check (4b) triggers one re-split, not a new attempt. Every attempt writes exactly one `StoryEval` row when it ends (hard constraint 10); rows are never overwritten (no silent regeneration).

**Refusals and errors.** Custom goal unsafe → existing gate, no book. Goal safe but unwritable → `usable: false` + reason, no book. Model refusal or API error in stages 2/4 → attempt consumed, trace kept, `StoryGenerationFailedError` → `failed` status as today; no hidden retries beyond the budget.

**Text-only dry run.** The eval harness runs stages 1–3 (and optionally 4) with `bookId: dry-run`: no Book, no `StoryEval` row, traces on — exactly the caveat `eval:text` carries today. Dry-run results never count as integration evidence.

## 7. Change map (real files, `main` 9b6ff57)

| Area | File | Change |
| --- | --- | --- |
| Orchestration | `backend/src/ai/story-generator/story-generator.service.ts` | Replace Plan → Prose with Brief → Tale; add Split + assembly; keep `resolveHeroAppearance`, `deriveTitle`, `applyTitle`. |
| | `.../story-orchestrator.service.ts` | **Loop rewritten**: owns the attempt budget, chooses targeted revision vs. fresh tale, drives the single re-split; `writeEval` keeps the columns, `judgeScores` JSON grows (v2 scores, safety verdict, gate results). |
| | `.../story-evaluator.service.ts` | Split into text checks (gates + safety gate + judge v2, before pages exist) and the book check (`validateBookPlan` + reconstruction, after assembly). |
| Prompts | `backend/src/ai/prompts/plan.prompt.ts`, `prose.prompt.ts`, `story-generator.prompt.ts` (beat sheets) | Retired behind the flag; deleted in the release stage. Beat sheets become the per-arc **meaning** sentences of the brief. |
| | new `story-brief.prompt.ts`, `whole-story.prompt.ts`, `page-split.prompt.ts`, `story-safety.prompt.ts` | Stages 1 (custom goals only), 2, 4, and the safety gate. |
| | `judge.prompt.ts` | v2 criteria; references = the gold corpus, not `exemplars.ts`; safety removed from the score list. |
| | `exemplars.ts` | No longer fed to the author; replaced as judge references by new `gold-corpus.ts` (original + edited versions, per combination). |
| | `title.prompt.ts`, `learning-goal-safety.prompt.ts` | Unchanged. |
| Schemas | `backend/src/ai/schemas/story-plan.schema.ts` | Retired with the Plan. |
| | new `whole-story.schema.ts`, `page-split.schema.ts`, `story-brief.schema.ts`, `story-safety.schema.ts` | Stage contracts (§4, §6). |
| | `story.schema.ts` | Optional `wholeText` (immutable source), `parentNote` (storage only); `buildProseSchema` retired. |
| | `judge.schema.ts` | v2 criteria; `safetyForChildren` leaves the score object; `computeFinalScore` redefined (§6). |
| | `visual-bible.schema.ts` | Unchanged. |
| Validators | new `text-preservation.validator.ts` | Boundary legality, contiguity, coverage, order, exact reconstruction, per-page cap, cast names present. |
| | `book-plan.validator.ts`, `visual-bible.normalizer.ts` | Unchanged; called from the book check. |
| Config | `backend/src/ai/ai.config.ts` | `WORD_RANGE_BY_BAND`, `AUTHOR_MODEL`, `TEXT_PIPELINE` flag; revisit `PAGE_COUNT_BY_BAND`. |
| PDF | `backend/src/pdf/page-templates/page-templates.config.ts`, `final.html` (only if the parent note is rendered there) | **Capacity** (below) — owner decision after rendered samples. Renderer unchanged. |
| Queue / books | `generation.processor.ts`, `books.service.ts`, billing, photo, S3 | Unchanged. |
| Eval | `scripts/eval-text.ts`, `eval-batch.ts`, `lib/eval-run.ts`, `lib/eval-cases.ts`, `lib/prose-metrics.ts` | Whole-story path, word count, run-level diversity; a corrected `eval:whole-story` derived from the pilot script on branch `issue/387-whole-story-pilot` (`91253c0`). |
| Docs | `CONTEXT.md` (Story Plan → retired; Story Brief, Whole Story, Page Split, Story Safety, Parent Note), `docs/ARCHITECTURE.md` diagram | At implementation time. |

**PDF capacity — a real conflict; the numbers are estimates.** 5–6 text pages cap at 220 chars (`image-top/bottom`), the final page at 200, and a book has at most 12 pages, so the ceiling is ~2 400 chars ≈ **340–370 words** at ~6.5 chars/word — the *bottom* of the 350–550 range, reachable only at the maximum page count; 450 words needs ~14–15 text pages at today's caps. For 3–4 (110/90 chars, 6–8 pages) the ceiling is ~750 chars ≈ **100–115 words** against a 150–250 target. Levers: more pages per band, larger caps at the same type size, a text-heavier 5–6 template (`text-focus` is 350 chars but `suitableFor` 7–8 only), or narrower ranges. Chars-per-word is approximate and a larger cap does not prove physical fit: the decision is taken on **rendered samples with readable type, after an accepted text exists** (stage 1 is not blocked by it). Until then the book check refuses a split that does not fit.

## 8. Rollout stages (inside this document; tickets only after review)

| # | Stage | Exit criterion | Depends on |
| --- | --- | --- | --- |
| 1 | **First tale 5–6/virtue.** Brief + whole-tale prompt + deterministic gates + safety gate in a text-only harness (dry run, §6), traces on. Owner reads unedited results; iterate on the prompt, not on the text. | One owner-approved text (original + edits kept). | — |
| 2 | **Remaining gold.** 5–6/flaw, then 3–4/virtue. Judge v2 run on the three gold texts + the six rejected pilot texts as negatives — a sanity check of direction, not a portability claim. | Three gold texts; agreement recorded. | 1 |
| 3 | **New goals and repeats — release gate.** Portability matrix: 9 unedited results, 3 per combination, including ≥ 2 custom goals and one goal repeated for the same child; matrix and criteria fixed before the run. Judge v2 agreement re-measured on these nine. | Read by the owner; diversity, language and judge-agreement findings written down and addressed. Not a statistical proof, but **a precondition for release**. | 2 |
| 4 | **Integration (technical readiness, not release readiness).** Split + book check + bible + title behind `TEXT_PIPELINE=whole`; real API run → Book, StoryEval, own trace, images, PDF viewed. | One real book end-to-end, evidence attached. | 1 (scaffold), 2 (merge) |
| 5 | **Real books — all three combinations.** Owner generates books in the app for 3–4/virtue, 5–6/virtue and 5–6/flaw; capacity decision applied; split fidelity, image continuity and PDF checked on real output. | Findings for each combination; no silent cuts. | 3, 4 |
| 6 | **Release with rollback.** Flag default → `whole`; the Plan path stays one release; rollback = flip the flag. | Released; old path removed next. | 3, 5, STO-6 |

**Evidence rules for every stage.** Keep all attempts, prompt versions, model id, usage, latency, retry reasons and LangFuse trace ids (the pilot's `manifest.json` is the template). Before any PR with AI code: a live `eval:text` equivalent + trace. Before any "integrated" claim: a real API run with Book/StoryEval, its own trace, images and a viewed PDF (AGENTS.md "Done is not a mood").

## 9. Evidence we have, and what is missing

**Pilot 2026-09-18** (branch `issue/387-whole-story-pilot`, commit `91253c0`; not in `main`): 9 gpt-5 calls, 6 tales × (A: direct, B: premise first), synthetic hero, $0.38, all traces verified. Findings that inform this design: all six 847–930 words against 500–800 (length must be a gate); a shared skeleton per goal despite different words (diversity must be checked, not assumed); decorative similes, adult jokes and language slips («коснулся Алисиної щеки», «Ска» for «Скок»); the A/B is invalid because the premise prompt also asked for a full tale — which is why the premise stage is not adopted. Owner verdict: none of the six is gold.

**Missing sources (not invented).** `docs/process/2026-09-18-text-generation-research.md` and its evidence JSON — not in `main`, the pilot commit, stashes, dangling commits or history. The uncommitted #407 phase-1 work (`register.ts`) — not found in any checkout; treated as non-existent unless the owner has it elsewhere.

## 10. Risks

- **Length.** Free requests do not control length (6/6 overshoot). Mitigation: word-count gate + targeted shortening revision inside one bounded budget.
- **Split fidelity.** Mitigated by construction (verbatim extraction at allowed boundaries, reconstruction assertion); residual risk is a single sentence longer than any page → caught by the feasibility gate, fixed by a targeted revision, never by cutting.
- **Sameness across goals.** The brief is short on purpose; diversity is measured in stage 3 and at run level; a memory of the child's previous books is a later hypothesis, not part of launch.
- **Uncalibrated judge.** Only safety and deterministic gates block until stage 3 shows agreement on new results; craft is read by a human.
- **Safety verdict quality.** A binary LLM verdict can be wrong both ways; fail-closed handling covers errors, not false passes — the owner's reading in stages 1–3 and 5 is the second check.
- **Capacity.** §7 numbers are estimates; decided on rendered samples, never by shrinking type or cutting text.
- **Custom goals.** A bad brief makes a bad tale; the safety gate and `usable: false` refusal keep it explicit.
- **Cost.** ~$0.04–0.05 per gpt-5 tale (pilot); one extra small call per book for the split, one for the safety gate if separate. Images dominate cost as before.

## 11. Open questions and adopted defaults

**Defaults adopted on the local review's recommendation** (not new owner decisions; the owner may overrule any of them): the 3–4 range stays 150–250 until the first reading; no gold text to the author by default and no mandatory few-shot comparison; the parent note is kept apart from the tale's ending and placed when the layout is decided; the pilot stays on its branch, linked; gpt-5 is the starting author model with no mandatory model comparison.

**Still open for the owner — needed after stage 1, not before:**

1. **Capacity lever** (§7): more pages, larger caps at the same type size, a text-heavier 5–6 template, or narrower word ranges — decided on rendered samples of an accepted text.
2. **Parent note placement**: with the discussion questions on the `final` page, or elsewhere — decided together with the capacity lever, since both touch the same template.
