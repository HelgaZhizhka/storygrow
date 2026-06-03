# Domain Context — StoryGrow

This file is the canonical glossary for the **StoryGrow** repository.
Use these terms exactly as defined when writing code, issues, ADRs, commits, and prompts.
Do not drift to synonyms the glossary explicitly avoids.

---

## Glossary

### Book
A single personalized children's book created for a specific child. Stored in the `Book` table with status (`pending`, `generating`, `ready`, `failed`). Has one `Child`, one `LearningGoal`, and a list of `BookPage` records.

**Avoid:** "story" alone (story is the *content*; book is the *artefact* the user buys); "tale".

### Story
The structured AI-generated content of a book. A `Story` is a JSON object matching `StorySchema` (Zod): `title`, `setup`, `conflict`, `lesson`, `resolution`, `discussionQuestions[5]`, `illustrationPrompts[N]`. It is the **direct output of the AI pipeline**, before being split into `BookPage` rows and rendered to PDF.

**Avoid:** "narrative", "text" (too generic).

### Story Structure
The pedagogical schema enforced by `StorySchema`: four narrative stages (`setup → conflict → lesson → resolution`) plus discussion questions. This structure is **non-negotiable** in custom-flow generation — it is the educational backbone of the product.

**Avoid:** "plot", "outline".

### Learning Goal
A pedagogical objective the parent picks for the book (e.g., *«научиться делиться»*, *«перестать бояться темноты»*). Admin-managed catalogue, ~20 entries to start. Stored in `LearningGoal` table. Drives the `lesson` stage of the story.

**Avoid:** "topic", "theme" (these are descriptive, not pedagogical).

### Vocabulary Entry
A single word indexed for age-appropriate retrieval. Stored in `VocabularyEntry` with fields: `word`, `gradeLevel` (Dale-Chall scale or AoA age), `frequency`, `embedding: vector(1536)`. Used by `VocabularyRagService` to retrieve allowed lexicon for a target age band.

**Avoid:** "lexicon entry" (too academic), "word record".

### Grade Level
Numeric age-difficulty band used in RAG retrieval. Mapped from child's age via a fixed table (age 3-4 → grade 0, age 5-6 → grade 1, ..., age 9-10 → grade 4). Sourced from Dale-Chall scale on the English corpora.

**Avoid:** "age level", "difficulty" alone.

### Judge Score
A numeric rating (0-10) produced by `StoryEvaluator` for a single criterion. Five criteria: `ageAppropriateVocab`, `hasMoralLesson`, `structureCompleteness`, `safetyForChildren`, `length`. The mean across criteria is the **final score**; if below threshold (default 7.0), the story is regenerated (max 2 retries).

**Avoid:** "rating", "evaluation result".

### Story Eval
The database record (`StoryEval` table) holding all judge scores for a single generation attempt of a book. One book may have multiple `StoryEval` rows if regeneration happened. Used both for the regeneration decision and for aggregate metrics on the admin dashboard.

**Avoid:** "quality check", "evaluation log".

### Fast Flow
Synchronous generation path (~5 seconds): pick a pre-authored `Template`, fill placeholders with child's name / age / chosen `LearningGoal`, pick pre-rendered illustrations by tags, return PDF directly. **No AI calls.** Defined by course requirements.

**Avoid:** "template flow" (acceptable informally, but "fast flow" is the term in code paths and docs).

### Custom Flow
Asynchronous generation path (3-10 min): full AI pipeline via BullMQ job — `VocabularyRag` → `StoryGenerator` → `StoryEvaluator` (with regeneration loop) → `ImageGenerator` (gpt-image-1 per page) → `PDFRenderer` (Puppeteer). Progress streamed to frontend via SSE.

**Avoid:** "AI flow" (every flow technically uses AI somewhere — be specific), "slow flow" (negative framing).

### Discussion Question
A single open-ended question for the parent to ask the child after reading. Five per story, generated as part of `StorySchema`. Rendered on the last page of the PDF, not as an interactive quiz.

**Avoid:** "quiz question" (we explicitly do NOT do interactive quizzes), "comprehension check".

