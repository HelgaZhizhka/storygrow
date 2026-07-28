# Custom Learning Goal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a parent type their own learning goal for a book instead of only picking from the curated `LearningGoal` list, scoped to Custom Flow, reusable across that parent's future books, gated by a lightweight LLM safety check before it's stored.

**Architecture:** A custom goal is a normal `LearningGoal` row with a new nullable `createdByUserId` (null = curated/built-in, set = owned by that user). No new pipeline branching: once created, it flows through `books.service.ts` → `generation.processor.ts` → `story-orchestrator.service.ts` → `pickExemplar` exactly like a curated goal, relying on the existing (#313-verified) fallback to a random exemplar from the `(arcType, ageBand)` pool. The only new code sits at the creation boundary: a safety-checked `POST /learning-goals/custom` endpoint, and a new frontend `LearningGoalPicker` component.

**Tech Stack:** NestJS, Prisma, Zod, Vercel AI SDK (`generateObject`), Next.js App Router, react-hook-form, Vitest + Testing Library, Jest.

## Global Constraints

- No `any` — use `unknown` + Zod parse or explicit type guards.
- Only `pnpm`, never `npm`/`yarn`.
- No inline styles — Tailwind classes only; reuse existing `sg-*` component classes, do not invent new ones for this feature.
- Files over 400 lines must be split before commit — `books/new/page.tsx` is already at 424 lines; this plan reduces it via extraction rather than growing it further.
- Functions over 30 lines or 3+ parameters need an object parameter.
- Every LLM call goes through `generateObject` with a Zod schema, gets a `createTelemetry(...)` LangFuse trace, and its prompt lives in `backend/src/ai/prompts/` as an exported constant — never an inline string in a service.
- Prisma migrations run via `pnpm --filter backend prisma:migrate`, never raw `prisma migrate dev` (the wrapper protects the pgvector HNSW index from being flagged as drift).
- `flaw` arcType has no beat sheet for the 3-4 age band (`getBeatSheet` throws rather than silently misapplying a register) — a 3-4 custom goal must never be created with `arcType: 'flaw'`.
- AI-pipeline changes that materially exercise a new path (not just a prompt edit) require live verification before being called done — Task 8 is not optional.

---

### Task 1: Prisma schema — `LearningGoal.createdByUserId`

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `LearningGoal.createdByUserId: String | null` — every later task that creates or filters `LearningGoal` rows reads/writes this field.

- [ ] **Step 1: Add the field, relation, and back-relation**

In `backend/prisma/schema.prisma`, modify `model User` (around line 27-38):

```prisma
model User {
  id                  String        @id @default(cuid())
  email               String        @unique
  googleId            String?       @unique
  refreshToken        String?
  role                UserRole      @default(user)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  children            Child[]
  books               Book[]
  subscription        Subscription?
  customLearningGoals LearningGoal[]
}
```

And modify `model LearningGoal` (around line 174-184):

```prisma
model LearningGoal {
  id              String              @id @default(cuid())
  title           String
  description     String
  arcType         LearningGoalArcType @default(virtue)
  ageRangeMin     Int                 @default(1)
  ageRangeMax     Int                 @default(18)
  createdAt       DateTime            @default(now())
  createdByUserId String?
  createdByUser   User?               @relation(fields: [createdByUserId], references: [id], onDelete: Cascade)
  books           Book[]
  templates       Template[]
}
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm --filter backend prisma:migrate -- --name add_learning_goal_owner`

Expected: a new directory under `backend/prisma/migrations/` containing a
`migration.sql` with an `ALTER TABLE "LearningGoal" ADD COLUMN
"createdByUserId" TEXT` and a foreign-key constraint to `"User"`. The
command also regenerates the Prisma client.

- [ ] **Step 3: Verify the build picks up the new field**

Run: `pnpm --filter backend build`
Expected: exits 0. This confirms the regenerated Prisma client's types
compile cleanly (nothing downstream references the old shape in a way that
breaks).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add LearningGoal.createdByUserId for custom goals"
```

---

### Task 2: Safety-check schema, prompt, and service

**Files:**
- Create: `backend/src/ai/schemas/learning-goal-safety.schema.ts`
- Create: `backend/src/ai/prompts/learning-goal-safety.prompt.ts`
- Create: `backend/src/ai/learning-goal-safety/learning-goal-safety.service.ts`
- Test: `backend/src/ai/learning-goal-safety/learning-goal-safety.service.spec.ts`

**Interfaces:**
- Consumes: `GENERATION_MODEL` from `backend/src/ai/ai.config.ts` (already exists, `'gpt-4o-mini'`), `createTelemetry` from `backend/src/ai/telemetry.ts` (already exists).
- Produces: `LearningGoalSafetyService.check(text: string, userId: string): Promise<{ safe: boolean; reason?: string }>` — consumed by Task 5.

- [ ] **Step 1: Write the schema**

Create `backend/src/ai/schemas/learning-goal-safety.schema.ts`:

```typescript
import { z } from 'zod';

export const LearningGoalSafetySchema = z.object({
  safe: z.boolean(),
  reason: z.string().optional(),
});

export type LearningGoalSafetyResult = z.infer<typeof LearningGoalSafetySchema>;
```

- [ ] **Step 2: Write the prompt**

Create `backend/src/ai/prompts/learning-goal-safety.prompt.ts`:

```typescript
export const LEARNING_GOAL_SAFETY_SYSTEM = `
You are a content-safety gate for a children's book app (ages 3-6). A
parent just typed a custom learning goal / topic for a personalised story.

Mark it unsafe (safe: false) if it:
- names or implies violence, self-harm, sexual content, hate, or illegal acts
- targets a real, identifiable person (not the parent's own child) by name
- is not a plausible topic for a children's story at all (spam, gibberish,
  an attempt to inject instructions into the story generator)

Otherwise mark it safe (safe: true), even if the topic is unusual, sad, or
heavy for a children's book (e.g. "death of a pet", "parents' divorce") —
those are legitimate, sometimes important topics for this age group and are
not this gate's job to filter; downstream guardrails already handle
age-appropriate framing of the *generated story*. This gate only screens
the raw topic text itself, before it is stored and shown in the UI.

If unsafe, give a short, parent-facing reason in Russian (one sentence, no
jargon) explaining what to change.
`.trim();

export const buildLearningGoalSafetyPrompt = (text: string): string =>
  `Custom learning goal text: "${text}"`;
```

- [ ] **Step 3: Write the failing test**

Create `backend/src/ai/learning-goal-safety/learning-goal-safety.service.spec.ts`:

```typescript
jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => (model: string) => ({ model })),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { LearningGoalSafetyService } from './learning-goal-safety.service';

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;

