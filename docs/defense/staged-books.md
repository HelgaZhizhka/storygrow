# StoryGrow — Staged Books (Fallback Plan)

Use these pre-generated books if the live demo fails (OpenAI outage, network issues, slow generation).

---

## Pre-generated books

### Book 1 — Custom Flow with visible retry

> ⚠️ **Re-stage before the defense.** This book was generated before the
> `engagement` criterion was added (#161), so its `StoryEval` rows hold **5**
> criteria, not the current 6 — and its `title` is empty in the DB (the value
> below is the intended title, not what's stored). Regenerate a fresh fallback
> book under the current 6-criteria pipeline and update the ID/scores/title here.

| Field | Value |
|---|---|
| **Title** | «Алиса и сила доброты» |
| **ID** | `cmpzhjeac0000m2lpzi7sj5q3` |
| **Status** | `ready` |
| **Pages** | 10 (with AI illustrations) |
| **StoryEval rows** | 2 |
| **Attempt 1** | score 9.8 / 10, `passed = false` — language purity check caught an English word in the story; deterministic gate blocked it despite the high judge score |
| **Attempt 2** | score 10.0 / 10, `passed = true` — perfect scores across all five criteria |

**Local URL:** `http://localhost:3000/books/cmpzhjeac0000m2lpzi7sj5q3`

**Demo talking point:**  
> «Первая версия получила 9.8 от судьи — но не прошла детерминированную проверку языковой чистоты: в тексте оказалось английское слово. Система автоматически перегенерировала историю с явным фидбеком в промпте. Вторая версия — 10/10 по всем пяти критериям.»

**Judge scores (attempt 1):**
```json
{ "ageAppropriateVocab": 10, "hasMoralLesson": 10, "structureCompleteness": 10, "safetyForChildren": 10, "length": 9 }
```
**Judge scores (attempt 2):**
```json
{ "ageAppropriateVocab": 10, "hasMoralLesson": 10, "structureCompleteness": 10, "safetyForChildren": 10, "length": 10 }
```

---

## Before the defense

Run through this checklist on the morning of defense day:

- [ ] `docker compose up -d` — postgres, redis, minio, langfuse all green
- [ ] `pnpm --filter backend dev` and `pnpm --filter frontend dev` both running
- [ ] Open `http://localhost:3000/books/cmpzhjeac0000m2lpzi7sj5q3` — confirm book detail renders with images
- [ ] Open `http://localhost:3000/admin/metrics` — confirm metrics load
- [ ] Open `http://localhost:3030` (LangFuse) — confirm traces visible for the cmpzhjeac book
- [ ] Open `http://localhost:3000/books` — confirm books list renders with StatusBadge

## Fallback trigger conditions

| Condition | Action |
|---|---|
| OpenAI API down | Skip Custom Flow live demo; open `cmpzhjeac0000m2lpzi7sj5q3` directly and narrate from it |
| Generation taking >5 min | Open the staged book; say "let me show you a previously generated example" |
| Frontend won't start | Show the book detail page from screenshots in this doc or show LangFuse traces + raw API responses |
| LangFuse down | Skip the LangFuse tab; mention traces are there but skip the live view |

## How to add more staged books

If time allows before the defense, generate 1–2 additional books:

1. One **Fast Flow** book (demonstrates the sync path, ~3 s)
2. One **Custom Flow** book with a different learning goal (demonstrates variety)

Add their IDs here after generation.
