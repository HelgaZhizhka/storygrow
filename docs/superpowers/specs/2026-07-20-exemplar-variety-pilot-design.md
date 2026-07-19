# Exemplar-variety pilot (Доброта / 3-4) — design

## Motivation

#196 shipped the 3-4 age band with one Gold Exemplar per learning goal
(FEAR_3_4, KINDNESS_3_4). `plan.prompt.ts`'s hard rule 1 — "ADAPT THE PROVEN
STORY given in the user prompt, do NOT invent a new premise" — is deliberate
(free invention produces contrived, far-fetched stories), but its side effect
is that every book generated for a given goal reuses the *same* plot skeleton,
just with a different hero. This is most visible for **Доброта** at 3-4:
manual QA and `eval:batch` runs this session (Катя+lonely frog, Алиса+lonely
cloud, Катя+lonely kitten) all reproduced KINDNESS_3_4's exact beat structure
("lonely creature appears → hero weighs give-or-not → gives an object →
shared happiness"). The LLM judge scores these highly (register match 8-9)
because it's calibrated against the same exemplar it's grading — high scores
don't mean "delightful", they mean "on-register", which is a different thing.

Root-cause fix (discussed and agreed): the craft-calibration machinery
(register, structure, safety, title concreteness) is mature and doesn't need
more tuning. The actual bottleneck is that each goal has only **one** proven
plot to adapt. Real fix = more distinct proven plots per goal, sourced from
real children's-literature premises (not more LLM-drafted variations of the
same idea, which would just compound the sameness) — then let the pipeline
pick between them per generation instead of always the same one.

## Scope (pilot, deliberately narrow)

- **One goal, one band:** Доброта (+ its alt titles Сочувствие, Забота о
  младших) at **3-4 only**. 5-6 is untouched — it already has richer
  register and isn't where the sameness was observed.
- **One new exemplar**, not several — validate the mechanism before scaling
  to more goals.
- Premise: **"Под грибом" (Sutee­v)-inspired** — shelter/inclusion, not
  food-sharing. Structurally distinct from KINDNESS_3_4: a widening circle of
  creatures asks to join a small shelter, rather than one binary "give this
  object or not" choice. Adapted at the premise level (own prose, own
  concrete object — a leaf, not a mushroom — own hero) — not a reproduction
  of the original text, consistent with how the existing exemplars already
  work ("in the tradition of Сутеев", never a copy).
