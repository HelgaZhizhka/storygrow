# Exemplar-Variety Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the single-plot-skeleton sameness in the 3-4 band's Доброта generations by adding a second, structurally distinct Gold Exemplar and switching `pickExemplar`/`getRegisterReferences` from deterministic-first-match to pooled-random selection.

**Architecture:** One new `Exemplar` constant (`SHELTER_3_4`, "Под грибом"-inspired shelter/inclusion premise) is added alongside the existing `FEAR_3_4`/`KINDNESS_3_4`. `pickExemplar` changes from "first match wins" to "collect all matches (or, on no match, the whole in-band pool), pick one at random" — so repeated generations for the same goal now genuinely vary. `getRegisterReferences('3-4')` is derived from the same pool instead of a hand-maintained pair, so the judge always sees the full current set of 3-4 exemplars.

**Tech Stack:** NestJS, TypeScript strict, Jest, pnpm workspaces. No schema/API changes — this plan touches exactly one prompt-support file and its spec.

## Global Constraints

- Package manager: `pnpm` only. Backend commands: `pnpm --filter backend <script>`.
- TypeScript strict, no `any`. No `@ts-ignore`, no `console.log` in committed code.
- Conventional Commits for every commit: `type(area): subject`. NO `Co-Authored-By` trailer.
- `AgeBand` values are the string literals `'3-4'` and `'5-6'` — never other spellings.
- Scope is Доброта/3-4 only. Do NOT touch 5-6's `COURAGE`/`KINDNESS`/`INDEPENDENCE`/`HONESTY`/`IMPULSE`/`WANTING` exemplars, `getRegisterReferences`'s 5-6 branch, or any other 3-4 goal's exemplar (`FEAR_3_4` stays as-is, content-wise).
- 3-4 stays virtue-only (ADR-0005) — `SHELTER_3_4` has `arcType: 'virtue'`. No flaw work in this plan.
- `pickExemplar`'s and `getRegisterReferences`'s public signatures are UNCHANGED (same params, same return type) — only internal selection logic changes.
- Design source of truth: `docs/superpowers/specs/2026-07-20-exemplar-variety-pilot-design.md` — the exact exemplar text and code sketches there are canonical; this plan transcribes them.

---

### Task 1: Add the `SHELTER_3_4` exemplar (content only, no selection-logic change yet)

**Files:**
- Modify: `backend/src/ai/prompts/exemplars.ts` (add one new const + register it in `EXEMPLARS`)

**Interfaces:**
- Consumes: nothing new — `Exemplar` interface (existing).
- Produces: a new module-private `SHELTER_3_4: Exemplar` constant, appended to the exported `EXEMPLARS` array. `pickExemplar`/`getRegisterReferences` are NOT modified in this task — `SHELTER_3_4` is inert (unreachable) until Task 2/3, because `pickExemplar`'s current `.find()` still returns `KINDNESS_3_4` first (declared earlier in the array) for any exact 'Доброта'-family match, and its fallback still returns `inBand[0]` (`FEAR_3_4`). This task is safe to commit and test in isolation: every existing test must stay green unmodified.

- [ ] **Step 1: Confirm the baseline is green before touching anything**

This task has no independently observable behavior change by design — see
"Interfaces" above: `EXEMPLARS` is module-private, and `pickExemplar` still
deterministically ignores `SHELTER_3_4` until Task 2 changes its selection
logic. There is nothing to assert from outside the module yet, so there is no
new test to write in this task (Task 2 adds the tests that actually observe
`SHELTER_3_4`). Confirm the pre-change baseline instead:

Run: `pnpm --filter backend test exemplars`
Expected: PASS (existing suite, unmodified).

- [ ] **Step 2: Add the `SHELTER_3_4` constant**

In `backend/src/ai/prompts/exemplars.ts`, insert after the `KINDNESS_3_4` constant (after line 160, before the `// Order is fallback priority...` comment):

```ts
/**
 * SHELTER_3_4 (exemplar-variety pilot, 2026-07-20) — second Доброта/3-4
 * exemplar. Structurally distinct from KINDNESS_3_4: a widening-circle
 * shelter/inclusion premise ("Под грибом"-inspired), not a single give-or-not
 * choice. `pickExemplar` pools this with KINDNESS_3_4 and picks randomly
 * (Task 2) so repeated Доброта/3-4 generations stop reusing one skeleton.
 */
const SHELTER_3_4: Exemplar = {
  goalTitles: ['Доброта', 'Сочувствие', 'Забота о младших'],
  arcType: 'virtue',
  ageBand: '3-4',
  text: `Название: «Юра и лист-домик»  (тип конфликта: социальный / доброта, укрытие)