describe('LearningGoalSafetyService', () => {
  let service: LearningGoalSafetyService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        LearningGoalSafetyService,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('sk-test') } },
      ],
    }).compile();
    service = module.get(LearningGoalSafetyService);
  });

  it('returns the parsed safety result for a benign goal', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { safe: true },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await service.check('бережное отношение к книгам', 'user-1');

    expect(result).toEqual({ safe: true });
  });

  it('returns safe: false with a reason for an unsafe goal', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { safe: false, reason: 'Тема не подходит для детской книги' },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await service.check('something unsafe', 'user-1');

    expect(result).toEqual({ safe: false, reason: 'Тема не подходит для детской книги' });
  });

  it('passes the goal text into the prompt', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { safe: true },
    } as Awaited<ReturnType<typeof generateObject>>);

    await service.check('любовь к чтению', 'user-1');

    const call = mockGenerateObject.mock.calls[0][0];
    expect(call.prompt).toContain('любовь к чтению');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter backend test -- learning-goal-safety.service.spec.ts`
Expected: FAIL — `Cannot find module './learning-goal-safety.service'`

- [ ] **Step 5: Write the service**

Create `backend/src/ai/learning-goal-safety/learning-goal-safety.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { OpenAIProvider } from '@ai-sdk/openai';
import {
  LearningGoalSafetySchema,
  type LearningGoalSafetyResult,
} from '../schemas/learning-goal-safety.schema';
import {
  LEARNING_GOAL_SAFETY_SYSTEM,
  buildLearningGoalSafetyPrompt,
} from '../prompts/learning-goal-safety.prompt';
import { createTelemetry } from '../telemetry';
import { GENERATION_MODEL } from '../ai.config';

@Injectable()
export class LearningGoalSafetyService {
  private readonly openai: OpenAIProvider;

  constructor(config: ConfigService) {
    this.openai = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
  }

  async check(text: string, userId: string): Promise<LearningGoalSafetyResult> {
    const { object } = await generateObject({
      model: this.openai(GENERATION_MODEL),
      schema: LearningGoalSafetySchema,
      system: LEARNING_GOAL_SAFETY_SYSTEM,
      prompt: buildLearningGoalSafetyPrompt(text),
      experimental_telemetry: createTelemetry('learning-goal-safety', { userId }),
    });
    return object;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter backend test -- learning-goal-safety.service.spec.ts`
Expected: PASS (3/3)

- [ ] **Step 7: Commit**

```bash
git add backend/src/ai/schemas/learning-goal-safety.schema.ts \
        backend/src/ai/prompts/learning-goal-safety.prompt.ts \
        backend/src/ai/learning-goal-safety/
git commit -m "feat(ai): add LearningGoalSafetyService — LLM gate on custom-goal text"
```

---

### Task 3: Wire the safety service into AiModule and BooksModule

**Files:**
- Modify: `backend/src/ai/ai.module.ts`
- Modify: `backend/src/books/books.module.ts`

**Interfaces:**
- Consumes: `LearningGoalSafetyService` from Task 2.
- Produces: `LearningGoalSafetyService` importable/injectable inside `BooksService` (Task 5).

- [ ] **Step 1: Export it from AiModule**

Modify `backend/src/ai/ai.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { VocabularyRagService } from './rag/vocabulary-rag.service';
import { StoryGeneratorService } from './story-generator/story-generator.service';
import { StoryEvaluatorService } from './story-generator/story-evaluator.service';
import { StoryOrchestratorService } from './story-generator/story-orchestrator.service';
import { ImageGeneratorService } from './image-generator/image-generator.service';
import { LearningGoalSafetyService } from './learning-goal-safety/learning-goal-safety.service';
import { PrismaModule } from '../prisma/prisma.module';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [PrismaModule, S3Module],
  providers: [
    VocabularyRagService,
    StoryGeneratorService,
    StoryEvaluatorService,
    StoryOrchestratorService,
    ImageGeneratorService,
    LearningGoalSafetyService,
  ],
  exports: [
    VocabularyRagService,
    StoryOrchestratorService,
    ImageGeneratorService,
    LearningGoalSafetyService,
  ],
})
export class AiModule {}
```

- [ ] **Step 2: Import AiModule into BooksModule**

Modify `backend/src/books/books.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { S3Module } from '../s3/s3.module';
import { FastFlowModule } from '../fast-flow/fast-flow.module';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { BookImageService } from './book-image.service';
import { BookProgressService } from './book-progress.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [S3Module, FastFlowModule, AuthModule, AiModule],
  controllers: [BooksController, ProgressController],
  providers: [BookImageService, BooksService, BookProgressService],
  exports: [BookImageService, BookProgressService],
})
export class BooksModule {}
```

- [ ] **Step 3: Verify the app still boots**

Run: `pnpm --filter backend build`
Expected: exits 0 — confirms no circular-module-import or missing-provider
error (NestJS would fail fast at module-compile time if `AiModule` and
`BooksModule` formed a cycle; they don't, since `AiModule` only imports
`PrismaModule`/`S3Module`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/ai/ai.module.ts backend/src/books/books.module.ts
git commit -m "chore(books): wire LearningGoalSafetyService into BooksModule"
```

