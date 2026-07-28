# Custom learning goal — live verification on novel topics

Task 8 of `docs/superpowers/plans/2026-07-28-custom-learning-goal.md`. Mandatory per `AGENTS.md`'s "Done is not a mood" — this feature makes every generation go through `pickExemplar`'s random-pool fallback by default (previously the rare case for a curated goal with no exemplar; now the default for every custom goal), the same class of path #313 fixed. Verified end-to-end via `eval:text` on 4 topics with **no backing `LearningGoal` row** (confirmed via `backend/src/scripts/lib/eval-run.ts:72-78` — when no row matches, it falls through to the raw topic string and defaults `arcType` to `'virtue'`, exactly matching `createCustomLearningGoal`'s own default).

Run: 2026-07-28, model defaults (plan: gpt-4o, prose: gpt-5, judge: gpt-4o-mini).

Two runs (topics 2 and 3) hit a transient `HeadersTimeoutError` against OpenAI on the first attempt (all 3 concurrent `eval:text` invocations sharing the same gpt-5 congestion) — not a pipeline defect; both passed cleanly on a sequential retry.

| Topic | Age | Mode | Title | Result | registerMatch | Notes |
|---|---|---|---|---|---|---|
| Любовь к чтению | 5 | child | «Алиса и исчезнувшая книжка под кроватью» | PASS | 8/10 | Lost book → search → found → love of reading. Distinct plot, no refrain artifact. |
| Уважение к чужому мнению | 6 | child | «Алиса и пирамидка с сюрпризами» | PASS | 8/10 | Friend suggests a different way to play → hero accepts → builds together. On-topic, no bleed from an unrelated exemplar. |
| Терпение в очереди | 4 | child | «Алиса и мороженая считалочка» | PASS | 8/10 | 3-4 band's own repeated-refrain-by-design ("Я подожду, я подожду") — invented fresh for THIS topic, not copied from a mismatched exemplar. This is the exact distinction between the legitimate 3-4 craft device and the #313 bug. |
| Бережное отношение к книгам | 6 | observer | «Миша и мокрые страницы» | PASS | 7/10 | Honest pass right at the threshold, not padded. Book gets wet → dried carefully → lesson on care. |

**Pass rate: 4/4 (100%).** All four topics produced genuinely distinct, on-topic plots — no shared skeleton, no cross-topic refrain bleed, no #312/#313-style convergence. `registerMatch` held 7-8/10 across all four, consistent with the post-#313 production baseline (`docs/process/eval-baselines/2026-07-25-plan-invent-scenario.json`, mean 7.9).

**Conclusion:** the exemplar-fallback path (#313's fix) holds for genuinely novel, uncurated topics — not just the curated goals it was originally verified against. The custom-learning-goal feature (issue #323) is safe to ship on the existing pipeline without a dedicated no-exemplar experiment.