[Завязка] Пошёл дождь. Юра нашёл большой лист — вот и домик! Сидит Юра, слушает дождик.
[Трудность] Прибежал мокрый жучок. «Пусти под лист!» — пищит жучок. Юра смотрит: место совсем маленькое.
[Попытка с повтором] «Тесно? Не тесно?» — думает Юра. Подвинулся. Жучок сел рядом. «Вот и не тесно!»
[Развязка] Прискакала мокрая лягушка: «Пустите!» «Тесно? Не тесно?» — думает Юра. Все подвинулись. Место нашлось!
[Закрепление] Дождь кончился. Вылезли все втроём — весёлые, сухие, дружные.
[Финал] Поделиться местом — это тоже доброта.
Вопросы: 1. Что нашёл Юра от дождя? 2. Кто первым попросился под лист? 3. Что думал Юра — тесно или нет? 4. Сколько зверей поместилось? 5. А ты можешь потесниться для друга?`,
};
```

Update the `EXEMPLARS` array (currently lines 162-173) to register it:

```ts
// Selection is pooled-random (see pickExemplar) — declaration order here no
// longer determines which exemplar is picked when multiple match.
const EXEMPLARS: readonly Exemplar[] = [
  COURAGE,
  KINDNESS,
  INDEPENDENCE,
  HONESTY,
  IMPULSE,
  WANTING,
  FEAR_3_4,
  KINDNESS_3_4,
  SHELTER_3_4,
];
```

(This comment text anticipates Task 2's behavior change. It is accurate to write now since Task 1 and Task 2 land together in normal review flow, but if Task 1 is reviewed standalone before Task 2 exists, note in your report that the comment is temporarily ahead of the code — this is intentional, not a bug, and Task 2 makes it accurate.)

- [ ] **Step 3: Run the full exemplars test file to confirm nothing broke**

Run: `pnpm --filter backend test exemplars`
Expected: PASS — same test count as before this task (no new tests added, since Task 1 has no independently observable behavior — see Step 1 note above), all green. This confirms `SHELTER_3_4` is syntactically valid and doesn't disturb existing deterministic selection (still inert).

- [ ] **Step 4: Run backend typecheck**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/prompts/exemplars.ts
git commit -m "feat(ai): add SHELTER_3_4 exemplar (exemplar-variety pilot)

Second Доброта/3-4 Gold Exemplar — shelter/inclusion premise, structurally
distinct from KINDNESS_3_4's give-an-object skeleton. Inert until Task 2
changes pickExemplar to pool multiple matches instead of first-match-wins.

Refs #264"
```

---

### Task 2: `pickExemplar` — pooled random selection

**Files:**
- Modify: `backend/src/ai/prompts/exemplars.ts:14-23` (module doc comment) and `:183-201` (`pickExemplar` + its doc comment)
- Modify: `backend/src/ai/prompts/exemplars.spec.ts` (rewrite 2 existing tests, add 1 new test)

**Interfaces:**
- Consumes: `SHELTER_3_4` (Task 1, now reachable).
- Produces: `pickExemplar(goalTitle, arcType, ageBand?)` — SAME signature and return type (`Exemplar`), internal selection logic changes from deterministic to pooled-random via `Math.random()`.

- [ ] **Step 1: Write the failing tests**

In `backend/src/ai/prompts/exemplars.spec.ts`, replace the two tests that assert single deterministic 3-4 content (currently lines 40-50, inside the `describe('pickExemplar — 3-4 band', ...)` block):

```ts
  it('falls back to one of the 3-4 virtue pool for an unmatched goal', () => {
    const ex = pickExemplar('Неизвестная цель', 'virtue', '3-4');
    expect(ex.ageBand).toBe('3-4');
    expect(['Катя', 'Мишка', 'Юра'].some((hero) => ex.text.includes(hero))).toBe(true);
  });

  it('routes Доброта to one of the two 3-4 kindness-family exemplars (KINDNESS_3_4 or SHELTER_3_4)', () => {
    const ex = pickExemplar('Доброта', 'virtue', '3-4');
    expect(ex.ageBand).toBe('3-4');
    expect(['Мишка', 'Юра'].some((hero) => ex.text.includes(hero))).toBe(true);
  });

  it('reaches both KINDNESS_3_4 and SHELTER_3_4 across repeated calls (pooled-random selection)', () => {
    const heroesSeen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const ex = pickExemplar('Доброта', 'virtue', '3-4');
      if (ex.text.includes('Мишка')) heroesSeen.add('Мишка');
      if (ex.text.includes('Юра')) heroesSeen.add('Юра');
    }
    expect(heroesSeen).toEqual(new Set(['Мишка', 'Юра']));
  });
