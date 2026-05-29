# StoryGenerator Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `StoryGeneratorService` with a 3-layer control architecture (PRE/GENERATION/POST) including vocabulary compliance check, LLM-as-judge, retry loop with targeted feedback, and a `StoryEval` audit row on every attempt.

**Architecture:** PRE layer retrieves allowed words from `VocabularyRagService`; GENERATION layer calls `generateObject(StorySchema)` with LangFuse telemetry; POST layer runs deterministic checks (`BookPlanValidator`, vocabulary compliance) then LLM judge, persisting every attempt as a `StoryEval` row. On failure the loop regenerates up to `EVAL_MAX_RETRIES` times with targeted feedback, then throws `StoryGenerationFailedError`.

**Tech Stack:** NestJS injectable service, Vercel AI SDK (`generateObject`), Zod schemas, Prisma ORM, Jest (TDD), pnpm.

---

## File Structure

**Created:**
- `backend/src/ai/story-generator/stop-words.ts`
- `backend/src/ai/story-generator/vocabulary-compliance.ts`
- `backend/src/ai/story-generator/vocabulary-compliance.spec.ts`
- `backend/src/ai/story-generator/errors.ts`
- `backend/src/ai/prompts/judge.prompt.ts`
- `backend/src/ai/story-generator/story-generator.service.ts`
- `backend/src/ai/story-generator/story-generator.service.spec.ts`

**Modified:**
- `backend/src/ai/prompts/story-generator.prompt.ts` — extend `buildRegenerationFeedback` with 3rd `structuralErrors?` param
- `backend/prisma/schema.prisma` — add `judgeReasoning`, `vocabularyCompliance`, `passed` to `StoryEval`
- `backend/src/ai/ai.module.ts` — register `StoryGeneratorService`, import `PrismaModule`

---

### Task 1: Stop words list

**Files:**
- Create: `backend/src/ai/story-generator/stop-words.ts`

- [ ] **Step 1: Create the file**

```typescript
// backend/src/ai/story-generator/stop-words.ts
export const STOP_WORDS: ReadonlySet<string> = new Set([
  // prepositions
  'в', 'на', 'с', 'к', 'по', 'из', 'за', 'от', 'до', 'для', 'о', 'об', 'обо',
  'при', 'над', 'под', 'перед', 'после', 'между', 'через', 'без', 'про', 'вокруг',
  'около', 'среди', 'ради', 'насчёт', 'вследствие', 'благодаря', 'согласно',
  // conjunctions
  'и', 'а', 'но', 'или', 'что', 'как', 'если', 'то', 'чтобы', 'когда', 'потому',
  'хотя', 'либо', 'да', 'ни', 'однако', 'зато', 'причём', 'притом', 'также',
  'тоже', 'иначе', 'словно', 'будто', 'точно', 'пока', 'раз', 'поскольку',
  // particles
  'не', 'ни', 'же', 'ли', 'бы', 'ведь', 'даже', 'только', 'уже', 'ещё',
  'вот', 'ну', 'вдруг', 'просто', 'вообще', 'именно', 'почти', 'лишь',
  'пусть', 'пускай', 'нет', 'да', 'ой', 'ах', 'эх',
  // personal pronouns (all common cases)
  'я', 'меня', 'мне', 'мной', 'мною',
  'ты', 'тебя', 'тебе', 'тобой',
  'он', 'его', 'ему', 'им',
  'она', 'её', 'ей', 'ею',
  'оно',
  'мы', 'нас', 'нам', 'нами',
  'вы', 'вас', 'вам', 'вами',
  'они', 'их', 'ими',
  'себя', 'себе', 'собой',
  // demonstrative
  'этот', 'эта', 'это', 'эти', 'этого', 'этой', 'этому', 'этим', 'этих',
  'тот', 'та', 'те', 'того', 'той', 'тому', 'тем', 'тех',
  // relative / interrogative
  'который', 'которая', 'которое', 'которые', 'которого', 'которой',
  'кто', 'кого', 'кому', 'кем', 'чего', 'чему', 'чем',
  'где', 'куда', 'откуда', 'зачем', 'почему', 'какой', 'какая',
  'какое', 'какие', 'сколько', 'насколько',
  // auxiliary / linking verbs
  'быть', 'есть', 'был', 'была', 'было', 'были', 'буду', 'будет',
  'будешь', 'будем', 'будете', 'будут',
  'стать', 'стал', 'стала', 'стало', 'стали',
  'являться', 'является', 'являлся', 'являлась',
  // common function adverbs
  'так', 'там', 'тут', 'тогда', 'теперь', 'здесь', 'туда', 'сюда',
  'оттуда', 'отсюда', 'сейчас', 'потом', 'затем', 'снова', 'опять',
  'всегда', 'никогда', 'иногда', 'часто', 'редко', 'скоро',
  // quantifiers / determiners
  'весь', 'вся', 'всё', 'все', 'всего', 'всей', 'всему', 'всем', 'всеми', 'всех',
  'каждый', 'каждая', 'каждое', 'каждые',
  'свой', 'своя', 'своё', 'свои', 'своего', 'своей',
  'такой', 'такая', 'такое', 'такие', 'такого', 'такой',
  'один', 'одна', 'одно', 'одни', 'одного', 'одной',
  'другой', 'другая', 'другое', 'другие',
  'сам', 'сама', 'само', 'сами',
]);
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/ai/story-generator/stop-words.ts
git commit -m "feat(ai): add Russian stop words set for vocabulary compliance"
```

