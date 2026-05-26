# StoryGenerator — Controlled Generation Design — issue #11

**Date:** 2026-05-26
**Status:** Approved
**Closes:** #11 (StoryGenerator service)
**Builds on:** [2026-05-25-vocabulary-rag-design.md](./2026-05-25-vocabulary-rag-design.md) (#8 + #9, merged)

---

## Problem

`VocabularyRagService` (#9) already retrieves a list of 80 age-appropriate words semantically close to a story topic. But the retrieve **by itself** does not control what the model writes — it is just a list passed into the prompt. Without active enforcement, the RAG layer becomes infrastructure with no effect.

`StoryGenerator` must **turn retrieve into actual control over the model's output**: age-band vocabulary must become a **hard constraint that is verified after generation**, not a hint.

## Approach: three-layer control architecture

A production AI pipeline = a sandwich of constraint layers wrapped around a non-deterministic core (the LLM). Controllability comes not from "persuading the model" but from **deterministic validators + retry with feedback**.

```
┌─────────────────────────────────────────────────────────┐
│ PRE        RAG retrieve → whitelist of words in prompt   │
│            + explicit rules in the system message        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ GENERATION generateObject(StorySchema)                   │
│            shape guaranteed by OpenAI Structured Outputs │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ POST       (a) vocabularyCompliance — deterministic      │
│            (b) JudgeSchema — LLM-as-judge over content   │
│            (c) regen with feedback when below threshold  │
│            (d) hard fail after N retries                 │
└─────────────────────────────────────────────────────────┘
                          ↓
                  StoryEval row + LangFuse trace
```

## Components

### 1. `StoryGeneratorService`

**File:** `backend/src/ai/story-generator/story-generator.service.ts`
**NestJS:** `@Injectable()`, provided in `AiModule`

```typescript
interface GenerateOptions {
  childName: string;
  childAge: number;
  topic: string;
  learningGoal: string;
  bookId: string;       // for StoryEval rows
  attempt?: number;     // internal, default 1
  feedback?: string;    // internal, what failed previous attempt
}

interface GenerateResult {
  story: Story;
  evalId: string;       // StoryEval row id
  attempts: number;
  vocabularyCompliance: number;
  finalScore: number;
}

generate(options: GenerateOptions): Promise<GenerateResult>
```

### 2. Prompts — `backend/src/ai/prompts/story-generator.prompt.ts`

Exported constants (per CLAUDE.md Hard Constraint #11 — no inline prompt strings in services).

```typescript
export const STORY_SYSTEM_PROMPT = `...`;     // role + vocabulary rules
export const buildStoryUserPrompt = ({...}) => string;  // topic, goal, name
export const buildRegenerationFeedback = (outOfCorpus: string[], judge?: JudgeResult) => string;
```

**Hard instructions in the system prompt:**

- "Use ONLY words from the provided list plus function words (prepositions, conjunctions, pronouns, particles)."
- "Any word outside the list is a violation of the requirements."
- "The protagonist's name is {childName}. Protagonist's and reader's age is {childAge}."
- "Structure: setup → conflict → lesson → resolution. Lesson: {learningGoal}."

### 3. Generation — `generateObject` + StorySchema

```typescript
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { StorySchema } from '../schemas/story.schema';

const { object: story } = await generateObject({
  model: openai('gpt-4o-mini'),
  schema: StorySchema,
  system: STORY_SYSTEM_PROMPT,
  prompt: buildStoryUserPrompt({ childName, childAge, topic, learningGoal, allowedWords, feedback }),
  temperature: 0.7,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'story-generator',
    metadata: { bookId, attempt },
  },
});
```

**What is guaranteed** at the token level (via OpenAI Structured Outputs API):
- `title`, `setup`, `conflict`, `lesson`, `resolution` — all present, non-empty
- `discussionQuestions.length === 5` — physically impossible to return 4 or 6
- `illustrationPrompts.length ∈ [3, 8]`
- All strings of length ≥ 1 (from the Zod schema)

**What is NOT guaranteed:** the content itself — vocabulary compliance, quality, safety. That is enforced in the POST layer.

### 4. Vocabulary compliance check

**File:** `backend/src/ai/story-generator/vocabulary-compliance.ts`

```typescript
interface ComplianceResult {
  compliance: number;        // 0..1
  outOfCorpus: string[];     // tokens that are neither in the dictionary nor stop-words
  totalTokens: number;
}

checkCompliance(story: Story, allowedWords: string[]): ComplianceResult
```

**Algorithm:**
1. Concatenate all text fields of the story: `title + setup + conflict + lesson + resolution + discussionQuestions.join(' ')`.
2. Tokenise into Russian words (regex `/[а-яё]+/giu`, lowercase).
3. Lemmatise via `node-rus-morph` or `nodejs-mystem` (if neither works — fall back to plain normalisation: lowercase, no stemming, raw word-form match).
4. For each token, check: either `allowedWords.includes(lemma)` or `STOP_WORDS.has(lemma)`.
5. `compliance = (allTokens.length - outOfCorpus.length) / allTokens.length`.

**STOP_WORDS** — a separate module `backend/src/ai/story-generator/stop-words.ts`. Contains ~150 Russian function words: prepositions, conjunctions, particles, pronouns, base forms of the verb "to be". These words are **not** checked for corpus membership — they are required for any coherent speech.

**Lemmatisation decision:**
- First iteration: **no lemmatisation** (plain word-form match). Known inaccuracy: "медведь" in corpus, "медведя" in text → no match.
- If compliance stays below 0.6 on manual review — add `node-rus-morph` (separate follow-up issue).
- Document in code: `// TODO: add lemmatisation if compliance turns out to be low`.

### 5. StoryEvaluator (inline minimal version at this stage)

For #11 we build a **minimal judge** directly inside `StoryGeneratorService`. The full `StoryEvaluator` as a separate module is issue #13.

```typescript
const { object: judge } = await generateObject({
  model: openai('gpt-4o-mini'),
  schema: JudgeSchema,
  system: JUDGE_SYSTEM_PROMPT,
  prompt: buildJudgePrompt(story, childAge, learningGoal),
  experimental_telemetry: { isEnabled: true, functionId: 'story-judge', metadata: { bookId, attempt } },
});
```

### 6. Decision logic + regen loop

```typescript
const COMPLIANCE_THRESHOLD = 0.85;
const JUDGE_THRESHOLD = Number(process.env.EVAL_THRESHOLD ?? 7.0);
const MAX_RETRIES = Number(process.env.EVAL_MAX_RETRIES ?? 2);

const passes =
  compliance >= COMPLIANCE_THRESHOLD &&
  judge.finalScore >= JUDGE_THRESHOLD;

// ALWAYS write a StoryEval row (even on success — for audit)
const evalRow = await prisma.storyEval.create({
  data: {
    bookId,
    attempt,
    vocabularyCompliance: compliance,
    judgeScores: judge.scores,
    judgeReasoning: judge.reasoning,
    finalScore: judge.finalScore,
    passed: passes,
  },
});

if (passes) return { story, evalId: evalRow.id, attempts: attempt, ... };

if (attempt < MAX_RETRIES) {
  const feedback = buildRegenerationFeedback(outOfCorpus, judge);
  return generate({ ...options, attempt: attempt + 1, feedback });
}

// hard fail — better to crash than to ship a defective book
throw new StoryGenerationFailedError({
  bookId,
  attempts: attempt,
  lastCompliance: compliance,
  lastJudgeScore: judge.finalScore,
});
```

### 7. Schema migration — new fields on `StoryEval`

The current Prisma model `StoryEval` (from #6) does not include `vocabularyCompliance` or `passed`. A small migration is required.

**File:** `backend/prisma/schema.prisma` (changes):

```prisma
model StoryEval {
  // existing fields...
  judgeScores          Json
  judgeReasoning       String   @db.Text
  finalScore           Float
  attempt              Int

  // NEW
  vocabularyCompliance Float    // 0..1, share of tokens from the allowed corpus
  passed               Boolean  // final decision (compliance && finalScore)
}
```

**Migration:** `backend/prisma/migrations/0003_add_compliance_fields/migration.sql`
```sql
ALTER TABLE "StoryEval"
  ADD COLUMN "vocabularyCompliance" DOUBLE PRECISION,
  ADD COLUMN "passed" BOOLEAN;
```

Run with `pnpm --filter backend prisma migrate deploy` after `docker compose up -d`.

### 8. New errors

**File:** `backend/src/ai/story-generator/errors.ts`

```typescript
export class StoryGenerationFailedError extends Error {
  constructor(public readonly details: {
    bookId: string;
    attempts: number;
    lastCompliance: number;
    lastJudgeScore: number;
  }) {
    super(`Story generation failed for book ${details.bookId} after ${details.attempts} attempts`);
    this.name = 'StoryGenerationFailedError';
  }
}
```

The caller (the BullMQ processor from #15) is expected to catch this → mark `Book.status = 'failed'` → return a meaningful error to the user instead of leaving the generation hanging forever.

## Module structure after this PR

```
backend/src/ai/
  schemas/                              (existing)
    story.schema.ts
    judge.schema.ts
  prompts/                              (NEW content)
    story-generator.prompt.ts
    judge.prompt.ts
  rag/                                  (existing from #9)
    age-grade.map.ts
    vocabulary-rag.service.ts
  story-generator/                      (NEW)
    story-generator.service.ts
    story-generator.service.spec.ts
    vocabulary-compliance.ts
    vocabulary-compliance.spec.ts
    stop-words.ts
    errors.ts
  ai.module.ts                          (wire StoryGeneratorService)
```

## Tests

**`vocabulary-compliance.spec.ts`** — pure unit tests (no mocks needed):
- Compliance = 1.0 when all words are in the corpus
- Compliance ignores STOP_WORDS
- Returns the `outOfCorpus` list correctly
- Empty story → throws (sanity check)

**`story-generator.service.spec.ts`** — with `generateObject` and `VocabularyRagService` mocked:
- Happy path: compliance ≥ 0.85, judge ≥ 7.0 → returns on the first attempt, writes 1 StoryEval row
- Compliance below threshold → regen with feedback, second attempt passes → 2 StoryEval rows
- All N attempts fail → throws `StoryGenerationFailedError`, leaves N StoryEval rows with `passed: false`
- LangFuse telemetry attached on every call

## Out of scope (separate issues)

- **#13 StoryEvaluator** — extract the judge into a standalone service, add finer-grained criteria
- **#14 LangFuse** — `experimental_telemetry` is wired here, but dashboards and alerts are out of scope
- **#15 BullMQ processor** — `StoryGeneratorService.generate()` will be invoked from there
- **Lemmatisation upgrade** — improve compliance accuracy if it turns out to be needed
- **Adjustable thresholds per age** — all ages currently share the same thresholds; in the future `COMPLIANCE_THRESHOLD` may depend on gradeLevel

## Why this design

| Decision | Alternative | Why this way |
|---|---|---|
| Three control layers from the start | "ship a simple generator first, add validation later" | Control added "later" never gets added — something more urgent always comes up. Controllability architecture must be decided **up front**. |
| Compliance — deterministic, not via an LLM | "let the judge evaluate vocabulary too" | Deterministic checks are cheaper, faster, and **auditable**. "We measure the share of words from the dictionary" is more defensible than "GPT gave it 8/10". |
| Hard fail after N retries | silent fallback to a relaxed prompt | A silent fallback hides the problem; a hard fail is visible in metrics and in `Book.status` — the team can respond intentionally. |
| Write a StoryEval row on EVERY attempt (including success) | only on failure | Audit trail and the metric "% of books passing on the first attempt" — without per-attempt rows defense/observability loses its value. |
| Minimal inline judge, no separate service | full StoryEvaluator right away | The scope of #11 is generation. The full judge architecture is #13. Otherwise a single PR turns into a monstrosity. |
| No lemmatisation in the first iteration | wire up `node-rus-morph` immediately | First measure compliance on raw word-forms; if ≥ 0.6, lemmatisation is not needed (overengineering). If lower, add it. Evolutionary stance. |

## How it fits into the bigger picture

```
BullMQ job (issue #15)
    ↓
StoryGenerator.generate(options)
    ├── 1. VocabularyRagService.retrieve(...)   ← #9 ✅ done
    ├── 2. generateObject(StorySchema, prompt)  ← here
    ├── 3. checkCompliance(story, allowedWords) ← here
    ├── 4. generateObject(JudgeSchema, story)   ← here (minimal), extended in #13
    ├── 5. decide pass/regen/fail               ← here
    └── 6. write StoryEval, return              ← here
    ↓
ImageGenerator (future #N)
    ↓
PDFRenderer (issue #17)
```