```

Leave the OTHER two tests in that `describe` block unchanged (they are unaffected by this task — verify this yourself against the file before editing, don't assume):
- `'routes a 3-4 virtue goal to a 3-4 exemplar, never a 5-6 one'` (uses `'Смелость'` — only `FEAR_3_4` matches this title; `SHELTER_3_4`'s `goalTitles` don't include it, so this stays a single-candidate, deterministic pool).
- `'omitting ageBand still returns a 5-6 exemplar (default unchanged)'` (5-6 branch, untouched by this task).

- [ ] **Step 2: Run tests to verify the new/changed ones fail**

Run: `pnpm --filter backend test exemplars`
Expected: FAIL — the rewritten `'routes Доброта to...'` test still passes trivially today (current code deterministically returns `KINDNESS_3_4`, which is one of the two allowed heroes, so this particular assertion won't fail pre-change — that's fine, it's a permissive assertion). The NEW test `'reaches both KINDNESS_3_4 and SHELTER_3_4...'` MUST fail before this task's code change: today's code always returns `KINDNESS_3_4` (deterministic first match) for `'Доброта'`, so `heroesSeen` will only ever contain `{'Мишка'}`, never `{'Мишка', 'Юра'}` — confirm this specific test fails with a message like `expected Set{"Мишка"} to equal Set{"Мишка", "Юра"}`.

- [ ] **Step 3: Rewrite `pickExemplar` and its doc comment**

In `backend/src/ai/prompts/exemplars.ts`, replace the `pickExemplar` doc comment and function body (currently lines 183-201):

```ts
/**
 * Pick an exemplar for the given (goalTitle, arcType, ageBand). Pools ALL
 * exemplars whose `goalTitles` contains the requested title within that
 * (arcType, ageBand); if none match, pools the whole (arcType, ageBand) set
 * instead (fallback). Picks uniformly at random from the resulting pool —
 * this is deliberate (exemplar-variety pilot, 2026-07-20): a fixed
 * first-match-wins pick meant every generation for a given goal reused the
 * same plot skeleton. Throws if the pool is empty (only possible for
 * 3-4 + flaw, which should never be requested — see getBeatSheet's
 * equivalent guard).
 */
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

Also update the module-level doc comment's ordering note (currently lines 18-22 — the paragraph starting "IMPORTANT for `EXEMPLARS` ordering"):

```ts
 * Selection (`pickExemplar`) pools every exemplar matching a request and
 * picks uniformly at random — declaration order in `EXEMPLARS` below does
 * NOT determine which one is returned. This is deliberate: it lets a goal
 * with multiple exemplars (e.g. Доброта/3-4) vary its plot skeleton across
 * generations instead of always reusing the same one.
```