---

### Task 2: Vocabulary compliance check (TDD)

**Files:**
- Create: `backend/src/ai/story-generator/vocabulary-compliance.spec.ts`
- Create: `backend/src/ai/story-generator/vocabulary-compliance.ts`

- [ ] **Step 1: Write the failing spec**

```typescript
// backend/src/ai/story-generator/vocabulary-compliance.spec.ts
import { checkCompliance, COMPLIANCE_THRESHOLD } from './vocabulary-compliance';
import type { Story } from '../schemas';

const coverPage = {
  template: 'cover' as const,
  title: 'Кот и мяч',
  illustrationPrompt: 'A cat with a ball, watercolour',
};
const finalPage = {
  template: 'final' as const,
  text: 'Кот научился дружить',
  illustrationPrompt: 'Cat smiling, watercolour',
};
const makeStory = (overrides: Partial<Story> = {}): Story => ({
  title: 'Кот и мяч',
  pages: [
    coverPage,
    { template: 'image-top', text: 'Кот прыгал', illustrationPrompt: 'Cat jumping' },
    finalPage,
  ],
  discussionQuestions: ['Что делал кот?', 'Где мяч?', 'Почему кот прыгал?', 'Что нашёл кот?', 'Куда пошёл кот?'],
  ...overrides,
});

describe('checkCompliance', () => {
  it('returns score=1 and compliant=true when all meaningful tokens are in corpus', () => {
    const story = makeStory();
    const result = checkCompliance(story, ['кот', 'мяч', 'прыгал', 'научился', 'дружить']);
    expect(result.score).toBe(1);
    expect(result.compliant).toBe(true);
    expect(result.outOfCorpus).toEqual([]);
  });

  it('returns compliant=false when meaningful tokens are absent from corpus', () => {
    const story = makeStory({
      pages: [
        coverPage,
        { template: 'image-top', text: 'бегемот слон жираф', illustrationPrompt: 'Animals' },
        finalPage,
      ],
    });
    const result = checkCompliance(story, ['кот', 'мяч']);
    expect(result.compliant).toBe(false);
    expect(result.outOfCorpus).toContain('бегемот');
    expect(result.outOfCorpus).toContain('слон');
    expect(result.outOfCorpus).toContain('жираф');
  });

  it('excludes stop words from the compliance check', () => {
    const story = makeStory({
      pages: [
        coverPage,
        { template: 'image-top', text: 'и в на кот', illustrationPrompt: 'Cat' },
        finalPage,
      ],
    });
    // "и", "в", "на" are stop words — only "кот" is meaningful
    const result = checkCompliance(story, ['кот', 'мяч', 'научился', 'дружить']);
    expect(result.score).toBe(1);
    expect(result.compliant).toBe(true);
  });

  it('does NOT check illustrationPrompt text (English, for DALL-E)', () => {
    const story = makeStory({
      pages: [
        coverPage,
        { template: 'image-top', text: 'кот', illustrationPrompt: 'elephant giraffe hippo' },
        { template: 'final', text: 'кот', illustrationPrompt: 'watercolour illustration' },
      ],
    });
    // English words from illustrationPrompt must not be counted
    const result = checkCompliance(story, ['кот', 'мяч', 'научился', 'дружить']);
    expect(result.score).toBe(1);
    expect(result.compliant).toBe(true);
  });

  it('computes fractional score for partial corpus matches', () => {
    const story = makeStory({
      pages: [
        { template: 'cover', title: 'тест', illustrationPrompt: 'test' },
        { template: 'image-top', text: 'кот прыгал бегемот слон', illustrationPrompt: 'x' },
        { template: 'final', text: 'кот', illustrationPrompt: 'x' },
      ],
      discussionQuestions: ['?', '?', '?', '?', '?'],
    });
    // Meaningful: кот (×3), прыгал, бегемот, слон, тест = 7 tokens
    // In corpus: кот (×3), прыгал, тест = 5 tokens → score = 5/7
    const result = checkCompliance(story, ['кот', 'прыгал', 'тест']);
    expect(result.score).toBeCloseTo(5 / 7);
    expect(result.outOfCorpus).toContain('бегемот');
    expect(result.outOfCorpus).toContain('слон');
  });

  it('marks result compliant when score >= COMPLIANCE_THRESHOLD', () => {
    expect(COMPLIANCE_THRESHOLD).toBe(0.85);
    const story = makeStory({
      pages: [
        { template: 'cover', title: 'один', illustrationPrompt: 'x' },
        { template: 'image-top', text: 'два три четыре пять шесть семь восемь девять десять', illustrationPrompt: 'x' },
        { template: 'final', text: 'одиннадцать', illustrationPrompt: 'x' },
      ],
      discussionQuestions: ['?', '?', '?', '?', '?'],
    });
    // 12 unique meaningful tokens; put 11 in corpus → 11/12 ≈ 0.917 >= 0.85
    const corpus = ['один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать'];
    const result = checkCompliance(story, corpus);
    expect(result.score).toBeGreaterThanOrEqual(COMPLIANCE_THRESHOLD);
    expect(result.compliant).toBe(true);
  });

  it('handles pages that have no text or title (illustration-only)', () => {
    const story = makeStory({
      pages: [
        { template: 'cover', illustrationPrompt: 'x' }, // no title, no text
        { template: 'image-top', illustrationPrompt: 'x' }, // no text
        { template: 'final', text: 'кот', illustrationPrompt: 'x' },
      ],
    });
    expect(() => checkCompliance(story, ['кот'])).not.toThrow();
    const result = checkCompliance(story, ['кот']);
    expect(result.compliant).toBe(true);
  });

  it('checks story.title and discussionQuestions as well as page text', () => {
    const story: Story = {
      title: 'необычный заголовок',
      pages: [coverPage, finalPage],
      discussionQuestions: ['странный вопрос?', '?', '?', '?', '?'],
    };
    const result = checkCompliance(story, ['кот', 'научился', 'дружить']);
    // "необычный", "заголовок", "странный", "вопрос" are not in corpus
    expect(result.outOfCorpus).toContain('необычный');
    expect(result.outOfCorpus).toContain('заголовок');
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

```bash
cd backend && pnpm test -- --testPathPattern=vocabulary-compliance --no-coverage 2>&1 | tail -20
```

Expected: `FAIL` — `Cannot find module './vocabulary-compliance'`

- [ ] **Step 3: Implement vocabulary compliance**

```typescript
// backend/src/ai/story-generator/vocabulary-compliance.ts
import type { Story } from '../schemas';
import { STOP_WORDS } from './stop-words';