- Out of scope: other goals, the 5-6 band, flaw arcs (3-4 stays virtue-only
  per ADR-0005), retuning the judge/register prompts (already well-calibrated
  per this session's `eval:batch` runs).

## New exemplar: SHELTER_3_4

```
Название: «Юра и лист-домик» (тип конфликта: социальный / доброта, укрытие)
[Завязка] Пошёл дождь. Юра нашёл большой лист — вот и домик! Сидит Юра, слушает дождик.
[Трудность] Прибежал мокрый жучок. «Пусти под лист!» — пищит жучок. Юра смотрит: место совсем маленькое.
[Попытка с повтором] «Тесно? Не тесно?» — думает Юра. Подвинулся. Жучок сел рядом. «Вот и не тесно!»
[Развязка] Прискакала мокрая лягушка: «Пустите!» «Тесно? Не тесно?» — думает Юра. Все подвинулись. Место нашлось!
[Закрепление] Дождь кончился. Вылезли все втроём — весёлые, сухие, дружные.
[Финал] Поделиться местом — это тоже доброта.
Вопросы: 1. Что нашёл Юра от дождя? 2. Кто первым попросился под лист? 3. Что думал Юра — тесно или нет? 4. Сколько зверей поместилось? 5. А ты можешь потесниться для друга?
```

`goalTitles: ['Доброта', 'Сочувствие', 'Забота о младших']` — same coverage
as KINDNESS_3_4, so `pickExemplar` pools both whenever any of these titles is
requested. `arcType: 'virtue'`, `ageBand: '3-4'`. User-approved 2026-07-20
(premise choice + full text) — no separate pedagogy-review flag needed, this
review already happened in-conversation.

## `pickExemplar` — pooled random selection

Current behavior: exact-title match wins deterministically; on no match,
`inBand[0]` (first declared exemplar for that arc+band) wins deterministically.
Both cases become **pool, then random pick**:

```ts
export const pickExemplar = (
  goalTitle: string,
  arcType: 'virtue' | 'flaw',
  ageBand: AgeBand = '5-6',
): Exemplar => {
  const normalized = goalTitle.trim().toLowerCase();
  const inBand = EXEMPLARS.filter((e) => e.arcType === arcType && e.ageBand === ageBand);
  const matches = inBand.filter((e) => e.goalTitles.some((t) => t.toLowerCase() === normalized));
  const candidates = matches.length > 0 ? matches : inBand;
  if (candidates.length === 0) {
    throw new Error(`No exemplar for arcType=${arcType} ageBand=${ageBand}`);
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
};
```

Side effect (accepted, desired): goals with **no** dedicated 3-4 exemplar
(most 3-4 goals) now fall back to a pool of 3 (FEAR_3_4, KINDNESS_3_4,
SHELTER_3_4) instead of always FEAR_3_4 — more variety there too, for free.

The `EXEMPLARS` array's doc comment claiming "declaration order is fallback
priority" is no longer true (order is now irrelevant to selection) — update
it when implementing.

## `getRegisterReferences('3-4')` — show the judge the full 3-4 pool

Currently hardcodes `[FEAR_3_4, KINDNESS_3_4]`. Extend the 3-4 branch to
return **all** 3-4 exemplars (now 3) instead of a fixed pair, so the judge's
register calibration reflects the real variety in production, not a stale
snapshot. **5-6's branch is untouched** — it still returns its fixed
`[COURAGE, HONESTY]` pair; that logic and its rationale (one virtue + one flaw
representative) isn't part of this pilot.

```ts
export const getRegisterReferences = (ageBand: AgeBand = '5-6'): readonly Exemplar[] =>
  ageBand === '3-4'
    ? EXEMPLARS.filter((e) => e.ageBand === '3-4')
    : [COURAGE, HONESTY];
```

This also happens to close a Minor finding from #196's final whole-branch
review ("register-reference pair could drift from EXEMPLARS order") — for
3-4 it's now derived, not hand-duplicated.

## Test strategy

Randomizing selection breaks tests that assert exact deterministic output.
Rewrite affected tests in `exemplars.spec.ts`:

- `pickExemplar('Доброта', 'virtue', '3-4')`: assert the result's `ageBand`
  is `'3-4'` and its `text` is one of `[KINDNESS_3_4.text, SHELTER_3_4.text]`
  — not a single fixed value.
- `pickExemplar('Неизвестная цель', 'virtue', '3-4')` (fallback path): same
  shape, now against the 3-exemplar pool.
- **New test:** call `pickExemplar('Доброта', 'virtue', '3-4')` ~30 times
  without mocking `Math.random` and assert **both** KINDNESS_3_4 and
  SHELTER_3_4 appear at least once — proves the pool is actually reachable,
  not just structurally plausible. (P(missing one branch in 30 fair-coin
  trials) ≈ 2 × 0.5³⁰ ≈ 2×10⁻⁹ — not a flake risk in practice.)
- `getRegisterReferences('3-4')`: update the existing "returns two 3-4
  exemplars" assertion to "returns **three**", all with `ageBand === '3-4'`.
- All 5-6 and flaw-arc tests are unaffected (branch untouched) — must stay
  green unmodified, confirming the isolation.
- `judge.prompt.spec.ts`'s 3-4 test (checks the system prompt contains
  'Катя' and 'Мишка') should still pass since both original exemplars remain
  in the reference block — verify it doesn't need adjustment, don't assume.

## Accepted consequence: `eval:text`/`eval:batch` become non-deterministic for this goal

Running `eval:text "Доброта" 3` (or the `eval:batch` cases already added in
#262: `Доброта age 4`, `Забота о младших age 3`) will now sometimes render
the frog/cloud/kitten skeleton and sometimes the shelter skeleton. This is
the intended effect (production finally has real variety), not a harness
bug — noting it explicitly so a future baseline diff isn't misread as
prompt drift when it's actually just which exemplar got sampled.

## Out of scope / explicit non-goals

- No changes to 5-6, to flaw arcs, or to any goal other than Доброта/3-4.
- No retuning of `buildJudgeSystemPrompt`, `buildProseSystemPrompt`, or any
  other prompt — the register-calibration machinery is not the bottleneck
  here, plot variety is.
- No attempt to make `pickExemplar`'s randomness seedable/reproducible per
  book — out of scope for a pilot; revisit only if the batch harness's
  non-determinism turns out to be a real problem in practice.

## Success criteria

- `pickExemplar('Доброта', 'virtue', '3-4')` reachably returns both
  KINDNESS_3_4 and SHELTER_3_4 across repeated calls.
- All existing 5-6 and flaw-arc tests pass unmodified.
- `pnpm --filter backend test exemplars` and `judge.prompt` green.
- `./init.sh` green.
- One live `eval:text "Доброта" 3 child` (or a few, since output is now
  random) manually read to confirm the shelter-skeleton story reads well —
  same bar as #196's manual QA, not a new gate.
