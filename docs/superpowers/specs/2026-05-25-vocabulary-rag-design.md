# VocabularyRag Design — issues #8 + #9

**Date:** 2026-05-25  
**Status:** Approved  
**Closes:** #8 (corpus + seed script), #9 (VocabularyRagService)

---

## Problem

StoryGenerator needs age-appropriate vocabulary grounding when writing Russian stories for children ages 3–11. The LLM must know *which words are acceptable* at each age band — not just "write simply", but with a concrete lexical reference.

## Approach

**Russian frequency-based corpus as grading signal.**

Top ~1 500 Russian words from open frequency data, assigned to grade levels 0–4 by frequency quantile. At generation time, retrieve words that are both:
1. At or below the target grade level (SQL filter)
2. Semantically closest to the story topic + learning goal (embedding similarity)

This gives words that are *age-appropriate* **and** *contextually relevant* — e.g. for "story about friendship, grade 1": `друг, вместе, помочь, радость` rather than random grade-1 words.

## Grade Level Mapping

```
ageToGradeLevel(age: number): 0 | 1 | 2 | 3 | 4

age 3–4  → grade 0  (pre-school: service words, family, body, basic verbs)
age 5–6  → grade 1  (kindergarten: simple nouns/adjectives, play, nature)
age 7–8  → grade 2  (primary: narrative words, simple abstract concepts)
age 9–10 → grade 3  (middle primary: values, challenges, discovery)
age 11+  → grade 4  (upper primary: abstract nouns, consequence, achievement)
```

## Data: `backend/prisma/seed/vocabulary.csv`

Format: `word,gradeLevel,frequency`

- ~1 500 rows, grades 0–4 (~300 per grade)
- `word`: Russian lemma (nominative for nouns, infinitive for verbs)
- `gradeLevel`: 0–4 integer
- `frequency`: normalised rank score (1.0 = most frequent, decreasing)
- Checked into the repo — no external download needed at seed time

Grade boundaries (frequency-based):
| Grade | Frequency rank | Example words |
|---|---|---|
| 0 | top 1–300 | и, в, он, она, мама, дом, кот, да |
| 1 | 301–600 | друг, играть, большой, весёлый, лес |
| 2 | 601–900 | приключение, храбрый, помочь, найти |
| 3 | 901–1 200 | открывать, преодолевать, важный, решение |
| 4 | 1 201–1 500 | ответственность, настойчивость, достижение |

## Seed Script: `backend/src/scripts/seed-vocabulary.ts`

**Input:** `backend/prisma/seed/vocabulary.csv`  
**Output:** rows upserted into `VocabularyEntry`  
**Run:** `pnpm --filter backend seed:vocabulary`

Behaviour:
- Reads CSV, validates schema (Zod)
- Batches into groups of 512 (OpenAI max per embed call is 2048, 512 is safe)
- Calls `text-embedding-3-small` per batch → 1 536-dim vectors
- 200 ms delay between batches (rate-limit headroom)
- `upsert` on `word` — idempotent, safe to re-run
- Logs `[N/total] seeded` progress
- Requires `DATABASE_URL` and `OPENAI_API_KEY` in env

Cost estimate: 1 500 words × ~1 token/word = 1 500 tokens ≈ **$0.00003** (negligible).

## `VocabularyRagService`

**File:** `backend/src/ai/rag/vocabulary-rag.service.ts`  
**NestJS:** `@Injectable()`, provided in `AiModule`

### Interface

```typescript
interface RetrieveOptions {
  topic: string;        // story topic / theme
  learningGoal: string; // e.g. "научиться делиться"
  gradeLevel: number;   // 0–4, from ageToGradeLevel(child.age)
  topK?: number;        // default 80
}

retrieve(options: RetrieveOptions): Promise<string[]>
// returns array of Russian words ordered by relevance
```

### Query logic

```sql
SELECT word
FROM   "VocabularyEntry"
WHERE  "gradeLevel" <= $gradeLevel
  AND  embedding IS NOT NULL
ORDER BY embedding <=> $queryVector  -- cosine distance (pgvector <=>)
LIMIT  $topK
```

`$queryVector` = `embed("${topic} ${learningGoal}")` via Vercel AI SDK  
(`text-embedding-3-small`, 1 536 dims)

Uses `prisma.$queryRaw` with `Prisma.raw()` for the vector literal (safe: only floats, no user string).

### Error handling

- If `VocabularyEntry` table is empty → return `[]`, log warning (`logger.warn`)
- If OpenAI embed call fails → throw `InternalServerErrorException` (caller handles retry)
- Never throws on empty result set

## `ageToGradeLevel` helper

**File:** `backend/src/ai/rag/age-grade.map.ts`

```typescript
export const AGE_GRADE_MAP: ReadonlyArray<{ maxAge: number; grade: number }> = [
  { maxAge: 4,  grade: 0 },
  { maxAge: 6,  grade: 1 },
  { maxAge: 8,  grade: 2 },
  { maxAge: 10, grade: 3 },
  { maxAge: Infinity, grade: 4 },
];

export const ageToGradeLevel = (age: number): 0 | 1 | 2 | 3 | 4 => ...
```

Pure function — no side effects, directly testable.

## New Dependencies

```
ai                  (Vercel AI SDK core — embed function)
@ai-sdk/openai      (OpenAI provider for embed)
csv-parse           (CSV parsing in seed script)
```

Added to `backend/package.json` dependencies (not devDeps — used at runtime in the service).

## Module structure after this PR

```
backend/src/ai/
  schemas/          (existing: StorySchema, JudgeSchema)
  prompts/          (existing: .gitkeep)
  rag/
    age-grade.map.ts
    vocabulary-rag.service.ts
  ai.module.ts      (new: NestJS module wiring VocabularyRagService)

backend/src/scripts/
  seed-vocabulary.ts

backend/prisma/seed/
  vocabulary.csv
```

## What this PR does NOT do

- Does not integrate with StoryGenerator (that's #11)
- Does not add LangFuse tracing to the embed call (that's #14)
- Does not unit-test with real OpenAI — tests mock `embed()`

## How it fits into StoryGenerator (#11)

```typescript
// In BullMQ job handler (future #11):
const gradeLevel = ageToGradeLevel(child.age);
const words = await vocabularyRagService.retrieve({
  topic: book.title,
  learningGoal: goal.title,
  gradeLevel,
});

// Passed into StoryGenerator prompt:
// "Используй слова такого уровня сложности: друг, лес, помочь, ..."
```