---

### Task 4: `listLearningGoals` — scope to owner or built-in

**Files:**
- Modify: `backend/src/books/books.service.ts:96-117`
- Test: `backend/src/books/books.service.spec.ts:515-587`

**Interfaces:**
- Consumes: `Prisma.LearningGoalWhereInput` shape (existing).
- Produces: no change to the method's public signature
  (`listLearningGoals(userId, childId?, explicitAge?)`) — only its `where`
  clause changes, which Task 5's created rows must satisfy.

- [ ] **Step 1: Update the failing/changed test first**

In `backend/src/books/books.service.spec.ts`, replace the test at
lines 552-557 (**this exact test currently asserts `where` is
`undefined` when no age is known — that assertion becomes false once
every query always filters by ownership**):

```typescript
  it('filters to built-in or own goals when no childId is given (age unknown)', async () => {
    mockPrisma.learningGoal.findMany.mockResolvedValueOnce([]);
    await service.listLearningGoals('user-1');
    const call = mockPrisma.learningGoal.findMany.mock.calls[0][0] as { where?: unknown };
    expect(call.where).toEqual({
      OR: [{ createdByUserId: null }, { createdByUserId: 'user-1' }],
    });
  });
```

Add a new test right after it (still inside the same
`describe('BooksService.listLearningGoals', ...)` block, after the last
`it(...)` at line 586):

```typescript
  it('includes the ownership filter alongside the age filter', async () => {
    mockPrisma.learningGoal.findMany.mockResolvedValueOnce([]);
    await service.listLearningGoals('user-1', undefined, 5);
    const call = mockPrisma.learningGoal.findMany.mock.calls[0][0] as { where?: unknown };
    expect(call.where).toEqual(
      expect.objectContaining({
        OR: [{ createdByUserId: null }, { createdByUserId: 'user-1' }],
      }),
    );
  });
```

- [ ] **Step 2: Run tests to verify the changed one fails**

Run: `pnpm --filter backend test -- books.service.spec.ts -t "BooksService.listLearningGoals"`
Expected: FAIL on "filters to built-in or own goals..." — `where` is
currently `undefined`, not the expected object.

- [ ] **Step 3: Update the implementation**

Modify `backend/src/books/books.service.ts`, replacing the existing
`listLearningGoals` method (lines 96-117):

```typescript
  async listLearningGoals(userId: string, childId?: string, explicitAge?: number) {
    let age = explicitAge;
    if (age === undefined && childId) {
      const child = await this.prisma.child.findFirst({
        where: { id: childId, userId },
        select: { age: true },
      });
      age = child?.age;
    }
    const excludeFlaw = age !== undefined && ageToAgeBand(age) === '3-4';
    const ownership = { OR: [{ createdByUserId: null }, { createdByUserId: userId }] };
    return this.prisma.learningGoal.findMany({
      where:
        age === undefined
          ? ownership
          : {
              ...ownership,
              ageRangeMin: { lte: age },
              ageRangeMax: { gte: age },
              ...(excludeFlaw ? { NOT: { arcType: 'flaw' as const } } : {}),
            },
      orderBy: { title: 'asc' },
    });
  }
```

- [ ] **Step 4: Run all `listLearningGoals` tests to verify they pass**

