# Architecture — StoryGrow

High-level structure of the monorepo, AI pipeline, and data flow.

---

## Monorepo layout

```
storygrow/
├── backend/                    # NestJS application
│   ├── src/
│   │   ├── main.ts             # bootstrap (imports instrument.ts first)
│   │   ├── instrument.ts       # LangFuse OTEL NodeSDK init (before Nest boots)
│   │   ├── app.module.ts
│   │   ├── health.controller.ts
│   │   ├── auth/               # Google OAuth, JWT guards
│   │   ├── books/              # Book CRUD + status; SSE progress (progress.controller)
│   │   ├── admin/              # admin dashboard: books + learning-goal mgmt, eval metrics
│   │   ├── ai/
│   │   │   ├── ai.module.ts
│   │   │   ├── ai.config.ts            # models, STYLE_SUFFIXES, thresholds
│   │   │   ├── telemetry.ts            # LangFuse helper for AI calls
│   │   │   ├── prompts/                # prompt constants + Gold Exemplars
│   │   │   ├── schemas/                # Zod schemas (story.schema, judge.schema)
│   │   │   ├── story-generator/        # orchestrator + generator + evaluator services
│   │   │   ├── image-generator/        # providers (Gemini default, gpt-image-1) + portrait stage + simplifier
│   │   │   ├── rag/                    # vocabulary-rag.service + age-grade map
│   │   │   └── validators/             # book-plan validator
│   │   ├── generation/         # BullMQ producer + processor + stale-book sweeper
│   │   ├── fast-flow/          # synchronous fast-flow generation (templates)
│   │   ├── pdf/                # Puppeteer renderer
│   │   ├── s3/                 # S3/MinIO module
│   │   ├── billing/            # Stripe checkout + webhooks
│   │   ├── prisma/             # PrismaService module
│   │   ├── generated/prisma/   # generated Prisma client (output target)
│   │   └── scripts/            # one-off: corpus indexing, eval-text harness, gen-style-previews
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── test/                   # e2e tests
│   ├── eslint.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/                   # Next.js (App Router)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # public landing
│   │   │   ├── login/          # public login (Google OAuth)
│   │   │   ├── pricing/        # single-tier pricing (Stripe) — reachable public or authed
│   │   │   ├── subscription/   # post-checkout success
│   │   │   ├── auth/           # OAuth callback
│   │   │   ├── (app)/          # authed app (books list, new, detail, account)
│   │   │   ├── admin/          # admin dashboard
│   │   │   ├── globals.css     # design tokens + sg-* component layer
│   │   │   └── marketing.css   # landing/login/pricing component layer
│   │   ├── components/         # shared UI (PublicNav, ThemeToggle, ...)
│   │   └── lib/                # API client, auth, utils
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
         │ 1. StoryGenerator.generateStory(input)    │
         │    Decomposed (ADR-0005), up to three calls: │
         │                                            │
         │  1a. Plan  [PLAN_MODEL = gpt-4o]           │
         │      → generateObject(StoryPlanSchema)     │
         │      → StoryPlan "bible": hero + fixed     │
         │        name, page layout, per-page         │
         │        beat + intent, safe conflict        │
         │        (arc from LearningGoal.arcType),    │
         │        lesson, discussion questions,       │
         │        a working title (overridden later)  │
         │      trace: story-planner                  │
         │                                            │
         │  1b. Prose  [PROSE_MODEL = gpt-5]          │
         │      → generateObject(StorySchema)         │
         │      → renders the plan in the Сутеев      │
         │        read-aloud register (one Gold       │
         │        Exemplar shown); structure already  │
         │        fixed, so the call only does VOICE; │
         │        self-anchors any recurring story-    │
         │        invented animal to one fixed English │
         │        descriptor across pages (#223/#237)  │
         │      trace: story-prose                    │
         │                                            │
         │  1c. Title  [PLAN_MODEL = gpt-4o]          │
         │      → generateObject({title})              │
         │      → concrete title from the FINISHED     │
         │        story (not the abstract plan, which  │
         │        kept naming the learning value);     │
         │        isConcreteTitle gate, ≤3 retries      │
         │      trace: story-title                     │
         │  (No vocabulary-RAG step — removed in      │
         │   ADR-0005; age-fit lives in the judge. A   │
         │   Companions step, anchoring a parent-named  │
         │   pet seed, was tried and removed — #245.)  │
         └───────────────────────────────────────────┘
                              │
                              ▼
         ┌───────────────────────────────────────────┐
         │ 2. StoryEvaluator.evaluate(story, input)  │
         │      → generateObject(JudgeSchema)         │
         │      → scores split: Guardrails (gates) +  │
         │        Craft = registerMatch (two-sided)   │
         │      → persist StoryEval(attempt, scores)  │
         │      → finalScore = registerMatch          │
         │      → accept iff guardrails ≥ floor AND   │
         │        registerMatch ≥ EVAL_THRESHOLD      │
         │      → else, while attempt < MAX_RETRIES,  │
         │        regenerate (back to step 1 with     │
         │        register feedback)                  │
         └───────────────────────────────────────────┘
                              │
                              ▼
         ┌───────────────────────────────────────────┐
         │ 3. ImageGenerator.generate(prompts)       │
         │      → portrait from characterProfile,     │
         │        then Gemini 2.5 Flash Image per page │
         │        WITH the portrait as a reference     │
         │        (gpt-image-1 fallback via config)    │
         │      → upload to S3 → Book.imageKeys[]      │
         │      → portrait key → Book.characterPortraitKey│
         └───────────────────────────────────────────┘
                              │
                              ▼
         ┌───────────────────────────────────────────┐
         │ 4. PDFRenderer.render(story, images)      │
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
  appearance String?    // free-text visual description; blank → LLM invents
  interests  String[]
  books      Book[]
}

model LearningGoal {
  id           String     @id @default(cuid())
  title        String
  description  String
  ageRangeMin  Int        @default(1)
  ageRangeMax  Int        @default(18)
  books        Book[]
  templates    Template[]
}

model Book {
  id              String      @id @default(cuid())
  userId          String
  childId         String
  learningGoalId  String
  status          BookStatus  // 'pending'|'generating'|'ready'|'failed'|'images_failed'
  title           String
  protagonistMode ProtagonistMode  // 'child' (hero = the child) | 'observer' (invented character)
  artStyle        ArtStyle    // 'watercolor'|'cartoon'|'storybook'|'pixel'|'realistic'
  interests       String[]    // personalization seeds (#197) — soft Plan input
  motifs          String[]    // "
  favoriteWords   String[]    // "
  storyJson           Json?       // full Story payload (custom flow)
  imageKeys           String[]    // S3 keys for page illustrations
  characterPortraitKey String?    // S3 key of the Gemini reference portrait
  pdfKey              String?     // S3 key for the rendered PDF
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
  judgeScores          Json     // Guardrails { ageAppropriateVocab, hasMoralLesson, structureCompleteness, safetyForChildren, length, earnedResolution } + Craft { registerMatch } (ADR-0005)
  judgeReasoning       String?
  finalScore           Float    // = registerMatch (craft signal); guardrails are gates, not averaged in
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
  id               String       @id @default(cuid())
  title            String
  content          Json             // template body with {{placeholders}}
  learningGoalId   String
  learningGoal     LearningGoal @relation(fields: [learningGoalId], references: [id])
  illustrationTags String[]         // tags → FastIllustration lookup
}

model FastIllustration {
  id    String   @id @default(cuid())
  url   String
  tags  String[]
}

model Subscription {
  id                    String              @id @default(cuid())
  userId                String              @unique
  user                  User                @relation(fields: [userId], references: [id])
  stripeSubscriptionId  String              @unique
  plan                  SubscriptionPlan    @default(free)  // enum: free | premium (single paid tier, #269)
  status                SubscriptionStatus                  // enum: active | canceled | past_due | trialing
  periodEnd             DateTime
}
```