export const COMPLIANCE_THRESHOLD = 0.85;

export interface ComplianceResult {
  compliant: boolean;
  score: number;
  outOfCorpus: string[];
}

const extractRussianText = (story: Story): string =>
  [
    story.title,
    ...story.pages.flatMap((p) => [p.title, p.text].filter((t): t is string => Boolean(t))),
    ...story.discussionQuestions,
  ].join(' ');

const tokenize = (text: string): string[] =>
  (text.toLowerCase().match(/[а-яё]+/g) ?? []);

export const checkCompliance = (story: Story, allowedWords: readonly string[]): ComplianceResult => {
  const corpusSet = new Set(allowedWords.map((w) => w.toLowerCase()));
  const allTokens = tokenize(extractRussianText(story));
  const meaningful = allTokens.filter((t) => !STOP_WORDS.has(t));

  if (meaningful.length === 0) {
    return { compliant: true, score: 1, outOfCorpus: [] };
  }

  const outOfCorpusSet = new Set(meaningful.filter((t) => !corpusSet.has(t)));
  const inCorpusCount = meaningful.filter((t) => corpusSet.has(t)).length;
  const score = inCorpusCount / meaningful.length;

  return {
    compliant: score >= COMPLIANCE_THRESHOLD,
    score,
    outOfCorpus: [...outOfCorpusSet],
  };
};
```

- [ ] **Step 4: Run the spec to verify it passes**

```bash
cd backend && pnpm test -- --testPathPattern=vocabulary-compliance --no-coverage 2>&1 | tail -20
```

Expected: `PASS` — all 8 tests green

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/story-generator/vocabulary-compliance.ts \
        backend/src/ai/story-generator/vocabulary-compliance.spec.ts
git commit -m "feat(ai): add vocabulary compliance check with stop-word filtering (TDD)"
```