Run: `pnpm --filter backend test -- books.service.spec.ts -t "BooksService.listLearningGoals"`
Expected: PASS (6/6 — the 5 existing plus the new ownership test; the
3 tests using `expect.objectContaining` for the flaw-arcType checks are
unaffected since the added `OR` key doesn't break a partial match).

- [ ] **Step 5: Commit**

```bash
git add backend/src/books/books.service.ts backend/src/books/books.service.spec.ts
git commit -m "feat(books): scope listLearningGoals to built-in or the caller's own custom goals"
```

---

### Task 5: `createCustomLearningGoal` service method + controller route

**Files:**
- Modify: `backend/src/books/books.service.ts` (add method near `listLearningGoals`)
- Modify: `backend/src/books/books.controller.ts`
- Test: `backend/src/books/books.service.spec.ts` (new `describe` block + provider updates at lines 58, 136, 340, 436, 521)

**Interfaces:**
- Consumes: `LearningGoalSafetyService.check` from Task 2, `ageToAgeBand` from `backend/src/pdf/page-templates/page-templates.config.ts` (already imported in this file).
- Produces: `BooksService.createCustomLearningGoal(userId: string, dto: CreateCustomLearningGoalDto): Promise<LearningGoal>` and route `POST /learning-goals/custom` — consumed by the frontend in Task 7.

- [ ] **Step 1: Add the safety-service mock and constructor provider to all 5 test blocks**

In `backend/src/books/books.service.spec.ts`, add near the top (alongside
the existing `mockPrisma`/`mockS3` setup, before the first `describe`):

```typescript
import { LearningGoalSafetyService } from '../ai/learning-goal-safety/learning-goal-safety.service';

const mockLearningGoalSafety = { check: jest.fn() };
```

Then in **each** of the 5 `providers: [` arrays (starting at lines 58,
136, 340, 436, 521), add this entry alongside the existing
`PrismaService`/`S3Service` provides:

```typescript
        { provide: LearningGoalSafetyService, useValue: mockLearningGoalSafety },
```

(Without this, every existing test in the file fails at
`Test.createTestingModule(...).compile()` with "Nest can't resolve
dependencies of BooksService" once the constructor gains the new
parameter in Step 3 below.)

- [ ] **Step 2: Write the failing tests for the new method**

Add a new `describe` block at the end of
`backend/src/books/books.service.spec.ts`:

```typescript
describe('BooksService.createCustomLearningGoal', () => {
  let service: BooksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
        { provide: LearningGoalSafetyService, useValue: mockLearningGoalSafety },
      ],
    }).compile();
    service = module.get(BooksService);
  });

  it('rejects with the safety reason when the check fails', async () => {
    mockLearningGoalSafety.check.mockResolvedValueOnce({
      safe: false,
      reason: 'Тема не подходит для детской книги',
    });

    await expect(
      service.createCustomLearningGoal('user-1', { text: 'something unsafe' }),
    ).rejects.toThrow('Тема не подходит для детской книги');
    expect(mockPrisma.learningGoal.create).not.toHaveBeenCalled();
  });

  it('fails closed when the safety check itself throws', async () => {
    mockLearningGoalSafety.check.mockRejectedValueOnce(new Error('timeout'));

    await expect(
      service.createCustomLearningGoal('user-1', { text: 'любовь к чтению' }),
    ).rejects.toThrow('Не удалось проверить цель');
    expect(mockPrisma.learningGoal.create).not.toHaveBeenCalled();
  });

  it('creates a virtue goal owned by the user when safe', async () => {
    mockLearningGoalSafety.check.mockResolvedValueOnce({ safe: true });
    mockPrisma.learningGoal.create.mockResolvedValueOnce({ id: 'g-new' });

    await service.createCustomLearningGoal('user-1', { text: 'любовь к чтению' });

    expect(mockPrisma.learningGoal.create).toHaveBeenCalledWith({
      data: {
        title: 'любовь к чтению',
        description: 'любовь к чтению',
        arcType: 'virtue',
        createdByUserId: 'user-1',
      },
    });
  });

  it('forces virtue for a 3-4 child even if flaw was requested', async () => {
    mockLearningGoalSafety.check.mockResolvedValueOnce({ safe: true });
    mockPrisma.learningGoal.create.mockResolvedValueOnce({ id: 'g-new' });

    await service.createCustomLearningGoal('user-1', {
      text: 'терпение',
      childAge: 3,
      arcType: 'flaw',
    });

    expect(mockPrisma.learningGoal.create).toHaveBeenCalledWith({
      data: {
        title: 'терпение',
        description: 'терпение',
        arcType: 'virtue',
        createdByUserId: 'user-1',
      },
    });
  });

  it('sets a 5-6 age range for a flaw goal requested by a 5-6 child', async () => {
    mockLearningGoalSafety.check.mockResolvedValueOnce({ safe: true });
    mockPrisma.learningGoal.create.mockResolvedValueOnce({ id: 'g-new' });

    await service.createCustomLearningGoal('user-1', {
      text: 'терпение',
      childAge: 6,
      arcType: 'flaw',
    });

    expect(mockPrisma.learningGoal.create).toHaveBeenCalledWith({
      data: {
        title: 'терпение',
        description: 'терпение',
        arcType: 'flaw',
        createdByUserId: 'user-1',
        ageRangeMin: 5,
        ageRangeMax: 6,
      },
    });
  });
});
```

Also add `create: jest.fn()` to the `learningGoal` entry in `mockPrisma`
(near the top of the file, where `learningGoal: { findMany: ... }` is
currently defined) so `mockPrisma.learningGoal.create` exists:

```typescript
  learningGoal: {
    findMany: jest.fn<Promise<unknown[]>, [{ where?: unknown; orderBy?: unknown }]>(),
    create: jest.fn(),
  },
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter backend test -- books.service.spec.ts -t "BooksService.createCustomLearningGoal"`
Expected: FAIL — `service.createCustomLearningGoal is not a function`

- [ ] **Step 4: Add the DTO, constructor dependency, and method**

In `backend/src/books/books.service.ts`, update the imports at the top:

```typescript
import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, SubscriptionPlan } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { LearningGoalSafetyService } from '../ai/learning-goal-safety/learning-goal-safety.service';
import type { LearningGoalSafetyResult } from '../ai/schemas/learning-goal-safety.schema';
import { isActiveSubscriptionStatus } from '../prisma/subscription-status.util';
import { ageToAgeBand } from '../pdf/page-templates/page-templates.config';
```

Add the DTO near the existing `CreateChildDto`/`CreateBookDto` interfaces:

```typescript
interface CreateCustomLearningGoalDto {
  text: string;
  childAge?: number;
  arcType?: 'virtue' | 'flaw';
}
```

Find the `BooksService` class's constructor (it currently takes
`PrismaService` and `S3Service` — check the exact current parameter list
before editing, since this plan doesn't reproduce the whole class) and add
the new dependency:

```typescript
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly learningGoalSafety: LearningGoalSafetyService,
  ) {}
```

Add the new method directly after `listLearningGoals`:

```typescript
  async createCustomLearningGoal(userId: string, dto: CreateCustomLearningGoalDto) {
    let result: LearningGoalSafetyResult;
    try {
      result = await this.learningGoalSafety.check(dto.text, userId);
    } catch {
      throw new BadRequestException('Не удалось проверить цель, попробуйте ещё раз');
    }
    if (!result.safe) {
      throw new BadRequestException(result.reason ?? 'Эта цель не подходит для детской книги');
    }

    const ageBand = dto.childAge !== undefined ? ageToAgeBand(dto.childAge) : undefined;
    const arcType = ageBand === '3-4' ? 'virtue' : (dto.arcType ?? 'virtue');
    const ageRange = arcType === 'flaw' ? { ageRangeMin: 5, ageRangeMax: 6 } : {};

    return this.prisma.learningGoal.create({
      data: {
        title: dto.text,
        description: dto.text,
        arcType,
        createdByUserId: userId,
        ...ageRange,
      },
    });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter backend test -- books.service.spec.ts`
Expected: PASS, full file (all pre-existing suites plus the 5 new tests).

- [ ] **Step 6: Add the controller route**

In `backend/src/books/books.controller.ts`, add near the existing
`createChildSchema` at the top of the file:

```typescript
const createCustomLearningGoalSchema = z.object({
  text: z.string().trim().min(1).max(60),
  childAge: z.number().int().min(1).max(18).optional(),
  arcType: z.enum(['virtue', 'flaw']).optional(),
});
```

Add the route directly after the existing `listLearningGoals` handler
(after line 76):

```typescript
  @Post('learning-goals/custom')
  @HttpCode(HttpStatus.CREATED)
  createCustomLearningGoal(@CurrentUser() user: JwtPayload, @Body() body: unknown) {
    const dto = createCustomLearningGoalSchema.parse(body);
    return this.books.createCustomLearningGoal(user.sub, dto);
  }
```

- [ ] **Step 7: Verify the app builds**

Run: `pnpm --filter backend build`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add backend/src/books/books.service.ts backend/src/books/books.controller.ts backend/src/books/books.service.spec.ts
git commit -m "feat(books): add createCustomLearningGoal — safety-checked, owner-scoped"
```

---

### Task 6: Frontend — extract the form contract into `schema.ts`

**Files:**
- Create: `frontend/src/app/(app)/books/new/schema.ts`
- Modify: `frontend/src/app/(app)/books/new/page.tsx`

**Interfaces:**
- Produces: `schema`, `type FormValues`, `type LearningGoal`, `type Child`, `NEW_CHILD_VALUE`, `CUSTOM_GOAL_VALUE`, `toSeedList` — consumed by `page.tsx` (this task) and `LearningGoalPicker.tsx` (Task 7).

- [ ] **Step 1: Create the schema file**

Create `frontend/src/app/(app)/books/new/schema.ts`:

```typescript
import { z } from 'zod';

export interface Child {
  id: string;
  name: string;
  age: number;
  appearance?: string | null;
}

export interface LearningGoal {
  id: string;
  title: string;
  description: string;
}

export const NEW_CHILD_VALUE = '';
export const CUSTOM_GOAL_VALUE = '__custom__';

export const schema = z
  .object({
    selectedChildId: z.string().optional(),
    childName: z.string().optional(),
    childAge: z.coerce.number().optional(),
    childGender: z.enum(['male', 'female', 'other', '']).optional(),
    childAppearance: z
      .string()
      .max(1500, 'Слишком длинное описание — максимум 1500 символов')
      .optional(),
    learningGoalId: z.string().min(1, 'Выберите цель обучения'),
    customGoalText: z.string().optional(),
    customGoalArcType: z.enum(['virtue', 'flaw']).optional(),
    mode: z.enum(['fast', 'custom']),
    protagonistMode: z.enum(['child', 'observer']),
    artStyle: z.enum(['watercolor', 'cartoon', 'storybook', 'pixel', 'realistic']),
    interests: z.string().optional(),
    motifs: z.string().optional(),
    favoriteWords: z.string().optional(),
  })
  // childName/childAge are only required when creating a new child (no existing
  // child selected) — an existing child already has both, so re-asking is noise.
  .superRefine((values, ctx) => {
    if (!values.selectedChildId) {
      if (!values.childName?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['childName'], message: 'Введите имя' });
      }
      const age = Number(values.childAge);
      if (!Number.isInteger(age) || age < 3 || age > 6) {
        ctx.addIssue({ code: 'custom', path: ['childAge'], message: 'Доступно 3–6 лет' });
      }
    }
    if (values.learningGoalId === CUSTOM_GOAL_VALUE) {
      const text = values.customGoalText?.trim() ?? '';
      if (!text) {
        ctx.addIssue({ code: 'custom', path: ['customGoalText'], message: 'Опишите цель' });
      } else if (text.length > 60) {
        ctx.addIssue({
          code: 'custom',
          path: ['customGoalText'],
          message: 'Максимум 60 символов',
        });
      }
    }
  });