> Per-period quota is derived from the user's `plan` against book counts, not stored as a column. Auth fields (`User.role`, `refreshToken`), `StripeWebhookEvent`, and the `BookStatus`/`ProtagonistMode`/`ArtStyle` enums are omitted from this sketch — see `backend/prisma/schema.prisma` for the canonical definitions.

---

## Observability

- **LangFuse** runs locally (`docker compose up langfuse`).
- Every `generateObject` / `generateText` / `embed` call passes `experimental_telemetry`.
- Aggregations live in Postgres (`StoryEval` table) and are surfaced in the admin dashboard:
  - % of books accepted on first attempt
  - Mean score per criterion (last 7 days)
  - Token spend per day
- These metrics track output quality over time and surface drift before users feel it.

---

## Why not LangChain

Our pipeline is **deterministic** (input → retrieve → generate → judge → render). There is no multi-step tool use, no agent loop, no provider abstraction need. LangChain would add layers of abstraction over what is essentially five sequential service calls — increasing debugger surface area without adding capability.

---

## Deployment

**Live on Railway** (not the Hetzner+Dokploy path originally planned — see [docs/deploy-railway.md](deploy-railway.md) for the full setup and [docs/deploy-checklist.md](deploy-checklist.md) for the Dokploy alternative, kept as a fallback but not in use):

```
Railway project "storygrow"
  ├── storygrow-api  (backend,  Dockerfile, port 3001 → Railway PORT=8080)
  ├── storygrow-web  (frontend, Dockerfile, port 3000 → Railway PORT=8080)
  ├── Postgres (pgvector template)
  └── Redis
Cloudflare R2 ── S3-compatible object storage (images, portraits, PDFs)
```

Each service gets a Railway-generated `*.up.railway.app` domain (custom domain not yet configured). HTTPS is Railway-managed. `LANGFUSE_ENABLED=false` in production (self-hosted LangFuse only runs in local `docker compose`); LangFuse Cloud is a known follow-up.