---

### Task 3: StoryGenerationFailedError

**Files:**
- Create: `backend/src/ai/story-generator/errors.ts`

- [ ] **Step 1: Create the error class**

```typescript
// backend/src/ai/story-generator/errors.ts
export class StoryGenerationFailedError extends Error {
  constructor(
    readonly bookId: string,
    readonly attempts: number,
  ) {
    super(`Story generation failed for book ${bookId} after ${attempts} attempts`);
    this.name = 'StoryGenerationFailedError';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/ai/story-generator/errors.ts
git commit -m "feat(ai): add StoryGenerationFailedError"
```

---

### Task 4: Judge prompt

**Files:**
- Create: `backend/src/ai/prompts/judge.prompt.ts`

The judge prompt must work with the `pages[]` structure (not the old flat fields).
`JudgeSchema` has: `scores` (5 int fields 0–10), `reasoning` (string), `finalScore` (float).

- [ ] **Step 1: Create the judge prompt file**

```typescript
// backend/src/ai/prompts/judge.prompt.ts
import type { Story } from '../schemas';

export const JUDGE_SYSTEM_PROMPT = `
You are an expert evaluator of Russian children's books.
Rate the story on exactly five criteria using integers 0–10 each:

1. ageAppropriateVocab — vocabulary difficulty matches the child's age
2. hasMoralLesson — story clearly teaches the stated learning goal
3. structureCompleteness — all four narrative stages present (setup → conflict → lesson → resolution)
4. safetyForChildren — content is appropriate, non-violent, and positive for children
5. length — number of pages and content volume suits the target age

Set finalScore to the exact mean of the five integer scores rounded to 2 decimal places.
Write reasoning in 2–3 sentences explaining the key strengths or weaknesses.
`.trim();

const formatPages = (story: Story): string =>
  story.pages
    .map((p, i) => {
      const parts = [p.title, p.text].filter((s): s is string => Boolean(s));
      const content = parts.length > 0 ? parts.join(' | ') : '(illustration only)';
      return `  Page ${i + 1} [${p.template}]: ${content}`;
    })
    .join('\n');

export const buildJudgePrompt = (
  story: Story,
  childAge: number,
  learningGoal: string,
): string => {
  const questions = story.discussionQuestions
    .map((q, i) => `  ${i + 1}. ${q}`)
    .join('\n');
  return `Story title: "${story.title}"
Child age: ${childAge}
Learning goal: ${learningGoal}

Pages:
${formatPages(story)}

Discussion questions:
${questions}

Evaluate this story.`.trim();
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && pnpm exec tsc --noEmit 2>&1 | grep judge.prompt
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add backend/src/ai/prompts/judge.prompt.ts
git commit -m "feat(ai): add judge prompt builder working with pages[] structure"
```

---

### Task 5: Extend buildRegenerationFeedback

**Files:**
- Modify: `backend/src/ai/prompts/story-generator.prompt.ts`

Add an optional third parameter `structuralErrors?: readonly string[]` so the retry prompt can include structural validation failures from `BookPlanValidator`.

- [ ] **Step 1: Update the function signature and body**

In `story-generator.prompt.ts`, replace the existing `buildRegenerationFeedback` function (lines 132–156) with:

```typescript
export const buildRegenerationFeedback = (
  outOfCorpus: readonly string[],
  judge?: JudgeResult,
  structuralErrors?: readonly string[],
): string => {
  const parts: string[] = [];

  if (structuralErrors && structuralErrors.length > 0) {
    parts.push(`Structural errors (fix first): ${structuralErrors.join('; ')}.`);
  }

  if (outOfCorpus.length > 0) {
    const sample = outOfCorpus.slice(0, 10).join(', ');
    const more = outOfCorpus.length > 10 ? ` and ${outOfCorpus.length - 10} more` : '';
    parts.push(
      `Vocabulary violation: the following words are NOT in the allowed list: ${sample}${more}.` +
        ` Use synonyms from the allowed vocabulary.`,
    );
  }

  if (judge) {
    parts.push(
      `Quality score: ${judge.finalScore.toFixed(1)}/10.` +
        ` Judge feedback: ${judge.reasoning}` +
        ` Address the feedback above to raise the score above the required threshold.`,
    );
  }

  return parts.join('\n\n');
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && pnpm exec tsc --noEmit 2>&1 | grep story-generator.prompt
```

Expected: no output

- [ ] **Step 3: Verify tests still pass**

```bash
cd backend && pnpm test -- --testPathPattern=story-generator.prompt --no-coverage 2>&1 | tail -10
```

Expected: `PASS` or `no tests found` (no regression)

- [ ] **Step 4: Commit**

```bash
git add backend/src/ai/prompts/story-generator.prompt.ts
git commit -m "feat(ai): extend buildRegenerationFeedback with optional structuralErrors param"
```

---

### Task 6: Prisma migration — extend StoryEval

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_story_eval_fields/migration.sql` (auto-generated)

Add three fields to `StoryEval`: `judgeReasoning` (nullable text for the judge's reasoning string), `vocabularyCompliance` (nullable float for the 0–1 corpus score), and `passed` (boolean defaulting to false).

- [ ] **Step 1: Update schema.prisma**

In `backend/prisma/schema.prisma`, find the `StoryEval` model and add the three new fields:

```prisma
model StoryEval {
  id                   String   @id @default(cuid())
  bookId               String
  book                 Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)
  judgeScores          Json
  judgeReasoning       String?
  finalScore           Float
  vocabularyCompliance Float?
  passed               Boolean  @default(false)
  attempt              Int      @default(1)
  generatedAt          DateTime @default(now())
}
```

- [ ] **Step 2: Run migration** (requires running `docker compose up -d` first)

```bash
cd backend && pnpm prisma migrate dev --name add_story_eval_fields
```

Expected output:
```
Applying migration `<timestamp>_add_story_eval_fields`
The following migration(s) have been created and applied from new schema changes:
migrations/<timestamp>_add_story_eval_fields/migration.sql
```

- [ ] **Step 3: Verify migration SQL is correct**

```bash
cat backend/prisma/migrations/*add_story_eval_fields*/migration.sql
```

Expected SQL (order may vary):
```sql
ALTER TABLE "StoryEval" ADD COLUMN "judgeReasoning" TEXT;
ALTER TABLE "StoryEval" ADD COLUMN "vocabularyCompliance" DOUBLE PRECISION;
ALTER TABLE "StoryEval" ADD COLUMN "passed" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 4: Regenerate Prisma client**

```bash
cd backend && pnpm prisma generate
```

Expected: `Generated Prisma Client` — no errors

- [ ] **Step 5: Verify TypeScript compiles with new types**

```bash
cd backend && pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: no output

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(ai): add judgeReasoning, vocabularyCompliance, passed to StoryEval"
```

---

### Task 7: StoryGeneratorService (TDD)

**Files:**
- Create: `backend/src/ai/story-generator/story-generator.service.spec.ts`
- Create: `backend/src/ai/story-generator/story-generator.service.ts`

This is the core service. The spec must verify behavior (retry count, StoryEval writes, feedback content) — not mock internals.

- [ ] **Step 1: Write the failing spec**