export type FormValues = z.infer<typeof schema>;

// Personalization seeds (#197): comma-separated free text → capped string list.
// Matches the backend cap (≤6 items, ≤60 chars each); empty entries dropped.
export const toSeedList = (raw?: string): string[] =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((s) => s.slice(0, 60));
```

- [ ] **Step 2: Update `page.tsx` to import from it instead of defining inline**

In `frontend/src/app/(app)/books/new/page.tsx`, remove the inline
`interface Child`, `NEW_CHILD_VALUE`, `interface LearningGoal`, `schema`
(the whole `z.object({...}).superRefine(...)` block), `type FormValues`,
and `toSeedList` — all of it now lives in `schema.ts`. Replace with an
import:

```typescript
import {
  schema,
  toSeedList,
  NEW_CHILD_VALUE,
  CUSTOM_GOAL_VALUE,
  type FormValues,
  type Child,
  type LearningGoal,
} from './schema';
```

Everything else in `page.tsx` (the `useForm<FormValues>` call, `register`,
`watch`, etc.) is unchanged by this step — it already references
`FormValues`/`schema` by name, which now resolve via the import instead of
a local definition.

- [ ] **Step 3: Verify nothing broke**

Run: `pnpm --filter frontend build`
Expected: exits 0 — a pure extraction, no behavior change yet (the new
`customGoalText`/`customGoalArcType` fields and `CUSTOM_GOAL_VALUE` exist
in the schema but nothing references them from the UI until Task 7).

Run: `pnpm --filter frontend lint`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/\(app\)/books/new/schema.ts frontend/src/app/\(app\)/books/new/page.tsx
git commit -m "refactor(books): extract books/new's form schema into schema.ts"
```

