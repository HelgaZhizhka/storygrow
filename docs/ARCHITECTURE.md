# Architecture — StoryGrow

High-level structure of the monorepo, AI pipeline, and data flow.

---

## Monorepo layout

```
storygrow/
├── backend/                    # NestJS application
│   ├── src/
│   │   ├── main.ts             # bootstrap
│   │   ├── app.module.ts
│   │   ├── config/             # ConfigService, env validation
│   │   ├── auth/               # Google OAuth, JWT guards
│   │   ├── users/              # User + Child entities
│   │   ├── books/              # Book + BookPage CRUD, status
│   │   ├── learning-goals/     # Admin-managed pedagogical goals
│   │   ├── ai/
│   │   │   ├── ai.module.ts
│   │   │   ├── prompts/        # Prompt constants (system, judge, ...)
│   │   │   ├── schemas/        # Zod schemas (StorySchema, JudgeSchema)
│   │   │   ├── vocabulary-rag.service.ts
│   │   │   ├── story-generator.service.ts
│   │   │   ├── story-evaluator.service.ts
│   │   │   ├── image-generator.service.ts
│   │   │   └── langfuse.module.ts
│   │   ├── generation/         # BullMQ producer + processor
│   │   ├── pdf/                # Puppeteer renderer
│   │   ├── storage/            # S3/MinIO module
│   │   ├── payments/           # Stripe checkout + webhooks
│   │   ├── eval/               # StoryEval aggregations, admin metrics
│   │   └── sse/                # SSE channels for progress
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── scripts/                # one-off: corpus indexing, seed
│   ├── test/                   # e2e tests
│   ├── eslint.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/                   # Next.js (App Router)
│   ├── src/
│   │   ├── app/                # Route groups
│   │   │   ├── (marketing)/    # public SEO pages
│   │   │   ├── (app)/          # authed app
│   │   │   └── admin/          # admin dashboard
│   │   ├── components/         # shared UI
│   │   ├── lib/                # API client, hooks, utils
│   │   └── styles/
│   ├── eslint.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── docker-compose.yml          # postgres+pgvector, redis, minio, langfuse
├── package.json                # workspace root
├── pnpm-workspace.yaml
├── prettier.config.js
├── .env.example
├── init.sh
└── (harness files in repo root: CLAUDE.md, AGENTS.md, ...)
```

---

## AI pipeline (custom flow)

```
┌─────────────────────────────────────────────────────────────────┐
│ HTTP: POST /books  (childId, learningGoalId, mode='custom')     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────────┐
              │ BooksController                   │
              │  → BooksService.create(...)       │
              │  → enqueue BullMQ job             │
              │     'generation.generateBook'     │
              │  → return { bookId, jobId }       │
              └───────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────────┐
              │ GenerationProcessor               │  (BullMQ worker)
              └───────────────────────────────────┘
                              │
                              ▼
         ┌───────────────────────────────────────────┐
         │ 1. VocabularyRagService.retrieve(age)     │
         │      → SELECT word, gradeLevel            │
         │        FROM vocabulary_entry              │
         │        WHERE gradeLevel = $age_band       │
         │        ORDER BY embedding <-> $q LIMIT 50 │
         │      → returns word list                  │
         └───────────────────────────────────────────┘
                              │
                              ▼
         ┌───────────────────────────────────────────┐
         │ 2. StoryGenerator.generate(input, words)  │
         │      → buildPrompt(prompts/STORY_SYSTEM)  │
         │      → ai.generateObject({                 │
         │          model: openai('gpt-4o-mini'),    │
         │          schema: StorySchema,             │
         │          prompt,                           │
         │          experimental_telemetry: {...}    │
         │        })                                  │
         │      → typed Story                         │
         └───────────────────────────────────────────┘
                              │
                              ▼
         ┌───────────────────────────────────────────┐
         │ 3. StoryEvaluator.evaluate(story, input)  │
         │      → ai.generateObject({                 │
         │          schema: JudgeSchema,              │
         │          prompt: judgePrompt(story)        │
         │        })                                  │
         │      → judgeScores                         │
         │      → persist StoryEval(attempt, scores)  │
         │      → final = mean(scores)                │
         │      → if final < EVAL_THRESHOLD &&        │
         │           attempt < EVAL_MAX_RETRIES       │
         │           → goto step 2 (attempt+=1)       │
         └───────────────────────────────────────────┘
                              │
                              ▼
         ┌───────────────────────────────────────────┐
         │ 4. ImageGenerator.generate(prompts)       │
         │      → for each illustrationPrompt:        │
         │          openai.images.generate(gpt-image-1)│
         │          upload to S3 → store key in       │
         │          Book.imageKeys[]                  │
         └───────────────────────────────────────────┘
                              │
                              ▼
         ┌───────────────────────────────────────────┐
         │ 5. PDFRenderer.render(story, images)      │
         │      → Puppeteer: HTML template → PDF      │
         │      → upload to S3                        │
         │      → update Book.status='ready'          │
         │      → update Book.pdfUrl                   │
         └───────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────────┐
              │ SSE channel pushes 'done' event    │
              │ Frontend redirects to book page    │
              └───────────────────────────────────┘
```