```typescript
// backend/src/ai/story-generator/story-generator.service.spec.ts
import { Test } from '@nestjs/testing';
import { StoryGeneratorService } from './story-generator.service';
import type { GenerateStoryOptions } from './story-generator.service';
import { StoryGenerationFailedError } from './errors';
import { VocabularyRagService } from '../rag/vocabulary-rag.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Story } from '../schemas';

jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => ({ call: jest.fn() })),
}));

import { generateObject } from 'ai';
const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;

const validStory: Story = {
  title: 'Маша и кот',
  pages: [
    { template: 'cover', title: 'Маша и кот', illustrationPrompt: 'A girl with cat' },
    { template: 'image-top', text: 'Маша играла с котом', illustrationPrompt: 'Girl playing' },
    { template: 'image-bottom', text: 'Кот убежал', illustrationPrompt: 'Cat running' },
    { template: 'image-left', text: 'Маша искала кота', illustrationPrompt: 'Girl searching' },
    { template: 'text-focus', text: 'Маша нашла кота и обняла', illustrationPrompt: 'Girl hugging cat' },
    { template: 'final', text: 'Дружба важна', illustrationPrompt: 'Girl and cat friends' },
  ],
  discussionQuestions: ['Что случилось?', 'Почему кот убежал?', 'Как искала Маша?', 'Что узнала Маша?', 'Что важно?'],
};

const validJudge = {
  scores: {
    ageAppropriateVocab: 8,
    hasMoralLesson: 9,
    structureCompleteness: 8,
    safetyForChildren: 10,
    length: 8,
  },
  reasoning: 'Well-structured story with age-appropriate vocabulary.',
  finalScore: 8.6,
};

const opts: GenerateStoryOptions = {
  bookId: 'book-1',
  childName: 'Маша',
  childAge: 6,
  topic: 'дружба',
  learningGoal: 'научиться дружить',
};

const mockVocabRag = {
  retrieve: jest.fn().mockResolvedValue(['маша', 'кот', 'играла', 'дружба', 'нашла', 'обняла', 'искала', 'убежал']),
};

const mockPrisma = {
  storyEval: {
    create: jest.fn().mockResolvedValue({ id: 'eval-1' }),
  },
};

describe('StoryGeneratorService', () => {
  let service: StoryGeneratorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        StoryGeneratorService,
        { provide: VocabularyRagService, useValue: mockVocabRag },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(StoryGeneratorService);
  });

  it('returns story and evalId on first passing attempt', async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: validJudge } as never);

    const result = await service.generate(opts);

    expect(result.story).toEqual(validStory);
    expect(result.evalId).toBe('eval-1');
    expect(result.attempts).toBe(1);
  });

  it('writes a StoryEval row with passed=true on success', async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: validJudge } as never);

    await service.generate(opts);

    expect(mockPrisma.storyEval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookId: 'book-1',
          passed: true,
          attempt: 1,
          finalScore: 8.6,
        }),
      }),
    );
  });

  it('retries on low judge score and succeeds on second attempt', async () => {
    const failingJudge = { ...validJudge, finalScore: 5.0 };
    mockGenerateObject
      .mockResolvedValueOnce({ object: validStory } as never)  // attempt 1: generate
      .mockResolvedValueOnce({ object: failingJudge } as never) // attempt 1: judge → fail
      .mockResolvedValueOnce({ object: validStory } as never)  // attempt 2: generate
      .mockResolvedValueOnce({ object: validJudge } as never); // attempt 2: judge → pass

    const result = await service.generate(opts);

    expect(result.attempts).toBe(2);
    expect(mockPrisma.storyEval.create).toHaveBeenCalledTimes(2);
  });

  it('writes passed=false for the failing attempt', async () => {
    const failingJudge = { ...validJudge, finalScore: 5.0 };
    mockGenerateObject
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: failingJudge } as never)
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: validJudge } as never);

    await service.generate(opts);

    const firstCall = mockPrisma.storyEval.create.mock.calls[0][0];
    expect(firstCall.data.passed).toBe(false);
    const secondCall = mockPrisma.storyEval.create.mock.calls[1][0];
    expect(secondCall.data.passed).toBe(true);
  });

  it('throws StoryGenerationFailedError after all attempts fail', async () => {
    const failingJudge = { ...validJudge, finalScore: 5.0 };
    // Each attempt: generate + judge (both fail)
    for (let i = 0; i < 10; i++) {
      mockGenerateObject
        .mockResolvedValueOnce({ object: validStory } as never)
        .mockResolvedValueOnce({ object: failingJudge } as never);
    }

    await expect(service.generate(opts)).rejects.toThrow(StoryGenerationFailedError);
    await expect(service.generate(opts)).rejects.toThrow('book-1');
  });

  it('retrieves allowed words from VocabularyRagService using correct gradeLevel', async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: validJudge } as never);

    await service.generate({ ...opts, childAge: 6 });

    // age 6 → gradeLevel 1
    expect(mockVocabRag.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ gradeLevel: 1, topic: opts.topic }),
    );
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

```bash
cd backend && pnpm test -- --testPathPattern=story-generator.service --no-coverage 2>&1 | tail -20
```

Expected: `FAIL` — `Cannot find module './story-generator.service'`

- [ ] **Step 3: Implement the service**

```typescript
// backend/src/ai/story-generator/story-generator.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { StorySchema, JudgeSchema, type Story, type JudgeResult } from '../schemas';
import { STORY_SYSTEM_PROMPT, buildStoryUserPrompt, buildRegenerationFeedback } from '../prompts/story-generator.prompt';
import { JUDGE_SYSTEM_PROMPT, buildJudgePrompt } from '../prompts/judge.prompt';
import { VocabularyRagService } from '../rag/vocabulary-rag.service';
import { ageToGradeLevel } from '../rag/age-grade.map';
import { PrismaService } from '../../prisma/prisma.service';
import { validateBookPlan, type ValidationResult } from '../../pdf/page-templates/book-plan.validator';
import { checkCompliance, type ComplianceResult } from './vocabulary-compliance';
import { StoryGenerationFailedError } from './errors';

