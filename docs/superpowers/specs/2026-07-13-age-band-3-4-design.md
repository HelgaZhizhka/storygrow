# 3–4 Age-Band Profile — Design

**Issue:** #196
**Date:** 2026-07-13
**Status:** approved (brainstorm), pending implementation plan

## Problem

StoryGrow only serves ages 5–6 today. The frontend form hard-restricts
`childAge` to `min(5).max(6)` (added in #214) because nothing downstream
actually supports younger children:

- **No page template accepts age 3 or 4.** `PAGE_TEMPLATES[*].suitableFor`
  never includes 3 or 4 for any template — `templatesForAge(3)` and
  `templatesForAge(4)` both return `[]` today. A 3–4-year-old's book cannot be
  planned at all, not just "generated with adult-length text."
- **No exemplars target a simpler register.** All Gold Exemplars are written
  for the 5–6 Сутеев register (ADR-0005) — richer prose, longer beats, an
  "Внутренняя борьба" (internal struggle) beat that is too introspective for a
  3-year-old.
- **The judge's craft criterion would misfire.** `registerMatch` penalises
  "flatter than the exemplars" prose — but for 3–4, short repeated phrases and
  refrain **are** the target register, not a defect. Judged against the 5–6
  exemplars, a correct 3–4 story would score low.
- **Flaw arcs are pedagogically wrong for this age.** ADR-0005 already decided
  3–4 is virtue-arcs only — the flaw arc's "Расплата" (consequence) beat is too
  heavy — but nothing currently enforces that. Five flaw-arc `LearningGoal`
  rows already have `ageRangeMin` ≤ 4 and would surface to a 3–4 parent today if
  the age gate were simply lifted.

This is a follow-up to #194/ADR-0005, which named 3–4 and 5–6 as the two target
bands and 5–6 as the flagship, but explicitly deferred building the 3–4 profile.

## Goals & non-goals

**Goals:**
- A 3–4-year-old can create a Custom Flow book end-to-end: form → Plan → Prose
  → judge → images → PDF, with age-appropriate structure, length, and register.
- Single source of truth for "what age band is this" (`AgeBand`), extending
  the existing `templatesForAge()` pattern rather than adding parallel
  age-branching logic.
- 3–4 is virtue-arc only; flaw-arc goals are invisible to 3–4 parents, not just
  silently mismatched.

**Non-goals (explicitly out of scope):**
- **Fast Flow.** Admin-authored `Template` rows aren't age-filtered today and
  weren't designed with per-band caps. Fast Flow keeps using the current
  (5–6-shaped) schema, untouched.
- **Ages 7–8.** Some templates already list 7/8 in `suitableFor` (dead code —
  the product doesn't serve those ages and the form never offered them). Out
  of scope; not touched by this change.
- **Photo/portrait changes.** Image generation, reference portraits, and art
  styles are age-independent already and need no change.
- **New admin UI** for authoring 3–4 exemplars. Exemplars are added as code
  (`exemplars.ts`), same as the existing 5–6 set — no admin tooling exists for
  exemplars today and this doesn't add any.

## Design

### `AgeBand` — single source of truth

```ts
// backend/src/pdf/page-templates/page-templates.config.ts
export type AgeBand = '3-4' | '5-6';

export const ageToAgeBand = (childAge: number): AgeBand =>
  childAge <= 4 ? '3-4' : '5-6';
```

Placed alongside `templatesForAge()` (same file, same "age → capability" role).
Every age-dependent decision in the pipeline derives from `AgeBand`, computed
once per request from `childAge`, never re-branched on raw numbers downstream.
Valid input range enforced at the DTO layer (3–6 inclusive); this function is
never called with 7/8 or invalid ages.

### 1. Page templates (`page-templates.config.ts`)

- `suitableFor` extended to include `3, 4` for `cover`, `image-top`,
  `image-bottom`, `final` (the four templates 3–4 books will actually use).
  `image-left` and `text-focus` are unaffected (6+/7+, out of scope).
- `maxChars` becomes per-band:
  ```ts
  maxChars: Record<AgeBand, MaxChars>
  ```
  Starting values (tunable via `eval:text` during implementation, not
  contractual):
  | Template | 3–4 text | 3–4 title | 5–6 text | 5–6 title |
  |---|---|---|---|---|
  | cover | — | 40 | — | 60 |
  | image-top | 110 | — | 220 | — |
  | image-bottom | 110 | — | 220 | — |
  | final | 90 | — | 200 | — |
- Every current reader of `.maxChars.text` / `.maxChars.title` (Plan prompt's
  template catalogue, `StorySchema`/`PageSchema`, `BookPlanValidator`, the
  cover-title gate in `story.schema.ts`) takes an `AgeBand` parameter and reads
  the matching entry.

### 2. Page count (`ai.config.ts`)

`PAGES_MIN`/`PAGES_MAX` become per-band: 3–4 → min 6, max 8 (shorter book, not
just shorter pages — repetition-driven structure doesn't need 12 pages).
5–6 stays 6–12, unchanged.

### 3. Beat sheet (`story-generator.prompt.ts`)

A second virtue beat sheet for 3–4, five beats (vs. the 5–6 virtue sheet's
six) — drops "Внутренняя борьба" (too introspective for this age) and
foregrounds a repeated refrain as the central craft device:

```
1. Завязка — hero and their world, in simple concrete terms.
2. Трудность — something scary / not-working / sad appears.
3. Попытка с повтором — hero tries, with a repeated action or refrain line.
4. Развязка — it works, shown through action (not narrated).
5. Закрепление — hero does it again, the refrain returns.
```

`BEAT_SHEETS` keys become `virtue-3-4 | virtue-5-6 | flaw-5-6` (flaw has no 3–4
variant — see §6). Selection is by `(arcType, ageBand)`.

### 4. Exemplars (`exemplars.ts`)

Two new virtue exemplars for `ageBand: '3-4'`, following the beat sheet above —
short plain sentences, a repeated refrain line, concrete toddler-scale stakes
(a slide, a shared apple), no simile, no internal monologue. **Drafts below are
first-pass text for the pedagogy expert to edit before merge** — nothing here
is final.

**Draft 1 — fear/trying-something-new** (fallback exemplar, mirrors COURAGE's role):

```
Название: «Катя и высокая горка»  (тип конфликта: страх нового)
[Завязка] Жила-была Катя. Катя маленькая, а горка — ух какая большая!
[Трудность] Катя смотрит наверх. Катя боится. «Ой-ой-ой, высоко!» — говорит Катя.
[Попытка с повтором] Катя делает шажок. «Я могу! Я могу!» — говорит Катя. Ещё шажок. «Я могу! Я могу!»
[Развязка] Вот она, горка! Ух! Катя едет вниз — быстро-быстро! «Ура-а-а!» — кричит Катя.
[Закрепление] Катя бежит наверх снова. «Я могу! Я могу!» — поёт Катя. И едет ещё раз. И ещё.
[Финал] Если страшно — скажи «Я могу!» и попробуй.
Вопросы: 1. Что было большое? 2. Катя боялась? 3. Что говорила Катя, когда шла наверх? 4. Что было внизу горки? 5. А ты можешь сказать «Я могу»?
```

**Draft 2 — kindness/sharing:**

```
Название: «Мишка и грустный Ёжик»  (тип конфликта: социальный / доброта)
[Завязка] Жил-был Мишка. У Мишки было одно красное яблоко. Мишка любит своё яблоко.
[Трудность] Мишка видит Ёжика. Ёжик сидит один-одинёшенек. У Ёжика нет яблока. Ёжику грустно.
[Попытка с повтором] «Дать? Не дать?» — думает Мишка. Мишка смотрит на яблоко. Мишка смотрит на Ёжика. «Дать? Не дать?»
[Развязка] «На, Ёжик, половинку!» — говорит Мишка. Ёжик улыбается: «Спасибо, Мишка!»
[Закрепление] Хрум-хрум! Мишка и Ёжик едят яблоко вместе. Одному скучно. Вдвоём — веселее!
[Финал] Поделиться с другом — это радость для двоих.
Вопросы: 1. Какое яблоко было у Мишки? 2. Почему Ёжику было грустно? 3. Что думал Мишка — дать или не дать? 4. Что сказал Ёжик? 5. А чем ты можешь поделиться с другом?
```

`pickExemplar(goalTitle, arcType, ageBand)` gains the `ageBand` param;
unmatched 3–4 virtue goals fall back to Draft 1, mirroring today's
COURAGE-fallback behaviour for 5–6.

### 5. Judge (`judge.prompt.ts`)

`JUDGE_SYSTEM_PROMPT` (currently a module-level constant, hardcoding "ages
5–6" and a fixed `[COURAGE, HONESTY]` reference pair) becomes
`buildJudgeSystemPrompt(ageBand)`:
- `REGISTER_REFERENCE_BLOCK` built from the matching band's exemplars (3–4 →
  the two drafts above; 5–6 → today's `[COURAGE, HONESTY]`, unchanged).
- The `registerMatch` criterion text is recalibrated per band, not replaced:
  for 3–4, short repeated phrases and refrain are explicitly named as the
  target (not the "flat" failure mode); the "too ornate/precious" failure mode
  is unchanged (still a real risk at any age).
- `story-evaluator.service.ts`'s `judgeStory` computes `ageToAgeBand(childAge)`
  and passes it directly to `system: buildJudgeSystemPrompt(ageBand)` in the
  `generateObject` call (`buildJudgePrompt(story, childAge, learningGoal)` is
  the separate user-turn builder and is unaffected — it already threads
  `childAge` through for its own use, unchanged here).

### 6. Flaw-arc exclusion for 3–4

`BooksService.listLearningGoals` adds a filter: a `LearningGoal` with
`arcType: 'flaw'` is excluded when the requesting child's age band is `3-4`,
regardless of the goal's own `ageRangeMin`/`ageRangeMax`. A 3–4 parent never
sees a flaw-arc goal in the picker — this is enforced at the list level, not
left to Plan/judge to reject after the fact. No `LearningGoal` rows change;
this is a runtime filter, not a data migration.

### 7. `StorySchema` becomes age-aware, `StoryGeneratorService` only

```ts
export const buildStorySchema = (ageBand: AgeBand): typeof StorySchema => { ... }
export const StorySchema = buildStorySchema('5-6'); // kept for Fast Flow (unchanged behaviour)
```

`StoryGeneratorService` calls `buildStorySchema(ageToAgeBand(input.childAge))`.
`FastFlowService` keeps importing the plain `StorySchema` export — zero
behaviour change there, per the non-goal above. Mirrors the existing
`buildStoryPlanSchema(childAge)` factory pattern already used for the Plan
phase (#218) — same shape, same reasoning (constrain what the model can emit,
not just what's rendered).

### 8. Frontend (`books/new/page.tsx`)

- `childAge` Zod schema: `min(3).max(6)` (was `min(5).max(6)`).
- Number input `min={3}` (was `min={5}`).
- Hint text: "Доступно 3–6 лет" (was "Пока доступно только 5–6 лет").
- No other UI change — age is still a single free-form number input, not a
  band selector; the band is an internal concept.

## Testing

- Unit: `ageToAgeBand()` boundary cases (3,4→'3-4'; 5,6→'5-6').
- Unit: `templatesForAge(3)`/`templatesForAge(4)` now non-empty, containing
  exactly `[cover, image-top, image-bottom, final]`.
- Unit: `pickExemplar(goalTitle, 'virtue', '3-4')` returns a 3–4 exemplar,
  never a 5–6 one; unmatched goal falls back to Draft 1.
- Unit: `buildStoryPlanSchema`/`buildStorySchema` reject a 5–6-length page for
  a 3–4 band (mirrors the existing #218 age-template-guard test pattern).
- Unit: `listLearningGoals` excludes flaw-arc goals for a 3–4 child even when
  `ageRangeMin` would otherwise include them.
- Live: `eval:text <goal> 3 child` / `eval:text <goal> 4 child` across a few
  virtue goals — confirm `structural` passes, `registerMatch` scores
  reasonably against the new calibration, and prose actually reads
  simpler/shorter than the 5–6 output for the same goal.
- Manual: create a book end-to-end for a 3-year-old child via the form
  (Custom Flow) and read the resulting PDF.

## Risks / open questions (resolve in planning)

- **Exemplar drafts need the pedagogy expert's edit pass before merge** — the
  text above is a first draft, not approved copy. Implementation plan should
  have an explicit checkpoint for this before wiring `pickExemplar`.
- **maxChars/PAGES_MAX starting values are estimates**, calibrated by feel
  against the exemplar drafts, not measurement. Expect one round of
  `eval:text`-driven tuning during implementation, same as every prior
  register-tuning pass in ADR-0005's history.
- **`image-left`/`text-focus`'s existing `suitableFor: [6,7,8]` /`[7,8]`** is
  pre-existing dead code (ages 7–8 aren't served) — not fixed here, flagged so
  it isn't mistaken for new debt introduced by this change.