Each step publishes a progress event to an SSE channel keyed by `jobId`.

Every AI call is wrapped with LangFuse telemetry, producing a trace with metadata `{ bookId, attempt, step }`.

---

## Fast flow (AI-assisted, synchronous)

```
POST /books { mode='fast', childId, learningGoalId }
   → pick Template by learningGoal + child age
   → ai.generateObject(StorySchema) with template as context
   → substitute child name / goal placeholders
   → pick FastIllustration by template tags (pre-rendered images)
   → write BookPage rows to DB
   → Puppeteer → PDF → S3
   → return book (sub-10-second response)
```

No BullMQ queue (synchronous). No `StoryEval`. LangFuse trace written for the `generateObject` call.

---

## Database (Prisma sketch)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  googleId      String?  @unique
  children      Child[]
  books         Book[]
  subscription  Subscription?
  createdAt     DateTime @default(now())
}

model Child {
  id         String  @id @default(cuid())
  userId     String
  user       User    @relation(fields: [userId], references: [id])
  name       String
  age        Int
  gender     String?
  interests  String[]
  books      Book[]
}

model LearningGoal {
  id           String  @id @default(cuid())
  slug         String  @unique     // 'sharing', 'fear-of-dark'
  titleRu      String
  description  String
  ageRangeMin  Int
  ageRangeMax  Int
  books        Book[]
}

model Book {
  id              String      @id @default(cuid())
  userId          String
  childId         String
  learningGoalId  String
  status          BookStatus  // 'pending'|'generating'|'ready'|'failed'|'images_failed'|'generation_failed'
  title           String
  storyJson       Json?       // full Story payload (custom flow)
  imageKeys       String[]    // S3 keys for page illustrations
  pdfKey          String?     // S3 key for the rendered PDF
  pages           BookPage[]  // populated by fast flow
  evals           StoryEval[]
  createdAt       DateTime    @default(now())
}

model BookPage {
  id          String  @id @default(cuid())
  bookId      String
  pageNumber  Int
  text        String
  imageUrl    String?
  book        Book    @relation(fields: [bookId], references: [id])
}

model StoryEval {
  id                   String   @id @default(cuid())
  bookId               String
  attempt              Int
  judgeScores          Json     // { ageAppropriateVocab, hasMoralLesson, structureCompleteness, safetyForChildren, length }
  judgeReasoning       String?
  finalScore           Float
  vocabularyCompliance Float?
  passed               Boolean
  generatedAt          DateTime @default(now())
  book                 Book     @relation(fields: [bookId], references: [id])
}

model VocabularyEntry {
  id          String                @id @default(cuid())
  word        String
  gradeLevel  Int                   // 0..4 (Dale-Chall / AoA mapped)
  frequency   Float
  embedding   Unsupported("vector(1536)")
}

model Template {
  id            String  @id @default(cuid())
  slug          String  @unique
  titleRu       String
  ageRangeMin   Int
  ageRangeMax   Int
  body          String     // template text with {{placeholders}}
  illustrations Json       // [{ tag, s3Key }, ...]
}

model Subscription {
  id                    String   @id @default(cuid())
  userId                String   @unique
  user                  User     @relation(fields: [userId], references: [id])
  stripeSubscriptionId  String   @unique
  plan                  String   // 'free' | 'basic' | 'pro'
  status                String
  periodEnd             DateTime
  booksThisPeriod       Int      @default(0)
}
```

---

## Observability

- **LangFuse** runs locally (`docker compose up langfuse`).
- Every `generateObject` / `generateText` / `embed` call passes `experimental_telemetry`.
- Aggregations live in Postgres (`StoryEval` table) and are surfaced in the admin dashboard:
  - % of books accepted on first attempt
  - Mean score per criterion (last 7 days)
  - Token spend per day
- These metrics are the "eval story" shown on defense day.

---

## Why not LangChain

Our pipeline is **deterministic** (input → retrieve → generate → judge → render). There is no multi-step tool use, no agent loop, no provider abstraction need. LangChain would add layers of abstraction over what is essentially five sequential service calls — increasing debugger surface area without adding capability.

---

## Deployment

```
Hetzner CX22 (or CX32) ─── Dokploy ─── stories.example.com
                                  │
                                  ├── frontend (Next.js, port 3000)
                                  ├── backend  (NestJS, port 3001)
                                  ├── postgres + pgvector
                                  ├── redis
                                  ├── minio
                                  └── langfuse
```

Domain → Cloudflare (proxied) → Dokploy → Traefik (built-in) → containers. HTTPS via Let's Encrypt managed by Dokploy.
