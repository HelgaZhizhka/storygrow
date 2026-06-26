# Two-Arc Story Model + Earned-Resolution — Design

**Issue:** #188
**Date:** 2026-06-25
**Status:** approved (brainstorm), pending implementation plan

## Problem

Generated story texts are banal. The hero's flaw carries no consequence and the
resolution is free. Concrete failing example — "Коля и волшебное слово"
(goal: Честность, age 5, judge score 8.3/10):

| Page | Beat |
|---|---|
| 2 | Коля is cheerful, likes to exaggerate (a dragon in the garden) |
| 3 | Stories "got too big", friends grow suspicious, Коля feels uneasy |
| 4 | Gathers friends by the river: "I need to tell you something" |
| 5 | Confesses → a friend *immediately*: "Ты наш друг всё равно!" |
| 6 | From then on tells the truth, friends believe again |
| 7 | Moral: telling the truth matters |

The lie never costs Коля anything. He simply *feels* awkward, confesses, and is
*instantly* forgiven. The moral is asserted on the last page, not earned by the
plot. Contrast the user's quality bar ("The Boy Who Cried Wolf"): the lie
**backfires on the liar** — when real need comes, no one believes him. Cause →
effect → earned lesson.

## Root cause

1. **One arc only.** `STORY_SYSTEM_PROMPT` rule 4 and `BOOK_STRUCTURE_RULES`
   encode a single arc: `setup → conflict → lesson → resolution`. This is the
   *virtue-acquisition* shape (challenge → effort → success). There is no
   **consequence** beat where a flaw backfires on the hero.
2. **Wrong exemplar for flaw goals.** The three Gold Exemplars (COURAGE,
   KINDNESS, INDEPENDENCE) are all virtue-acquisition. `pickExemplar` matches by
   goal title and falls back to COURAGE. Goals whose lesson is about a *flaw*
   (Честность, …) match nothing and get the COURAGE exemplar — a wrong-shaped
   craft model, so the model produces a virtue-arc story with no consequence.
3. **Judge blind to it.** No criterion checks whether the moral is *earned* by a
   real stake/consequence. The current six criteria scored this story 8.3.

## Goals & non-goals

**Goals**
- Stories whose lesson is about a flaw carry a real, age-appropriate
  **consequence** and an **earned** resolution (no instant forgiveness).
- Keep the virtue-acquisition arc (it already works) and route each goal to the
  correct arc + exemplar.
- The judge measurably penalizes unearned morals.

**Non-goals**
- No change to the image pipeline, PDF rendering, or RAG vocabulary.
- No physical danger. Stakes stay EMOTIONAL/SOCIAL — ADR-0004 (Safe Conflict)
  is preserved and clarified, not relaxed.
- Not regenerating already-stored books (forward pipeline only), except the one
  staged fallback book which is re-staged under the new 7-criteria judge.

## Arc taxonomy

Each learning goal is classified into one of two arc types.

### virtue-acquisition (14 goals)
Acquire a positive behavior/skill: `challenge → effort → success/reward`.
Existing exemplars (Миша/Соня/Тёма) already model this. Beats unchanged:

`Завязка → Конфликт → Внутренняя борьба → Поворот → Развязка → Закрепление через действие → Финал`

Goals: Дружба, Доброта, Преодоление страха темноты, Смелость, Уважение к
природе, Принятие различий, Самостоятельность, Сочувствие, Настойчивость,
Уважение к старшим, Забота о младших, Трудолюбие, Любопытство и любовь к
знаниям, Преодоление разлуки.

### flaw-consequence (6 goals)
A flaw/transgression that **backfires**, then is repaired at a cost:

1. **Завязка** — hero + their flaw, shown in action, charming (not preachy). The
   flaw looks harmless or even fun.
