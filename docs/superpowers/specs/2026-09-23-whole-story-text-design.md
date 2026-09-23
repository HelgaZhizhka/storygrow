# Whole-story text pipeline — design

**Status:** Proposal for review (STO-14). Documentation only — no generator code, no paid runs, no production change.
**Date:** 2026-09-23
**Ticket:** [STO-14](https://linear.app/storygrow/issue/STO-14) · **ADR:** [ADR-0008](../../adr/0008-whole-story-text-pipeline.md) (supersedes parts of [ADR-0005](../../adr/0005-decomposed-generation-pipeline.md))
**Supersedes as an implementation plan:** [2026-09-13 Suteev register refactor](2026-09-13-suteev-register-refactor-design.md) — its corpus analysis (§1–3) remains a reference; its 8-phase plan (§5) is no longer the plan.

> Owner-approved direction (discussion with Codex, 2026-09-23) is marked **[approved]**. Everything marked **[hypothesis]** is an untested literary or technical assumption that a reading test or a measurement must confirm before it is treated as fact.

---

## 1. Goal

Generate one Russian children's tale as a **single whole text** from `learning goal + age band + arc`, check it, and only then split it into pages, derive the Visual Bible, and hand it to the existing image and PDF stages. The tale must be clear, causal, concrete and alive; its learning goal must matter to what happens; different goals must produce visibly different stories.

**Why now.** The owner rejected all six texts of the 2026-09-18 pilot (see §9): artificial similes and titles («Солнышко из ошибки», «Алиса и подсолнуховый микрофон»), a shared plot skeleton across goals, and 847–930 words against a 500–800 request. The current Plan → Prose pipeline (ADR-0005) produces page-shaped prose from page-shaped intents; the whole-story pipeline lets the author hold one story in one context and lets pages follow the story instead of the other way round.

## 2. Scope and non-goals

**In scope (this document).** Target process and stage contracts; age/arc rules; text checks and refusal handling; the change map against `main` `9b6ff57`; rollout stages; risks; open questions.

**Approved frames [approved].**

1. One universal literary style for launch: clear natural Russian, concrete events, causality, live dialogue, understandable humour, an earned ending. Suteev is a reference for *clarity*, not an author to imitate. No style catalogue, no style switch, no device quotas.
2. The learning goal is material to actions and consequences. Two arcs stay: **virtue** (the quality shown through action) and **flaw** (an undesirable act → understandable consequence → repair; no humiliation, no "bad child" label). An arc is not a fixed step-by-step plot. A definition of the virtue in the finale does not replace a resolution.
3. Supported combinations at launch: **3–4/virtue, 5–6/virtue, 5–6/flaw**. No 3–4/flaw. Verified against code: `books.service.ts` excludes flaw goals for the 3–4 band and forces custom goals to `virtue` there; `BEAT_SHEETS['3-4']` has no `flaw` entry and `getBeatSheet` throws on it; ADR-0005 amendment 2026-06-27 states the same.
4. Working ranges **[hypothesis]**: 150–250 words for 3–4, 350–550 for 5–6. Age adaptation also covers the number of participants and events, syntax, and the complexity of causal links. Some 5–6 children read on their own; this is noted for the register, not turned into a UI mode.
5. Gold corpus: first **three** owner-approved texts, one per supported combination — not one per goal. Gold texts may be edited; the original and the edit are both kept. Unedited generations are checked separately. By default gold texts are **evaluation material**; giving the author a full example is a testable decision, not the default, because of plot copying (#311/#313).
6. Catalogue and custom goals go through the same short **goal brief** (wanted behaviour + arc meaning). The existing custom-goal safety gate stays. Vague or inadmissible goals and model refusals get explicit handling, not a new subsystem.
7. Target order: goal + age + arc → **whole tale** → **text checks** → **pages + Visual Bible** → existing images → PDF. A short preliminary premise is **not** declared useful and is **not** a mandatory stage.
8. Splitting preserves the text, the order of events and the cast. The child's appearance from photo/description is preserved. PDF capacity is verified; text is never silently cut and fonts are never shrunk to discomfort. The moral / parent material is separated from the tale's own ending.

**Non-goals.** Implementing the generator; paid generations; changing production; a style catalogue or switch; a premise stage; a 3–4/flaw arc; a new UI mode; a memory of the child's previous books (raised as a later hypothesis in §8); resolving [STO-6](https://linear.app/storygrow/issue/STO-6) (LangFuse in production) — a release prerequisite tracked on its own; pulling [STO-7](https://linear.app/storygrow/issue/STO-7) out of Backlog — it is the natural implementation of stage 4 below and is referenced, not scheduled.

## 3. Current process (as built, `main` 9b6ff57)

`GenerationProcessor` → `StoryOrchestratorService.generate` runs up to `EVAL_MAX_RETRIES + 1 = 3` attempts of:

| Stage | Call | Model | Output |
| --- | --- | --- | --- |
| Plan | `story-generator.service.ts#generatePlan` · `plan.prompt.ts` | `PLAN_MODEL` gpt-4o | `StoryPlan`: hero, `characterProfile`, lesson, 5 questions, **Visual Bible**, `pages[]` with template + arc beat + Russian intent + scene. Page count `PAGE_COUNT_BY_BAND` (3–4: 6–8, 5–6: 6–12). Beat sheet from `story-generator.prompt.ts`; one Gold Exemplar as craft reference; template catalogue with per-band char caps. |
| Hero look | `resolveHeroAppearance` (+ `character-profile.prompt.ts` in child mode with a description) | gpt-4o-mini | Structured `Appearance` written back into the bible (#376). Photo mode overrides again at image time. |
| Prose | `generateProse` · `prose.prompt.ts` | `PROSE_MODEL` gpt-5 | `ProseOutput`: exactly `plan.pages.length` pages, each `text` ≤ template cap, `illustrationPrompt` (English action), cover title; the exemplar is shown again as the voice target. |
| Merge | `mergeVisualBible` | code | Persisted `Story` = prose + bible + per-page scene + `characterProfile`. |
| Title | `deriveTitle` · `title.prompt.ts` · `isConcreteTitle` | gpt-4o | Concrete title from the finished text, ≤ 3 attempts. |
| Checks | `story-evaluator.service.ts` | gpt-4o-mini judge | `validateBookPlan` (cover/final, per-page caps, age templates, scenes present), language purity, soft vocabulary compliance, judge with 6 guardrails (floor 6) + `registerMatch` craft (≥ `EVAL_THRESHOLD` 7) + informational `pictureConsistency`. One `StoryEval` row per attempt; failure feedback goes into the next Plan. |

Then images (`ImageGeneratorService`: portrait → reference sheets → pages from `buildIllustrationPrompt(bible, scene, action)` → image judge) and PDF (`PdfRenderService`, six templates, A5, no truncation logic — the caps are enforced upstream). Eval harness: `eval:text`, `eval:batch --set=core|full|antagonist`, `eval:metrics`, `scripts/lib/prose-metrics.ts` (words, dialogue share, name density, question tics, moral formula, refrains, title stop-words). Goals: 20 seeded (14 virtue, 6 flaw) + per-user custom goals with an LLM safety gate (`learning-goal-safety.service.ts`). Exemplars: 9 (`exemplars.ts`; 6 for 5–6, 3 for 3–4), used both as the Prose few-shot and as the judge's register references.

**What the current shape makes hard.** The author never sees a whole story it is free to shape — it renders intents into page-sized slots (~220 chars for 5–6), so pages read as beats, not as a tale. Structure, safe conflict, bible and page layout are all decided before a word exists, and every one of the 12 pilot-era prohibitions the ADR removed has quietly come back as a Plan rule. The judge's craft signal is calibrated on exemplars the owner has not accepted as gold.

## 4. Target process

```
Input: goal (catalogue or custom) · child age → age band · arc · protagonist mode ·
       hero identity (name, gender, appearance / photo Appearance) · seeds
  1. Goal brief      code for catalogue goals; one small LLM call for custom goals
  2. Whole tale      one generateObject call → WholeStory { title, paragraphs[] }
  3. Text checks     deterministic gates + judge v2 → StoryEval row per attempt;
                     bounded revision (§6)
  4. Pages + bible   one call over the FINAL text → page boundaries as paragraph
                     indices, per-page action, Visual Bible, scenes; verified in code
  5. Title           existing post-text derivation + isConcreteTitle gate
  6. Images          unchanged (Story contract preserved)
  7. PDF             unchanged renderer; capacity verified, never truncated
```

### Stage contracts

**1. Goal brief** — `StoryBrief { goalTitle, wantedBehaviour, arcMeaning, ageBand, arc }`. For catalogue goals it is assembled in code from `LearningGoal.title/description/arcType` and a per-arc meaning sentence (virtue: the quality shown through the hero's own action; flaw: the act, a consequence the listener can picture, a repair the hero works for). For custom goals the existing safety gate runs first (fail closed, as today); a safe but unwritable goal (`usable: false`) is refused with a parent-facing Russian reason and no book is created, mirroring the custom-goal spec's error handling. The brief is short by design — no premise, no beats.

**2. Whole tale** — `WholeStory { title: string; paragraphs: string[] }`. Input: the brief, the age-band profile (word range, participants/events budget, sentence guidance), hero identity, seeds, protagonist mode, the safe-conflict boundary (ADR-0004 v2 wording as approved). Paragraphs are the unit the later split works with, so the prompt asks for **short paragraphs** (each ≤ the smallest page cap of the band) and the schema caps paragraph length; that is what keeps stage 4 mechanical. No exemplar text by default [approved]. Model: gpt-5 as in the pilot [hypothesis — measured, not assumed]. Every call is `generateObject` + Zod with `experimental_telemetry` (hard constraints 9–10).

**3. Text checks** — see §6.

**4. Pages + Visual Bible** — `PageSplit { pages: [{ fromParagraph, toParagraph, template, action, scene }], visualBible }`. The model never re-emits the text: pages are **paragraph index ranges**, so text preservation is by construction; code then asserts contiguity, full coverage, order, and every page's joined text ≤ the template cap for the band (else one re-split with more pages, never a cut). The bible is extracted from the final text: every cast name must occur in the text; hero appearance is set in code exactly as today (`resolveHeroAppearance`, photo `Appearance` override at image time). `normalizeVisualBible` runs unchanged. Discussion questions and the **parent note** (the moral, stated for the adult) are produced here from the final text, so the tale's ending stays a scene. This stage is the shape of STO-7's "post-Prose illustrator brief".

**5. Title** — the author may propose one inside `WholeStory`; `isConcreteTitle` gates it and `deriveTitle` regenerates from the text as today.

**Persisted contract.** `Story` keeps its shape (`title`, `pages[].text/title/illustrationPrompt/scene`, `visualBible`, `characterProfile`, `discussionQuestions`) so the image stage, PDF, admin and the reader UI are untouched; two optional fields are added — `wholeText` (the paragraphs, for audit and re-splitting) and `parentNote`. `StoryEval` keeps its columns.

## 5. Age bands and arcs

| | 3–4 / virtue | 5–6 / virtue | 5–6 / flaw |
| --- | --- | --- | --- |
| Words [hypothesis] | 150–250 | 350–550 | 350–550 |
| Participants / events | hero + 1–2, one problem, one solution | hero + 2–3, one problem with 2–3 attempts or turns | hero + 2–3; act → consequence → repair |
| Syntax | short simple sentences, repetition welcome | mixed, dialogue-led | mixed, dialogue-led |
| Arc | quality shown once, then shown again | quality shown through action, earned ending | consequence the listener can picture, repair by effort, no shaming |

Corpus check: the 2026-09-13 analysis measured Suteev's shortest tier at **90–150 words** and the middle tier at 280–500. The 3–4 range above sits **above** the shortest tier — kept as the owner's hypothesis, flagged for the first 3–4 reading. The **independent-reader note** for 5–6 changes nothing in the pipeline: it argues for clear syntax and unambiguous dialogue attribution, which the universal style already demands.

## 6. Checks, judge, refusals

**Deterministic gates (code, before any judge call).** Word count inside the band range; Russian-only text (existing `checkLanguagePurity`); every paragraph ≤ the band's smallest page cap; title gate (`isConcreteTitle`); for flaw arcs the cast is ≥ 2 (a consequence needs someone to feel it) [hypothesis]. Word count uses one counting rule (the pilot's: no standalone dashes) recorded in code.

**Judge v2 (LLM, informational until calibrated).** Criteria [approved]: language (clean, natural Russian), causality (why things happen and why it ends so), goal/arc (the goal drives actions and consequences; flaw arc has consequence + repair), age fit, title, safety (ADR-0004 v2 action-based boundary), and plot diversity against the other results of the same run. Scores are stored in `StoryEval.judgeScores` as today. **Rule:** a high score from an uncalibrated judge is never sufficient; until the judge is calibrated on the three gold texts and the rejected pilot texts (§8, stage 2), only **safety** and the deterministic gates block a book. `registerMatch` is retired with the exemplar-as-target model (ADR-0008).

**Revision policy (bounded).** `EVAL_MAX_RETRIES` stays the budget. A length overshoot triggers a **targeted revision** ("shorten to N–M words; keep every event, character and line of dialogue; cut description and repetition") — this is the Read-Aloud Edit of ADR-0005 given a concrete job; any other failure triggers a fresh tale with feedback. Every attempt writes a `StoryEval` row (hard constraint 10); the previous row stays (no silent regeneration).

**Refusals and errors.** Custom goal unsafe → existing gate, no book. Goal safe but unwritable → `usable: false` + reason, no book. Model refusal or API error in stages 2/4 → attempt consumed, trace kept, `StoryGenerationFailedError` → `failed` status as today; no hidden retries beyond the budget.

## 7. Change map (real files, `main` 9b6ff57)

| Area | File | Change |
| --- | --- | --- |
| Orchestration | `backend/src/ai/story-generator/story-generator.service.ts` | Replace Plan → Prose with Brief → Tale → Split; keep `resolveHeroAppearance`, `deriveTitle`, `applyTitle`. |
| | `.../story-orchestrator.service.ts` | Loop unchanged; length revision is one attempt kind; `writeEval` unchanged. |
| | `.../story-evaluator.service.ts` | Add word-count + paragraph-cap gates; judge v2; craft not gated until calibrated. |
| Prompts | `backend/src/ai/prompts/plan.prompt.ts`, `prose.prompt.ts`, `story-generator.prompt.ts` (beat sheets) | Retired behind the flag; deleted in the release stage. Beat sheets become the per-arc **meaning** sentences of the brief. |
| | new `story-brief.prompt.ts`, `whole-story.prompt.ts`, `page-split.prompt.ts` | Stage 1 (custom goals only), 2, 4. |
| | `judge.prompt.ts` | v2 criteria; references = the gold corpus, not `exemplars.ts`. |
| | `exemplars.ts` | No longer fed to the author; replaced as judge references by new `gold-corpus.ts` (original + edited versions, per combination). |
| | `title.prompt.ts`, `learning-goal-safety.prompt.ts` | Unchanged. |
| Schemas | `backend/src/ai/schemas/story-plan.schema.ts` | Retired with the Plan. |
| | new `whole-story.schema.ts`, `page-split.schema.ts`, `story-brief.schema.ts` | Stage contracts (§4). |
| | `story.schema.ts` | Optional `wholeText`, `parentNote`; `buildProseSchema` retired. |
| | `judge.schema.ts` | v2 criteria; `computeFinalScore` redefined (§6). |
| | `visual-bible.schema.ts` | Unchanged. |
| Validators | new `text-preservation.validator.ts` | Contiguity, coverage, order, per-page cap, cast names present. |
| | `book-plan.validator.ts`, `visual-bible.normalizer.ts` | Unchanged. |
| Config | `backend/src/ai/ai.config.ts` | `WORD_RANGE_BY_BAND`, `AUTHOR_MODEL`, `TEXT_PIPELINE` flag; revisit `PAGE_COUNT_BY_BAND`. |
| PDF | `backend/src/pdf/page-templates/page-templates.config.ts` | **Capacity** (below) — owner decision after a rendered check. Renderer unchanged. |
| Queue / books | `generation.processor.ts`, `books.service.ts`, billing, photo, S3 | Unchanged. |
| Eval | `scripts/eval-text.ts`, `eval-batch.ts`, `lib/eval-run.ts`, `lib/eval-cases.ts`, `lib/prose-metrics.ts` | Whole-story path, word count, run-level diversity; a corrected `eval:whole-story` derived from the pilot script on branch `issue/387-whole-story-pilot` (`91253c0`). |
| Docs | `CONTEXT.md` (Story Plan → retired; Story Brief, Whole Story, Page Split, Parent Note), `docs/ARCHITECTURE.md` diagram | At implementation time. |

**PDF capacity — a real conflict, numbers from the templates.** 5–6 text pages cap at 220 chars (`image-top/bottom`), the final page at 200, and a book has at most 12 pages, so the ceiling is ~2 400 chars ≈ **340–370 words** at ~6.5 chars/word — the *bottom* of the 350–550 range, reachable only at the maximum page count; 450 words needs ~14–15 text pages at today's caps. For 3–4 (110/90 chars, 6–8 pages) the ceiling is ~750 chars ≈ **100–115 words** against a 150–250 target. Levers: more pages per band, larger caps at the same 30 px font (the `image-top` text area holds ~8 lines × ~50 chars ≈ 400 chars, so ~300 is plausible without shrinking type), or a text-heavier 5–6 template (`text-focus` is 350 chars but `suitableFor` 7–8 only). The choice is the owner's and must be checked on a rendered PDF, not computed. Until then the validator refuses a split that does not fit, and the tale is re-split with more pages.

## 8. Rollout stages (inside this document; tickets only after review)

| # | Stage | Exit criterion | Depends on |
| --- | --- | --- | --- |
| 1 | **First tale 5–6/virtue.** Brief + whole-tale prompt + deterministic gates in a text-only harness (no Book/StoryEval; `bookId: dry-run`), traces on. Owner reads unedited results; iterate on the prompt, not on the text. | One owner-approved text (original + edits kept). | — |
| 2 | **Remaining gold.** 5–6/flaw, then 3–4/virtue. Judge v2 calibrated on the three gold texts + the six rejected pilot texts as negatives. | Three gold texts; judge agreement recorded. | 1 |
| 3 | **New goals and repeats.** Portability matrix: 9 unedited results, 3 per combination, including ≥ 2 custom goals and one goal repeated for the same child; matrix and criteria fixed before the run. | Read by the owner; diversity and language findings written down. Not a statistical proof. | 2 |
| 4 | **Integration.** Split + bible + title behind `TEXT_PIPELINE=whole`; real API run → Book, StoryEval, own trace, images, PDF viewed. Capacity decision applied. | One real book end-to-end, evidence attached. | 1 (scaffold), 2 (merge) |
| 5 | **Real books.** Owner generates books in the app; capacity, split fidelity and image continuity checked on real output. | Findings; no silent cuts. | 4 |
| 6 | **Release with rollback.** Flag default → `whole`; the Plan path stays one release; rollback = flip the flag. Requires STO-6 answered (traces in production). | Released; old path removed next. | 5, STO-6 |

**Evidence rules for every stage.** Keep all attempts, prompt versions, model id, usage, latency, retry reasons and LangFuse trace ids (the pilot's `manifest.json` is the template). Before any PR with AI code: a live `eval:text` equivalent + trace. Before any "integrated" claim: a real API run with Book/StoryEval, its own trace, images and a viewed PDF (AGENTS.md "Done is not a mood").

## 9. Evidence we have, and what is missing

**Pilot 2026-09-18** (branch `issue/387-whole-story-pilot`, commit `91253c0`; not in `main`): 9 gpt-5 calls, 6 tales × (A: direct, B: premise first), synthetic hero, $0.38, all traces verified. Findings that inform this design: all six 847–930 words against 500–800 (length must be a gate); a shared skeleton per goal despite different words (diversity must be checked, not assumed); decorative similes, adult jokes and language slips («коснулся Алисиної щеки», «Ска» for «Скок»); the A/B is invalid because the premise prompt also asked for a full tale — which is why the premise stage is not adopted. Owner verdict: none of the six is gold.

**Missing sources (not invented).** `docs/process/2026-09-18-text-generation-research.md` and its evidence JSON — not in `main`, the pilot commit, stashes, dangling commits or history. The uncommitted #407 phase-1 work (`register.ts`) — not found in any checkout; treated as non-existent unless the owner has it elsewhere.

## 10. Risks

- **Length.** Free requests do not control length (6/6 overshoot). Mitigation: word-count gate + targeted shortening revision + one bounded budget.
- **Split fidelity.** Mitigated by construction (index ranges, code-side assertions); residual risk is a paragraph too long for any page → author paragraph cap + one revision.
- **Sameness across goals.** The brief is short on purpose; diversity is measured in stage 3 and at run level; a memory of the child's previous books is a later hypothesis, not part of launch.
- **Uncalibrated judge.** Only safety and deterministic gates block until stage 2; craft is read by a human.
- **Capacity.** §7 numbers; decided on a rendered PDF, never by shrinking type or cutting text.
- **Custom goals.** A bad brief makes a bad tale; the safety gate and `usable: false` refusal keep it explicit.
- **Cost.** ~$0.04–0.05 per gpt-5 tale (pilot); one extra small call per book for the split. Images dominate cost as before.

## 11. Open questions for the owner

1. **Capacity lever** (§7): more pages, larger caps at the same type size, a text-heavier 5–6 template, or narrower word ranges? Needs a rendered check.
2. **3–4 range**: keep 150–250 or move toward the corpus tier (≈ 100–180)?
3. **Gold text to the author**: test as one variant in stage 3, or not at all in v1?
4. **Parent note**: rendered on the final page with the questions (proposed), or elsewhere?
5. **Pilot folder in `main`**: link to the branch only (current), or commit `docs/process/2026-09-18-whole-story-pilot/` as a research record?
6. **Author model**: gpt-5 (pilot) until stage 3 compares — agree?