export interface GenerateStoryOptions {
  bookId: string;
  childName: string;
  childAge: number;
  topic: string;
  learningGoal: string;
}

export interface GenerateStoryResult {
  story: Story;
  evalId: string;
  attempts: number;
}

interface PostCheckResult {
  passed: boolean;
  judgeResult: JudgeResult;
  outOfCorpus: readonly string[];
  structuralErrors: readonly string[];
  vocabularyCompliance: number;
}

const GENERATION_MODEL = 'gpt-4o-mini';
const EVAL_THRESHOLD = parseFloat(process.env['EVAL_THRESHOLD'] ?? '7.0');
const EVAL_MAX_RETRIES = parseInt(process.env['EVAL_MAX_RETRIES'] ?? '2', 10);

@Injectable()
export class StoryGeneratorService {
  private readonly logger = new Logger(StoryGeneratorService.name);
  private readonly openai = createOpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  constructor(
    private readonly vocabularyRag: VocabularyRagService,
    private readonly prisma: PrismaService,
  ) {}

  async generate(opts: GenerateStoryOptions): Promise<GenerateStoryResult> {
    const gradeLevel = ageToGradeLevel(opts.childAge);
    const allowedWords = await this.vocabularyRag.retrieve({
      topic: opts.topic,
      learningGoal: opts.learningGoal,
      gradeLevel,
    });
    const maxAttempts = EVAL_MAX_RETRIES + 1;
    return this.runLoop(opts, allowedWords, maxAttempts);
  }

  private async runLoop(
    opts: GenerateStoryOptions,
    allowedWords: readonly string[],
    maxAttempts: number,
  ): Promise<GenerateStoryResult> {
    let feedback: string | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const story = await this.generateStory(opts, allowedWords, feedback);
      const checks = await this.runPostChecks(story, opts, allowedWords);
      const eval_ = await this.writeEval(opts.bookId, checks, attempt);
      if (checks.passed) return { story, evalId: eval_.id, attempts: attempt };
      if (attempt < maxAttempts) {
        feedback = buildRegenerationFeedback(
          checks.outOfCorpus,
          checks.judgeResult,
          checks.structuralErrors,
        );
      }
    }
    throw new StoryGenerationFailedError(opts.bookId, maxAttempts);
  }

  private async generateStory(
    opts: GenerateStoryOptions,
    allowedWords: readonly string[],
    feedback?: string,
  ): Promise<Story> {
    const { object } = await generateObject({
      model: this.openai(GENERATION_MODEL),
      schema: StorySchema,
      system: STORY_SYSTEM_PROMPT,
      prompt: buildStoryUserPrompt({ ...opts, allowedWords, feedback }),
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'story-generator',
        metadata: { childAge: opts.childAge, topic: opts.topic, bookId: opts.bookId },
      },
    });
    return object;
  }

  private async runPostChecks(
    story: Story,
    opts: GenerateStoryOptions,
    allowedWords: readonly string[],
  ): Promise<PostCheckResult> {
    const validation: ValidationResult = validateBookPlan(story.pages, opts.childAge);
    const compliance: ComplianceResult = checkCompliance(story, allowedWords);
    const judgeResult = await this.judgeStory(story, opts.childAge, opts.learningGoal);
    const passed =
      validation.valid && compliance.compliant && judgeResult.finalScore >= EVAL_THRESHOLD;
    if (!passed) {
      this.logger.warn(
        `Attempt failed: structural=${validation.valid} compliance=${compliance.score.toFixed(2)} judge=${judgeResult.finalScore}`,
      );
    }
    return {
      passed,
      judgeResult,
      outOfCorpus: compliance.outOfCorpus,
      structuralErrors: validation.errors,
      vocabularyCompliance: compliance.score,
    };
  }

  private async judgeStory(
    story: Story,
    childAge: number,
    learningGoal: string,
  ): Promise<JudgeResult> {
    const { object } = await generateObject({
      model: this.openai(GENERATION_MODEL),
      schema: JudgeSchema,
      system: JUDGE_SYSTEM_PROMPT,
      prompt: buildJudgePrompt(story, childAge, learningGoal),
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'story-evaluator',
        metadata: { childAge, learningGoal },
      },
    });
    return object;
  }

  private async writeEval(
    bookId: string,
    checks: PostCheckResult,
    attempt: number,
  ): Promise<{ id: string }> {
    return this.prisma.storyEval.create({
      data: {
        bookId,
        judgeScores: checks.judgeResult.scores as object,
        judgeReasoning: checks.judgeResult.reasoning,
        finalScore: checks.judgeResult.finalScore,
        vocabularyCompliance: checks.vocabularyCompliance,
        passed: checks.passed,
        attempt,
      },
      select: { id: true },
    });
  }
}
```

- [ ] **Step 4: Check ValidationResult export from book-plan.validator**

`ValidationResult` must be exported from `book-plan.validator.ts`. If it is not yet exported as a named export, add `export` to its type declaration:

```typescript
// In backend/src/pdf/page-templates/book-plan.validator.ts
// Verify this line exists (or add export keyword):
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