### LangFuse Trace
A single observability record for one LLM call (text generation, embedding, or judge). Includes prompt, response, latency, token usage, cost, and any custom scores attached. Created via `experimental_telemetry` config in Vercel AI SDK calls. Aggregated into dashboards used for the eval story on the project defense.

**Avoid:** "log entry", "AI log".

### Pedagogical Schema
Synonym for [Story Structure] in conversation. In code, the Zod schema is named `StorySchema`. Do not invent additional names.

---

## Pipeline-level terms

### AI Pipeline
End-to-end sequence in Custom Flow: retrieve → generate → evaluate → (regenerate?) → illustrate → render. Each stage is a class in `backend/src/ai/` and is independently testable.

### Regeneration Loop
The retry behavior in `StoryEvaluator`: if `finalScore < threshold`, the story is re-generated up to 2 times (3 total attempts). Each attempt is logged as a separate `StoryEval` row with `attempt: 1|2|3`. The frontend shows progress including which attempt is running.

### Eval Threshold
The numeric cutoff (default 7.0) for accepting a generated story. Configurable via env. Below the threshold → regenerate. The threshold is itself a metric to tune over time.

---

## Semantic Hygiene — Easily Confused Pairs

Quick-reference for pairs that are tempting to use interchangeably. When in doubt, **qualify the noun** — don't reuse one name for different concepts, don't use different names for the same concept. Keep the same concept named the same across code, docs, API, and UI.

| Looks similar | But means | Use this term |
|---|---|---|
| `Book` vs `Story` | Artefact (DB row, PDF, what the user buys) vs structured content (JSON, the AI output) | `Book` for the artefact; `Story` for the content |
| `Book` vs `BookPage` | Whole book vs a single page inside it | `BookPage` for one page; don't say "book entry" or "book item" for a page |
| `Story` vs `Story Structure` vs `StorySchema` | Content instance vs the pedagogical structure (setup/conflict/lesson/resolution) vs the Zod schema enforcing it | "Story" for content; "Story Structure" / "Pedagogical Schema" in prose; `StorySchema` only in code |
| `StoryEval` vs `Judge Score` vs `Final Score` | DB row holding all scores for one attempt vs one criterion's 0-10 number vs the mean across criteria | `StoryEval` for the row; "judge score" for a criterion; "final score" for the mean |
| `Judge Score` vs `Eval Threshold` | The produced score (output) vs the cutoff for acceptance (config) | Don't say "judge threshold" |
| `Fast Flow` vs `Custom Flow` | Synchronous template-fill (no AI) vs async full AI pipeline | Never "AI flow" or "slow flow" |
| `Template` vs `StorySchema` | Pre-authored fast-flow story shell with placeholders vs Zod runtime/type schema for custom flow | `Template` is a DB row; `StorySchema` is code |
| `Learning Goal` vs `Topic` / `Theme` | Pedagogical objective (admin-managed catalogue) vs descriptive label | Always `LearningGoal`; avoid "topic" / "theme" |
| `Discussion Question` vs "quiz" | Open-ended parent-child prompt on PDF last page vs interactive quiz | We do NOT do quizzes — only `DiscussionQuestion` |
| `Vocabulary Entry` vs "lexicon entry" / "word record" | RAG-indexed word with grade level and embedding | Always `VocabularyEntry` |
| `Grade Level` vs "age" vs "difficulty" | Numeric band derived from age (0–4) used in RAG retrieval | `gradeLevel` in code; "grade level" in prose; never "age level" or bare "difficulty" |
| `Regeneration Loop` vs "retry" | The judge-driven re-generation up to 2 times, with each attempt logged | Use "regeneration", not "retry" — "retry" implies transient error, this is quality-driven |
| `LangFuse Trace` vs "log" | Structured observability record (prompt, response, latency, cost, score) vs unstructured logger output | "Trace" for LLM-call records in LangFuse; "log" only for `logger` service output |

If a new term enters the codebase that could collide with one above — qualify it immediately (e.g., `ui_graph` vs `dependency_graph`, not bare `graph`) and add it here.

---
