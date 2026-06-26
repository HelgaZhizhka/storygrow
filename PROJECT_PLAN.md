# StoryGrow — Project Plan

## Concept

**A pedagogically-grounded generator of personalised children's books.** A parent enters their child's name, age, and a developmental goal (e.g. *"learn to share"*, *"stop being afraid of the dark"*). The system generates a story in which the protagonist bears the child's name, **the vocabulary and plot structure are adapted to the child's age by a pedagogical model, and quality is automatically verified by an LLM-as-judge with regeneration on low scores**. The output is a PDF plus a list of discussion questions for the parent to read with the child.

## Course context

The project is built within the **"Course on building and launching a SaaS service with AI"** (RS School / Vladimir Yakovlev). The course provides a baseline template — a children's book generator. This project is an **author's variant on the same architecture**, with deeper investment in AI engineering (RAG, structured generation, evaluation) that differentiates it from the baseline.

**Deadline:** 5 weeks until the course defense.

## Target audience

- Parents of children aged 3–10
- They want personalised stories with pedagogical value, not "generic fairy tales"
- They are willing to pay a subscription for high-quality personalised content

## Difference from the baseline course version

| | Baseline StoryCraft (course template) | StoryGrow (this project) |
|---|---|---|
| AI pipeline | `prompt → GPT → text → DALL-E → image` | `RAG → structured gen → LLM judge → regenerate on low score` |
| Age adaptation | A prompt like "for children" | RAG over age-banded lexical corpora |
| Quality control | None | Automated LLM-as-judge + metrics in the DB |
| Story structure | Free-form text | Function calling against a pedagogical schema |
| Observability | Logs | LangFuse: traces, scores, dashboard |

## Tech stack

| Layer | Technology |
|------|------------|
| Frontend | Next.js (App Router) |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 15+ with the `pgvector` extension |
| Queue | BullMQ + Redis |
| Storage | S3 / MinIO (local via docker-compose) |
| AI SDK | **Vercel AI SDK** (`ai`, `@ai-sdk/openai`, `zod`) — no LangChain |
| LLM | OpenAI `gpt-4o` (story text), `gpt-4o-mini` (judge + fast flow), `text-embedding-3-small` (embeddings) |
| Image gen | Google `gemini-2.5-flash-image` (default — reference-portrait character consistency) · OpenAI `gpt-image-1` (fallback) |
| Observability | **LangFuse** (self-hosted in docker-compose) |
| PDF | Puppeteer |
| Payments | Stripe (test mode → production) |
| Notifications | SSE (Server-Sent Events) for slow-generation progress |
| Deploy | Dokploy on a VPS (Hetzner, ~€5/month, dev environment from week 2–3, production in week 5) |
| Monitoring | Sentry + Loki/Grafana (minimal setup) |

## AI pipeline architecture

```
User → form (child, age, goal)
                ↓
       [BullMQ job: generateBook]
                ↓
  1. VocabularyRagService.retrieve(age)
       → pgvector similarity search
       → topK words from the age-band corpus
                ↓
  2. StoryGenerator.generate()
       → Vercel AI SDK `generateObject` (Zod schema)
       → structured JSON: setup, conflict, lesson, resolution,
         discussionQuestions[5], illustrationPrompts[N]
                ↓
  3. StoryEvaluator.evaluate(story)
       → a second LLM call with a judge prompt
       → JudgeSchema: ageAppropriateVocab, hasMoralLesson,
         structureCompleteness, safetyForChildren, length, engagement (all 0–10)
       → if the mean score < 7 → goto step 2 (max 2 retries)
                ↓
  4. ImageGenerator.generate(illustrationPrompts)
       → reference portrait from characterProfile, then
         Gemini 2.5 Flash Image per page WITH that portrait
         → same protagonist on every page (gpt-image-1 fallback)
                ↓
  5. PDFRenderer.render(story, images)
       → Puppeteer → PDF in S3
                ↓
  6. Discussion questions on the final page of the PDF
                ↓
       SSE progress → frontend
```

Every AI call is traced in LangFuse via `experimental_telemetry`.

## Database (entities)

```
User (id, email, googleId, createdAt)
├── Child[] (name, age, gender, interests)
├── Book[] (title, status, childId, learningGoalId, ...)
│   ├── BookPage[] (pageNumber, text, imageUrl)
│   └── StoryEval (judgeScores: JSON, attempt, finalScore, generatedAt)
└── Subscription (stripeSubscriptionId, plan, status, periodEnd)

LearningGoal (admin-managed catalogue, ~20 goals)
VocabularyEntry (word, gradeLevel, frequency, embedding: vector)
Template (for the fast generation flow)
```

## Two generation flows (course requirement)

- **Fast (~5 s):** ready-made story template + placeholders (name, age, goal) + tag-based selection of pre-made illustrations → fast PDF.
- **Custom (3–10 min, via BullMQ):** the full AI generation pipeline above, with SSE progress streamed to the frontend.