---

### Task 7: Frontend — `LearningGoalPicker` component + wire into `page.tsx`

**Files:**
- Create: `frontend/src/app/(app)/books/new/LearningGoalPicker.tsx`
- Test: `frontend/src/app/(app)/books/new/LearningGoalPicker.test.tsx`
- Modify: `frontend/src/app/(app)/books/new/page.tsx`

**Interfaces:**
- Consumes: `FormValues`, `LearningGoal`, `CUSTOM_GOAL_VALUE` from `./schema` (Task 6).
- Produces: `<LearningGoalPicker>` React component, rendered by `page.tsx`.

- [ ] **Step 1: Write the failing component test**

Create `frontend/src/app/(app)/books/new/LearningGoalPicker.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LearningGoalPicker } from './LearningGoalPicker';
import { schema, CUSTOM_GOAL_VALUE, type FormValues, type LearningGoal } from './schema';

const goals: LearningGoal[] = [{ id: 'g1', title: 'Доброта', description: 'x' }];

function Harness({ childAge }: { childAge?: number }): React.ReactElement {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: 'custom',
      protagonistMode: 'child',
      artStyle: 'watercolor',
      customGoalArcType: 'virtue',
      learningGoalId: '',
    },
  });
  return (
    <LearningGoalPicker
      goals={goals}
      childAge={childAge}
      register={register}
      watch={watch}
      setValue={setValue}
      errors={errors}
    />
  );
}

describe('LearningGoalPicker', () => {
  it('reveals a text field when "+ Своя цель" is selected', async () => {
    render(<Harness childAge={5} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), CUSTOM_GOAL_VALUE);
    expect(screen.getByLabelText(/опишите цель/i)).toBeInTheDocument();
  });

  it('shows the arc-type choice for a 5-6 child', async () => {
    render(<Harness childAge={5} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), CUSTOM_GOAL_VALUE);
    expect(screen.getByText(/герой учится хорошему/i)).toBeInTheDocument();
  });

  it('hides the arc-type choice for a 3-4 child', async () => {
    render(<Harness childAge={3} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), CUSTOM_GOAL_VALUE);
    expect(screen.queryByText(/герой учится хорошему/i)).not.toBeInTheDocument();
  });

  it('does not show the custom-goal field for a built-in goal', () => {
    render(<Harness childAge={5} />);
    expect(screen.queryByLabelText(/опишите цель/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter frontend test -- LearningGoalPicker.test.tsx`
