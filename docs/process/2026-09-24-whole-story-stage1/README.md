# Whole-story stage 1 — research record (STO-15)

Text-only dry runs of the whole-story text pipeline (ADR-0008, spec 2026-09-23 §8 stage 1). Each round is a frozen directory copied verbatim from `backend/output/whole-story/<run>/`: `manifest.json` (prompt fingerprint, models, cases), `calls.json` (every model call with full prompts, model id, usage, timing, trace id, result or error), `results.json` (gates, safety verdict, judge v2), `metrics.json`, `blind-key.json`, `reading.html` / `reading.json` (the blind document). Nothing is edited after the run. Costs are LangFuse estimates.

Harness: `pnpm --filter backend eval:whole-story` (`backend/src/scripts/eval-whole-story.ts`). Prompts: `backend/src/ai/prompts/{whole-story,story-safety,judge-v2}.prompt.ts`, version `2026-09-24-v2`.

## r1 — 2026-09-24, three goals, prompt v2 (`r1/`)

Cases: Доброта, Смелость, Дружба · hero Алиса, 6 · author gpt-5-2025-08-07, safety gpt-4o-2024-08-06, judge gpt-4o-mini-2024-07-18 · git head `e956ac3`.

| case | title | words | gates | safety | judge lang/caus/goal/age/title |
| --- | --- | --- | --- | --- | --- |
| case-1-1 | «Алиса и очередь для качелей» | 490 | pass | pass | 8/9/9/10/7 |
| case-2-1 | «Алиса и карманная смелость» | 455 | fail — title names the value | pass | 9/8/9/10/7 |
| case-3-1 | «Беличий хвостик для двоих» | 416 | pass | pass | 8/9/8/10/7 |

9/9 traces retrieved from LangFuse (3 observations each); total $0.14. All three inside the 350–550 band (the pilot's 6/6 overshoot did not recur — an observation, not a proof).

**Owner verdict (relayed by local Codex, 2026-09-24): all three rejected as artistically unusable, the titles above all. No gold text.** The dissatisfaction is not about length or typography.

**Editorial notes (Claude Code, before the verdict).** All three open with «Алисе шесть лет.» — an echo of the hero line in the user prompt; all three are built as attempt → attempt → success, which the 5–6 profile literally prescribes. Direct speech is glued into paragraphs after a colon. Slips: «ДЕСЯТЬ КАЧЕЙ», «тихо-весело», «сказала умным голосом», «щёлкнула» ×3. Residual ornament: «внутри запрыгали воробьи», «сердце лупило, как молоточек по барабану», «как будто подарила лесу ночь». Judge v2 is unreliable on titles (it proposed «Алиса и Заяц смелости», which also names the value). «Дружба» is structurally a flaw arc (bossing → withdrawal → apology).

**Codex notes.** In «качели» a logical slip: Алиса points at a «свободное сиденье» while Маша is still on the swing; judge causality 9 did not reflect it. The brief's pedagogical wording and the long safety block's pull toward a domestic setting are hypotheses, not established causes.

**Safety-gate negative control** (`safety-negative-control.ts`, one-off, gpt-4o): an imitable dangerous act shown as brave → `fail` with three cited reasons (went out alone; approached and petted an unknown dog; rewarded); a fairy-tale Wolf beaten by wit → `pass`.

## r2 — single-variable diagnostic (protocol fixed before any call)

Protocol by local Codex, 2026-09-24. **One variable.** Goal Доброта only; same hero, models, parameters, word range, schema, safety gate and informational judge as r1.

- **A** — the r1 author prompt, byte for byte (`buildAuthorSystem('5-6', 'A')`).
- **B** — the 5–6 age profile **without** the sentence «одна главная трудность, к которой герой подступается два-три раза по-разному». Nothing else changes: hero line, brief, safety block, title rules, genre — identical.

Diff of the only changed paragraph (A → B):

```
- Слушателю 5–6 лет. Герой и два-три участника; одна главная трудность, к которой герой подступается два-три раза по-разному. Предложения разной длины, много живого диалога; причины и следствия ясны из событий. Часть детей этого возраста уже читает сама — пусть речь персонажей нельзя перепутать, а фразы не требуют объяснений.
+ Слушателю 5–6 лет. Герой и два-три участника. Предложения разной длины, много живого диалога; причины и следствия ясны из событий. Часть детей этого возраста уже читает сама — пусть речь персонажей нельзя перепутать, а фразы не требуют объяснений.
```

Budget: **at most four author calls** — two A, two B — no automatic retries beyond the harness's `maxRetries: 0`, no literary editing, no extra calls to compensate a technical failure. Stop after four. The blind package (`reading.html`, no judge scores, no key) goes to local Codex first; all four results are reported, never only the best. This tests one source of sameness; it does not promise to fix the other defects and cannot prove reliability at n = 2 per arm.

Known confounds held equal in both arms and therefore not attributable to either: the «Алисе шесть лет» opening echo (hero line), the domestic-setting pull (safety block). They are the next single-variable hypotheses if B shows no movement.

No further round is started automatically after r2.