## Roadmap (5 weeks)

### Week 1 — Decision + foundation *(current)*
- [x] Project-choice analysis, plan locked in
- [x] Rename folder `miranda` → `storygrow`
- [x] Update `PROJECT_PLAN.md`
- [ ] Harness setup: `CLAUDE.md`, `AGENTS.md`, code style
- [ ] Repo init, monorepo (`backend/`, `frontend/`)
- [ ] `docker-compose.yml`: PostgreSQL + pgvector, Redis, MinIO, LangFuse
- [ ] Basic scaffold for NestJS + Next.js + Prisma

### Week 2 — AI-engineering depth
- [ ] Prisma schema: User, Child, Book, BookPage, StoryEval, LearningGoal, VocabularyEntry
- [ ] Install pgvector in Postgres, migration
- [ ] Download Dale-Chall + AoA-Kuperman, indexing script for `VocabularyEntry`
- [ ] `VocabularyRagService`: retrieval by grade level
- [ ] `StoryGenerator` (Vercel AI SDK + Zod schema for the pedagogical story)
- [ ] `StoryEvaluator` (LLM-as-judge with JudgeSchema)
- [ ] Regenerate-on-low-score logic
- [ ] Wire up LangFuse via `experimental_telemetry`
- [ ] BullMQ job `generateBook`, processor
- [ ] Google OAuth + JWT (NestJS Passport)

### Week 3 — PDF + basic UI
- [ ] Puppeteer job: HTML page template → PDF
- [ ] Layout: illustration + text + discussion questions on the final page
- [ ] Frontend: login, book-creation form, book page, SSE progress
- [ ] Catalogue of learning goals (`LearningGoal`) + admin CRUD
- [ ] Deploy dev environment to the VPS for testing

### Week 4 — Stripe + two flows + admin
- [ ] Stripe checkout + webhooks
- [ ] Prisma `Subscription`, per-plan limits
- [ ] Fast flow: `Template` + placeholder logic
- [ ] Admin: books list, judge scores, metrics (% of books passing on first attempt, average per-criterion scores)
- [ ] SEO pages (Schema.org, OG tags) on a separate subdomain

### Week 5 — Production deploy + defense prep
- [ ] Production deploy to the VPS with domain + HTTPS
- [ ] Sentry, basic monitoring (Loki/Grafana)
- [ ] UI polish, bug fixes
- [ ] Defense prep: slides, demo script, prepared answers
- [ ] Eval dashboard for the jury (quality metrics from StoryEval)

## Out of scope (explicitly NOT in the MVP)

- Flux/SDXL + IP-Adapter for character consistency — not needed: consistency is achieved via the Gemini reference-portrait approach (#174), no extra model
- Referral programme
- Adaptive feedback loop from the parent
- Quiz as interactive tests (only a list of questions in the PDF)
- Full product localisation to English (we only use lexical corpora)
- Model fine-tuning

## Product language

- **Product (UI, stories):** Russian
- **RAG corpora:** English (Dale-Chall, AoA-Kuperman) used as a **difficulty-level proxy** — mapped into the system prompt as a level description, and GPT-4o adapts to Russian based on that description. No open Russian "word → age" corpora exist, so this is an honest architectural compromise.

## Budget

| Item | Amount |
|---|---|
| VPS (Hetzner CX22, production in week 5) | ~€5 |
| OpenAI credits (experiments + tests + course-run production) | ~$15–25 |
| Domain (optional) | ~$10/year |
| Everything else (Dokploy, LangFuse, Stripe test mode, MinIO) | $0 |
| **Total** | **~$25–40** |

## Related projects on the filesystem

- `/Users/mac/Projects/storycraft/` — the **course reference repository**. Not used as a starting point for code (we write from scratch), but its patterns can be inspected (BullMQ processors, Prisma structure, OAuth setup).
- `/Users/mac/Projects/storygrow/` — **this project**.

## Development approach

- **Write from scratch** (no copy from storycraft) with AI agents
- **Harness:** `CLAUDE.md` + `AGENTS.md` with project and style rules
- **Superpowers skills:** brainstorming before each major feature, TDD for the AI pipeline, verification-before-completion before commits, systematic-debugging when something breaks
- **Slow down and manual-verify** for the AI pipeline (RAG, structured gen, judge) — this is the heart of the product; it cannot be auto-generated and forgotten

## Defense talking points (draft)

> *"I took the course architecture (two generation flows, Stripe, queues, SSE, VPS deploy) but in the AI layer I implemented three things absent from the baseline:*
> *(1) RAG over lexical corpora for age-based difficulty adaptation;*
> *(2) structured generation against a pedagogical model via Vercel AI SDK + Zod;*
> *(3) an automatic LLM-as-judge with regeneration on low scores.*
> *Every AI call is traced in LangFuse — I can show the dashboard: percentage of books passing on the first attempt, average per-criterion scores, quality drift over time."*

---

**Plan last updated:** 2026-05-21