- [ ] **Step 5: Run the spec to verify all tests pass**

```bash
cd backend && pnpm test -- --testPathPattern=story-generator.service --no-coverage 2>&1 | tail -30
```

Expected: `PASS` — all 6 tests green

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd backend && pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: no output

- [ ] **Step 7: Commit**

```bash
git add backend/src/ai/story-generator/story-generator.service.ts \
        backend/src/ai/story-generator/story-generator.service.spec.ts
git commit -m "feat(ai): implement StoryGeneratorService with 3-layer PRE/GENERATION/POST pipeline (TDD)"
```

---

### Task 8: Export ValidationResult and wire AiModule

**Files:**
- Verify/modify: `backend/src/pdf/page-templates/book-plan.validator.ts`
- Modify: `backend/src/ai/ai.module.ts`

- [ ] **Step 1: Ensure ValidationResult is exported from book-plan.validator.ts**

Check the current export in `book-plan.validator.ts`. If `ValidationResult` is not exported, find the interface and add `export`:

```typescript
// In backend/src/pdf/page-templates/book-plan.validator.ts
// The interface MUST have the export keyword:
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

- [ ] **Step 2: Update ai.module.ts**

```typescript
// backend/src/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { VocabularyRagService } from './rag/vocabulary-rag.service';
import { StoryGeneratorService } from './story-generator/story-generator.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [VocabularyRagService, StoryGeneratorService],
  exports: [VocabularyRagService, StoryGeneratorService],
})
export class AiModule {}
```

- [ ] **Step 3: Run full test suite**

```bash
cd /path/to/repo && ./init.sh 2>&1 | tail -30
```

Expected: exits 0 — all tests pass, tsc clean, lint clean

- [ ] **Step 4: Commit**

```bash
git add backend/src/ai/ai.module.ts backend/src/pdf/page-templates/book-plan.validator.ts
git commit -m "feat(ai): wire StoryGeneratorService into AiModule"
```

---

## Self-Review Checklist

After all tasks are committed:

- [ ] `./init.sh` exits 0
- [ ] `vocabulary-compliance.spec.ts` — all 8 tests passing
- [ ] `story-generator.service.spec.ts` — all 6 tests passing
- [ ] No `any` in new files
- [ ] All functions ≤30 lines, ≤3 parameters
- [ ] All files ≤400 lines
- [ ] LangFuse `experimental_telemetry` on both `generateObject` calls in the service
- [ ] `StoryEval` row written on every attempt (including failed ones)
- [ ] `buildRegenerationFeedback` called with `structuralErrors` on retry
- [ ] Migration file committed alongside schema changes
