# StoryGrow — Staged Books (Fallback Plan)

Use these pre-generated books if the live demo fails (OpenAI outage, network issues, slow generation).

---

## Pre-generated books

### Book 1 — Custom Flow (re-staged 2026-07-24, current pipeline)

Generated under the current Plan→Prose pipeline (ADR-0005) via the double-gated
`/auth/test-login` fixture — passed on the **first** attempt, so this is the
"clean pass" branch of `demo-script.md`'s outcome-conditional narration, not
the "needed a retry" branch. That's fine to narrate as-is (see the demo
script's "Если попыток 1" line) — don't force a retry story that didn't
happen.

| Field | Value |
|---|---|
| **Title** | «Алиса и волшебный цветок на площадке» |
| **ID** | `cmrz2l4mp0003u7kxhsr5uxq5` |
| **Status** | `ready` |
| **Pages** | 8 (with AI illustrations) |
| **StoryEval rows** | 1 |
| **Attempt 1** | score 9 / 10 (`registerMatch`), `passed = true` — all four gates cleared on the first attempt |

**Local URL:** `http://localhost:3000/books/cmrz2l4mp0003u7kxhsr5uxq5`

**Demo talking point:**
> «Прошла с первой попытки, registerMatch 9 из 10 — все четыре гейта (структура, языковая чистота, шесть guardrail-критериев, craft-сигнал регистра) сошлись сразу.»

**Judge scores (attempt 1) — current 7-field `JudgeScoreSchema`:**
```json
{ "length": 10, "registerMatch": 9, "hasMoralLesson": 9, "earnedResolution": 8, "safetyForChildren": 10, "ageAppropriateVocab": 10, "structureCompleteness": 8 }
```

---

## Before the defense

Run through this checklist on the morning of defense day:

- [ ] `docker compose up -d` — postgres, redis, minio, langfuse all green
- [ ] `pnpm --filter backend dev` and `pnpm --filter frontend dev` both running
- [ ] Open `http://localhost:3000/books/cmrz2l4mp0003u7kxhsr5uxq5` — confirm book detail renders with images
- [ ] Open `http://localhost:3000/admin/metrics` — confirm metrics load
- [ ] Open `http://localhost:3030` (LangFuse) — confirm the `story-generation` trace is visible for the fallback book
- [ ] Open `http://localhost:3000/books` — confirm books list renders with StatusBadge

## Fallback trigger conditions

| Condition | Action |
|---|---|
| OpenAI API down | Skip Custom Flow live demo; open `cmrz2l4mp0003u7kxhsr5uxq5` directly and narrate from it |
| Generation taking >5 min | Open the staged book; say "let me show you a previously generated example" |
| Frontend won't start | Show the book detail page from screenshots in this doc or show LangFuse traces + raw API responses |
| LangFuse down | Skip the LangFuse tab; mention traces are there but skip the live view |

## How to add more staged books

If time allows before the defense, generate 1–2 additional books:

1. One **Fast Flow** book (demonstrates the sync path, ~3 s)
2. One **Custom Flow** book with a different learning goal (demonstrates variety)

Add their IDs here after generation.
