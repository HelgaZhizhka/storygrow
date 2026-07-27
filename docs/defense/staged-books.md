# StoryGrow — Staged Books (Fallback Plan)

Use these pre-generated books if the live demo fails (OpenAI outage, network issues, slow generation).

---

## Pre-generated books

### Book 1 — Custom Flow (re-staged 2026-07-26, post-#313 pipeline)

Generated 2026-07-26 — **after** PR #313 (Plan phase invents its own scenario
instead of copying the exemplar's plot). Superseded the previous Book 1
(generated 2026-07-24, one day *before* #313), which was never verified
against the fix and got retired rather than risk it being read closely by
someone right after the #313 story on slide 7.

Manually verified by reading the full story text in Postgres directly (not
just the score): no «Х? Не Х?»-style repeated-refrain pattern anywhere —
varied, natural prose. Passed on the **first** attempt, so this is the
"clean pass" branch of `demo-script.md`'s outcome-conditional narration, not
the "needed a retry" branch — narrate as-is (see the demo script's "Если
попыток 1" line), don't force a retry story that didn't happen.

> **Heads-up, not a bug:** the child's name in this profile is literally
> «Алиссы» (not «Алиса») — a likely typo from when the test child was
> created, not a generation defect. The story correctly uses whatever
> `heroName` it was given. It'll be visible on every page if shown live —
> know it's coming, don't let it look like you didn't notice.

| Field | Value |
|---|---|
| **Title** | «Алиссы и секрет ожившего цветка» |
| **ID** | `cms1uhlju000381kxjq1plg8d` |
| **Status** | `ready` |
| **Pages** | 7 (with AI illustrations) |
| **Learning goal** | Доброта |
| **StoryEval rows** | 1 |
| **Attempt 1** | score 8 / 10 (`registerMatch`), `passed = true` — all four gates cleared on the first attempt |

**Local URL:** `http://localhost:3000/books/cms1uhlju000381kxjq1plg8d`

**Demo talking point:**
> «Прошла с первой попытки, registerMatch 8 из 10 — все четыре гейта (структура, языковая чистота, шесть guardrail-критериев, craft-сигнал регистра) сошлись сразу.»

**Judge scores (attempt 1) — current 7-field `JudgeScoreSchema`:**
```json
{ "length": 8, "registerMatch": 8, "hasMoralLesson": 9, "earnedResolution": 6, "safetyForChildren": 10, "ageAppropriateVocab": 10, "structureCompleteness": 9 }
```

Note: `vocabularyCompliance` on this row is `0` — an oddly extreme value
worth a second look sometime (not urgent, not user-facing, doesn't gate
anything — see slide 4/9's note on this field being unmonitored technical
debt), but not touching it two days before the defense.

---

## Before the defense

Run through this checklist on the morning of defense day:

- [ ] `docker compose up -d` — postgres, redis, minio, langfuse all green
- [ ] `pnpm --filter backend dev` and `pnpm --filter frontend dev` both running
- [ ] Open `http://localhost:3000/books/cms1uhlju000381kxjq1plg8d` — confirm book detail renders with images
- [ ] Open `http://localhost:3000/admin/metrics` — confirm metrics load
- [ ] Open `http://localhost:3030` (LangFuse) — confirm the `story-generation` trace is visible for the fallback book
- [ ] Open `http://localhost:3000/books` — confirm books list renders with StatusBadge

## Fallback trigger conditions

| Condition | Action |
|---|---|
| OpenAI API down | Skip Custom Flow live demo; open `cms1uhlju000381kxjq1plg8d` directly and narrate from it |
| Generation taking >5 min | Open the staged book; say "let me show you a previously generated example" |
| Frontend won't start | Show the book detail page from screenshots in this doc or show LangFuse traces + raw API responses |
| LangFuse down | Skip the LangFuse tab; mention traces are there but skip the live view |

## How to add more staged books

If time allows before the defense, generate 1–2 additional books:

1. One **Fast Flow** book (demonstrates the sync path, ~3 s)
2. One **Custom Flow** book with a different learning goal (demonstrates variety)

Add their IDs here after generation.