2. **Проступок** — the flaw plays out (lies / breaks a promise / lashes out /
   is careless / hoards / can't wait). Still feels consequence-free.
3. **Расплата** *(new beat)* — the flaw **costs the hero something**. The price
   is EMOTIONAL/SOCIAL: lied → now no one believes him about something that
   matters; lashed out → broke a thing he loved / hurt a friend; hoarded → left
   playing alone; couldn't wait → spoiled the thing.
4. **Осознание** — the hero feels the cost; the low point; the feeling is shown,
   not narrated as a maxim.
5. **Исправление** — the hero **does something** to make it right. Effort, not a
   free pass.
6. **Заслуженный финал** — it mends *because* the hero tried. No instant
   forgiveness, no unearned reward.
7. **Финал** — the moral, stated once.

Goals: Честность, Ответственность, Управление гневом, Бережное отношение к
вещам, Терпение, Делиться с другими.

**Hard rule (binds both arcs):** the consequence is EMOTIONAL/SOCIAL only —
never physical danger (ADR-0004). For flaw stories the repair/forgiveness MUST
cost the hero effort; an instant "ты всё равно наш друг" with no effort is a
defect.

## Components

### 1. `LearningGoal.arcType` (Prisma + seed)
- New enum `LearningGoalArcType { virtue flaw }`.
- New field `arcType LearningGoalArcType @default(virtue)` on `LearningGoal`.
- Migration (via `pnpm --filter backend prisma:migrate`) adds the column
  (default `virtue`) and **backfills** the 6 flaw goals in the same migration:
  `UPDATE "LearningGoal" SET "arcType"='flaw' WHERE title IN (...6 titles...)`.
  Backfill is required because the seed guard skips when goals already exist.
- `seed-learning-goals.ts`: each goal entry carries `arcType` so fresh seeds are
  correct without the backfill.

### 2. Exemplars (`backend/src/ai/prompts/exemplars.ts`)
- Add `arcType: 'virtue' | 'flaw'` to the `Exemplar` interface; tag the three
  existing ones `virtue`.
- Add **three flaw exemplars**, each a full 7-beat story using the
  flaw-consequence beat labels and an explicit `(тип конфликта: …)` tag:
  - `HONESTY` — goalTitles `['Честность']`. Lie → not believed when it matters →
    repairs trust by an honest act that costs him.
  - `IMPULSE` — goalTitles `['Управление гневом', 'Бережное отношение к вещам',
    'Ответственность']`. Acts in anger / carelessly / breaks a promise → real
    cost (a loved thing broken / someone let down) → makes it right by effort.
  - `WANTING` — goalTitles `['Делиться с другими', 'Терпение']`. Hoards / can't
    wait → ends up alone / spoils the thing → fixes it by sharing / waiting.
- Remove `'Делиться с другими'` from `KINDNESS.goalTitles` (Соня is a virtue
  story; sharing moves to the flaw arc via `WANTING`).
- `pickExemplar(goalTitle: string, arcType: 'virtue' | 'flaw'): Exemplar`:
  match within exemplars of the given `arcType`; fall back to `HONESTY` for
  `flaw`, `COURAGE` for `virtue`.

### 3. Prompt (`backend/src/ai/prompts/story-generator.prompt.ts`)
- `STORY_SYSTEM_PROMPT` rule 4 → generalize: "The narrative arc depends on the
  story's arc type; the required beats are given in the user prompt."
- Add `BEAT_SHEETS: Record<'virtue' | 'flaw', string>` — the two beat sequences
  as exported constants (CLAUDE.md rule 11: no magic prompt fragments).
- `BOOK_STRUCTURE_RULES` → a builder `buildBookStructureRules(arcType)` that
  injects the matching beat sheet. For `flaw`, include the explicit rules:
  "the flaw MUST visibly cost the hero (Расплата beat); the resolution MUST be
  earned through the hero's effort — instant or unconditional forgiveness is
  forbidden."
- `BuildStoryPromptOptions` gains `arcType: 'virtue' | 'flaw'`.
- `buildStoryUserPrompt` injects the arc-correct structure block and calls
  `pickExemplar(topic, arcType)`.
- The "Storytelling" brief gains one line: stories must have real stakes — the
  reader should feel something is at risk before the resolution.

### 4. Pipeline wiring
- `BooksService` (and any custom-flow generation path) reads `goal.arcType` and
  passes it into `buildStoryUserPrompt` options. Confirm during planning whether
  `StoryGeneratorService` already receives the `LearningGoal` row or only its
  title/description; thread `arcType` through accordingly.

### 5. Judge (`judge.schema.ts` + judge prompt)
- Add criterion `earnedResolution` (0–10) to `JudgeScoreSchema`:
  "There is a real stake/consequence in the story and the resolution is earned
  by the protagonist's own action — not asserted, gifted, or resolved by instant
  forgiveness." `computeFinalScore` already averages `Object.values`, so seven
  criteria are handled automatically.
- Judge prompt: describe the new criterion and its failure modes (free
  forgiveness, moral stated without a preceding cost).
- `/admin/metrics` aggregation: include `earnedResolution` in the per-criterion
  breakdown (verify the dashboard reads criteria dynamically vs a fixed list).

### 6. Docs
- `docs/adr/0004-safe-conflict-boundary.md`: one clarifying line — real
  stakes/consequence are *required*; "consequence" is EMOTIONAL/SOCIAL and is
  **not** the same as the forbidden physical danger.
- `CONTEXT.md`: document the two arc types and the `earnedResolution` criterion.
- `docs/ARCHITECTURE.md`: note arc-type routing in the generation pipeline.
- `docs/defense/qa-prep.md` Q2: criteria list 6 → 7.
- `docs/defense/staged-books.md`: 6→7 criteria note; re-stage the fallback book.

## Testing

- `pickExemplar`: flaw goal → flaw exemplar; unknown flaw goal → HONESTY;
  unknown virtue goal → COURAGE; `'Делиться с другими'` → WANTING (not KINDNESS).
- prompt builder: `buildStoryUserPrompt` with `arcType:'flaw'` contains the
  flaw beat sheet + the earned-resolution rule + a flaw exemplar; with
  `arcType:'virtue'` contains the virtue beat sheet.
- judge schema: `JudgeScoreSchema` parses 7 fields; `computeFinalScore` averages
  over 7; out-of-range rejected.
- A live end-to-end regeneration of a flaw-goal book (Честность) to confirm the
  consequence beat appears and the judge writes an `earnedResolution` score.

## Risks / open questions (resolve in planning)

- **Dashboard criteria list:** if `/admin/metrics` hard-codes the six criterion
  keys, it must be updated; if it iterates the JSON keys, no change. Verify.
- **Old StoryEval rows** hold 6-key `judgeScores`; any reader that assumes 7
  keys must tolerate the missing one. Verify the dashboard/aggregation.
- **Beat-label leakage:** exemplars include `[Завязка]`-style labels for the
  model's benefit; confirm generated `text` fields never echo the labels (the
  existing virtue exemplars already use labels without leakage — keep the same
  "match craft, not format" framing).