Expected: FAIL — `Cannot find module './LearningGoalPicker'`

- [ ] **Step 3: Write the component**

Create `frontend/src/app/(app)/books/new/LearningGoalPicker.tsx`:

```tsx
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form';
import { CUSTOM_GOAL_VALUE, type FormValues, type LearningGoal } from './schema';

interface LearningGoalPickerProps {
  goals: LearningGoal[];
  childAge: number | undefined;
  register: UseFormRegister<FormValues>;
  watch: UseFormWatch<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  errors: FieldErrors<FormValues>;
}

export function LearningGoalPicker({
  goals,
  childAge,
  register,
  watch,
  setValue,
  errors,
}: LearningGoalPickerProps): React.ReactElement {
  const learningGoalId = watch('learningGoalId');
  const customGoalArcType = watch('customGoalArcType');
  const isCustom = learningGoalId === CUSTOM_GOAL_VALUE;
  const canPickArcType = isCustom && childAge !== undefined && childAge >= 5;

  return (
    <div className="sg-card">
      <span className="sg-section-label">Цель обучения</span>
      <label className="sg-label" htmlFor="learningGoalId">
        Чему научит история
      </label>
      <select id="learningGoalId" className="sg-select" {...register('learningGoalId')}>
        <option value="">— выберите цель —</option>
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.title}
          </option>
        ))}
        <option value={CUSTOM_GOAL_VALUE}>+ Своя цель</option>
      </select>
      {errors.learningGoalId && (
        <span className="sg-field-hint text-danger">{errors.learningGoalId.message}</span>
      )}

      {isCustom && (
        <div className="mt-4">
          <label className="sg-label" htmlFor="customGoalText">
            Опишите цель
          </label>
          <input
            id="customGoalText"
            className="sg-input"
            placeholder="Например: бережное отношение к книгам"
            maxLength={60}
            {...register('customGoalText')}
          />
          {errors.customGoalText && (
            <span className="sg-field-hint text-danger">{errors.customGoalText.message}</span>
          )}

          {canPickArcType && (
            <div className="mt-3">
              <label className="sg-label">Какая это история</label>
              <div className="sg-seg">
                <button
                  type="button"
                  className="sg-seg-opt"
                  data-active={customGoalArcType === 'virtue'}
                  onClick={() => setValue('customGoalArcType', 'virtue')}
                >
                  Герой учится хорошему
                </button>
                <button
                  type="button"
                  className="sg-seg-opt"
                  data-active={customGoalArcType === 'flaw'}
                  onClick={() => setValue('customGoalArcType', 'flaw')}
                >
                  Герой ошибается и исправляет
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter frontend test -- LearningGoalPicker.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 5: Wire it into `page.tsx`**

In `frontend/src/app/(app)/books/new/page.tsx`:

Add the import:

```typescript
import { LearningGoalPicker } from './LearningGoalPicker';
```

Add `customGoalArcType: 'virtue'` to the `useForm`'s `defaultValues`
object (alongside the existing `mode: 'custom'`, `protagonistMode:
'child'`, etc.).

Add `const learningGoalId = watch('learningGoalId');` next to the existing
`const mode = watch('mode');` line.

Replace the entire `{/* ── Цель обучения ── */}` card block (the
`<div className="sg-card">` containing the goal `<select>`) with:

```tsx
        <LearningGoalPicker
          goals={goals}
          childAge={childAge}
          register={register}
          watch={watch}
          setValue={setValue}
          errors={errors}
        />
```

In the `{/* ── Режим создания ── */}` block, wrap the Fast Flow
`<label className="sg-radio-card" ...>` option in a condition so it is
hidden for a custom goal (Fast Flow has no template for a goal that
doesn't exist ahead of time):

```tsx
            {learningGoalId !== CUSTOM_GOAL_VALUE && (
              <label className="sg-radio-card" data-checked={mode === 'fast'}>
                <input type="radio" value="fast" className="sr-only" {...register('mode')} />
                <span className="sg-radio-dot" />
                <span>
                  <b>Быстрый</b>
                  <span className="sg-radio-desc">Готовая история из шаблона — за секунды</span>
                </span>
              </label>
            )}
```

Add an effect right after the existing `useEffect` blocks (the one
fetching `/children` and the one fetching `/learning-goals`) that forces
`mode` to `'custom'` when a custom goal is selected, so a parent can't end
up on `fast` mode with a goal that has no template:

```typescript
  useEffect(() => {
    if (learningGoalId === CUSTOM_GOAL_VALUE && mode !== 'custom') {
      setValue('mode', 'custom');
    }
  }, [learningGoalId, mode, setValue]);