(This replaces the old "declaration order IS fallback priority" paragraph — delete that paragraph entirely, replace with the above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter backend test exemplars`
Expected: PASS — all tests in the file green, including the new 30-call reachability test. (If the reachability test is flaky over multiple CI runs — it shouldn't be, P(failure) ≈ 2×10⁻⁹ per the design doc's math — do not raise the trial count or add retries; investigate `Math.random()` usage for a bug instead, e.g. an off-by-one in `Math.floor(Math.random() * candidates.length)`.)

- [ ] **Step 5: Run backend typecheck**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/ai/prompts/exemplars.ts backend/src/ai/prompts/exemplars.spec.ts
git commit -m "feat(ai): pickExemplar pools matches and picks randomly

Was first-match-wins (exact title match, else EXEMPLARS[0] for that
arc+band) — deterministic, so every generation for a goal with a
dedicated exemplar always reused the same plot skeleton. Now pools all
matches (or the whole in-band set on no match) and picks uniformly at
random. Signature unchanged. Доброта/3-4 now genuinely alternates between
KINDNESS_3_4 and SHELTER_3_4 across generations.

Refs #264"
```

---

### Task 3: `getRegisterReferences('3-4')` — derive from the pool instead of a hardcoded pair

**Files:**
- Modify: `backend/src/ai/prompts/exemplars.ts:175-181` (`getRegisterReferences` + its doc comment)
- Modify: `backend/src/ai/prompts/exemplars.spec.ts:58-63` (update the length assertion)
- Verify only (no code change expected): `backend/src/ai/prompts/judge.prompt.spec.ts`

**Interfaces:**
- Consumes: `EXEMPLARS` (module-private, already includes `SHELTER_3_4` from Task 1).
- Produces: `getRegisterReferences(ageBand?)` — SAME signature and return type (`readonly Exemplar[]`). For `'3-4'`, now returns ALL 3-4 exemplars (3, after Task 1) instead of a hardcoded 2. For `'5-6'` (default), UNCHANGED — still exactly `[COURAGE, HONESTY]`.

- [ ] **Step 1: Write the failing test**

In `backend/src/ai/prompts/exemplars.spec.ts`, replace the first test in the `describe('getRegisterReferences — 3-4 band', ...)` block (currently lines 59-63):

```ts
  it('returns all three 3-4 virtue exemplars (no flaw counterpart exists for 3-4)', () => {
    const refs = getRegisterReferences('3-4');
    expect(refs).toHaveLength(3);
    expect(refs.every((e) => e.ageBand === '3-4')).toBe(true);
  });
```

Leave the second test in that block (`'omitting ageBand still returns the original 5-6 pair'`) unchanged — 5-6 is untouched by this task.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test exemplars`
Expected: FAIL — current `getRegisterReferences('3-4')` returns exactly `[FEAR_3_4, KINDNESS_3_4]` (length 2), so `expect(refs).toHaveLength(3)` fails.

- [ ] **Step 3: Rewrite `getRegisterReferences`**

In `backend/src/ai/prompts/exemplars.ts`, replace (currently lines 175-181):

```ts
/**
 * Register-reference exemplars shown to the judge to anchor the target
 * register for Register Match scoring, per age band. For 5-6, a fixed
 * virtue+flaw pair (COURAGE, HONESTY) — untouched by the exemplar-variety
 * pilot. For 3-4 (virtue-only, ADR-0005), ALL 3-4 exemplars in the pool —
 * derived, not hand-maintained, so the judge always sees the full current
 * set instead of a pair that can drift out of sync with EXEMPLARS.
 */
export const getRegisterReferences = (ageBand: AgeBand = '5-6'): readonly Exemplar[] =>
  ageBand === '3-4' ? EXEMPLARS.filter((e) => e.ageBand === '3-4') : [COURAGE, HONESTY];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter backend test exemplars`
Expected: PASS.

- [ ] **Step 5: Verify `judge.prompt.spec.ts` still passes unmodified**

Run: `pnpm --filter backend test judge.prompt`
Expected: PASS with no code changes to `judge.prompt.ts` or `judge.prompt.spec.ts`. This file's 3-4 test asserts the system prompt contains `'Катя'` (FEAR_3_4's hero) and `'Мишка'` (KINDNESS_3_4's hero) and does NOT assert exclusivity (no `.not.toContain(...)` for any other hero name) — both original heroes remain in the now-3-exemplar reference block, so this should pass with no edits. If it fails, STOP and report — do not silently patch `judge.prompt.ts` to route around it; investigate whether the failure is a real regression or a stale/over-specific assertion, and report which.

- [ ] **Step 6: Run backend typecheck**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/ai/prompts/exemplars.ts backend/src/ai/prompts/exemplars.spec.ts
git commit -m "feat(ai): getRegisterReferences('3-4') derives from the full exemplar pool

Was a hand-maintained [FEAR_3_4, KINDNESS_3_4] pair — now
EXEMPLARS.filter(ageBand === '3-4'), so it automatically includes
SHELTER_3_4 and can't drift out of sync with the pool again. 5-6's
[COURAGE, HONESTY] pair is untouched.

Refs #264"
```

---

### Task 4: Integration verification

**Files:** none (verification only — if this task finds a bug, stop and fix it as its own properly-tested commit before proceeding, do not patch silently).

- [ ] **Step 1: Full backend smoke check**

Run: `pnpm --filter backend exec tsc --noEmit && pnpm --filter backend lint && pnpm --filter backend test`
Expected: all green. Full suite (not just `exemplars`/`judge.prompt`) — confirms nothing outside this plan's 3 files regressed (e.g. `plan.prompt.spec.ts`, `prose.prompt.spec.ts`, `story-generator.service.spec.ts` all call `pickExemplar` indirectly through fixtures).

- [ ] **Step 2: `./init.sh` from repo root**

Run: `./init.sh`
Expected: exits 0.

- [ ] **Step 3: Ensure local infra is up**

Run: `docker compose ps --format "table {{.Service}}\t{{.Status}}"`
Expected: `postgres` and `redis` `healthy`/`Up`. If not: `docker compose up -d postgres redis`.

- [ ] **Step 4: Live `eval:text` checks — observe the variety**

Run this three times in a row (same command, to sample the random pool):

```bash
pnpm --filter backend eval:text "Доброта" 3 child
```

Expected: no `structural` error on any run; `registerMatch` reasonable (≥7) on each. Manually read the printed pages across the 3 runs — confirm you see BOTH skeletons appear at least once across the 3 runs (frog/cloud/kitten-style "lonely creature, share an object" AND the new "widening shelter" skeleton with a refrain like "Тесно? Не тесно?"). If all 3 runs show the same skeleton, that's not necessarily a bug (3 samples from a 50/50 pool have a 25% chance of matching) — re-run a few more times before concluding something is wrong.

- [ ] **Step 5: Final commit (if Steps 1-4 required any fixes) or close out**

If all checks passed with no code changes needed, there is nothing to commit here — proceed to opening the PR for the `issue/264-...` branch per the project's git workflow (`docs/adr/0001-git-workflow.md`): `gh pr create` with `Closes #264`, then squash-merge after `./init.sh` is green.