```

Finally, update `onSubmit` to resolve a real `learningGoalId` before
creating the book — insert this right after the existing `childId`
resolution (the `const childId = values.selectedChildId ? ... : (...).id;`
block) and before the `if (values.mode === 'fast')` branch:

```typescript
      const learningGoalId =
        values.learningGoalId === CUSTOM_GOAL_VALUE
          ? (
              await api.post<LearningGoal>('/learning-goals/custom', {
                text: values.customGoalText?.trim(),
                childAge,
                arcType: values.customGoalArcType,
              })
            ).id
          : values.learningGoalId;
```

Then replace every remaining `learningGoalId: values.learningGoalId` in
the two `api.post<...>('/books', {...})` calls further down with
`learningGoalId` (the newly-resolved local variable, not
`values.learningGoalId`).

- [ ] **Step 6: Verify the file is back under the 400-line hard constraint**

Run: `wc -l "frontend/src/app/(app)/books/new/page.tsx"`
Expected: under 400 (extraction in Task 6 plus replacing the goal card's
~14 lines of JSX with a 7-line component call should land it in the
mid-to-high 300s; if it's still over 400, extract the "Ребёнок" card into
its own component the same way before moving on — do not commit a file
over the limit).

- [ ] **Step 7: Verify everything builds and lints**

Run: `pnpm --filter frontend build`
Expected: exits 0.

Run: `pnpm --filter frontend lint`
Expected: exits 0.

Run: `pnpm --filter frontend test`
Expected: all tests pass, including the new `LearningGoalPicker.test.tsx`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/\(app\)/books/new/
git commit -m "feat(books): add LearningGoalPicker with custom-goal creation flow"
```

---

### Task 8: Live verification on novel custom topics (mandatory, not optional)

**Files:**
- Create: `docs/process/eval-baselines/2026-07-28-custom-goal-novel-topics.json` (or `.md` if the eval script's output isn't directly reusable for topics with no `LearningGoal` row — see Step 1)

This task has no code changes. It exists because this feature makes every
generation go through `pickExemplar`'s random-pool fallback (previously
the rare case for a goal with no exemplar; now the *default* case for
every custom goal) — the same class of path #313 fixed, but never
exercised end-to-end on genuinely novel topics. Per `AGENTS.md`'s "Done is
not a mood": this is not done on a green `init.sh` alone.

- [ ] **Step 1: Check whether `eval:batch`/`eval:text` can target an
      arbitrary topic string directly, or only an existing `LearningGoal`**

Run: `pnpm --filter backend eval:text --help` (or read
`backend/src/scripts/eval-text.ts`'s argument parsing) to confirm whether
it accepts a raw `--topic`/`--goal` string, or only a `LearningGoal.title`
that must already exist in the seeded set.

- [ ] **Step 2a (if a raw topic is supported):** run `eval:text` for 3-5
      deliberately novel topics, e.g.:

```bash
pnpm --filter backend eval:text --topic="Любовь к чтению" --age=5 --arc=virtue
pnpm --filter backend eval:text --topic="Уважение к чужому мнению" --age=6 --arc=flaw
pnpm --filter backend eval:text --topic="Терпение в очереди" --age=4 --arc=virtue
```

- [ ] **Step 2b (if only seeded goals are supported):** use the local dev
      stack (`docker compose up -d`, `pnpm --filter backend dev`,
      `E2E_TEST_MODE=true` + `POST /auth/test-login` per
      `docs/local-dev.md`) to actually call the new
      `POST /learning-goals/custom` endpoint with 3-5 novel topics, then
      generate a real Custom Flow book for each through `POST /books` +
      `POST /books/:id/generate`, and read the resulting `StoryEval` rows
      and story text directly (`docker compose exec postgres psql`, same
      approach used earlier this session to verify the staged defense
      book against #313).

- [ ] **Step 3: Read the actual output, not just the pass/fail flag**

For each of the 3-5 topics, confirm by reading the generated text:
- The story is actually about the requested topic (not a mismatched
  exemplar's plot bleeding through).
- No repeated-refrain artifact from the fallback exemplar (the #312/#313
  failure mode).
- `registerMatch` clears the 7.0 threshold.

If any topic produces a bad result, that is real information, not a
blocker to silently work around — bring it back to design (does the
exemplar pool need a genuinely goal-agnostic "default" craft exemplar
per age band, rather than relying on a random pick from goal-specific
ones?) rather than shipping regardless.

- [ ] **Step 4: Record the result**

Save the output (whichever form Step 1 determined) to
`docs/process/eval-baselines/2026-07-28-custom-goal-novel-topics.json` (or
`.md` for the manual-generation path), same convention as
`docs/process/eval-baselines/2026-07-25-plan-invent-scenario.json` from
#313.

- [ ] **Step 5: Update `progress.md`**

Add a session entry summarizing the feature, referencing this plan file
and the verification result — following this project's existing
`progress.md` entry format (`## YYYY-MM-DD — <type>: <summary>`, with
**Done:**/**Decisions:**/**Blockers:** sections).

- [ ] **Step 6: Commit**

```bash
git add docs/process/eval-baselines/2026-07-28-custom-goal-novel-topics.* progress.md
git commit -m "docs(eval): verify custom-goal generation on novel topics"
```
