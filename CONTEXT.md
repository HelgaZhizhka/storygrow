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
The structured AI-generated content of a book. A `Story` is a JSON object matching `StorySchema` (Zod): `title`, `characterProfile`, `discussionQuestions[5]`, and an ordered `pages[]` array (each page: `template`, `text`, `title`, `illustrationPrompt`). It is the **direct output of the AI pipeline** (specifically the Prose phase, then titled — see [Story Plan]), before being split into `BookPage` rows and rendered to PDF.

**Avoid:** "narrative", "text" (too generic).

### Story Structure
The pedagogical arc (setup → conflict → lesson → resolution) that the **Plan** phase encodes as ordered page beats — it is not separate top-level `Story` fields (that pre-ADR-0005 shape is gone). This structure is **non-negotiable** in custom-flow generation — it is the educational backbone of the product.

**Avoid:** "plot", "outline".

### Learning Goal
A pedagogical objective the parent picks for the book (e.g., *«научиться делиться»*, *«перестать бояться темноты»*). Admin-managed catalogue, ~20 entries to start. Stored in `LearningGoal` table. Drives the `lesson` stage of the story.

**Avoid:** "topic", "theme" (these are descriptive, not pedagogical).

### Vocabulary Entry
> **Deprecated (ADR-0005).** Vocabulary-RAG is removed from the pipeline; age-fit lives in the `ageAppropriateVocab` judge guardrail. The `pgvector` infra is retained but repurposed for possible future *craft-exemplar* retrieval, not vocabulary gating. Kept here for historical reference only.

A single word indexed for age-appropriate retrieval. Stored in `VocabularyEntry` with fields: `word`, `gradeLevel` (Dale-Chall scale or AoA age), `frequency`, `embedding: vector(1536)`. Was used by `VocabularyRagService` to retrieve allowed lexicon for a target age band.

**Avoid:** "lexicon entry" (too academic), "word record".

### Grade Level
> **Deprecated (ADR-0005).** Only meaningful for the removed vocabulary-RAG retrieval. Age still maps to age-appropriate register via the judge guardrail and the rebuilt exemplars, not a numeric grade band.

Numeric age-difficulty band formerly used in RAG retrieval. Mapped from child's age via a fixed table (age 3-4 → grade 0, age 5-6 → grade 1, ..., age 9-10 → grade 4). Sourced from Dale-Chall scale on the English corpora.

**Avoid:** "age level", "difficulty" alone.

### Judge Score
A numeric rating (0-10) produced by `StoryEvaluator` for a single criterion. Criteria split into two groups (see [docs/adr/0005-decomposed-generation-pipeline.md](docs/adr/0005-decomposed-generation-pipeline.md)):

- **Guardrails** (pass/fail gates): `ageAppropriateVocab`, `hasMoralLesson`, `structureCompleteness`, `safetyForChildren` (widened to penalise modelling a child approaching real-world danger — see [Safe Conflict]), `length`, `earnedResolution` (the moral is earned by the plot, not announced; for flaw-arc stories the "Расплата" beat must be present and the repair explicit, not instant forgiveness).
- **Craft** (the optimised signal): [Register Match] — the two-sided prose criterion that triggers regeneration.

A story is accepted only if the guardrails clear **and** the craft score meets threshold (default 7.0). The craft signal is **not** averaged away into a mean-of-N — that dilution is exactly what ADR-0005 removes. (The pre-ADR-0005 model was a single `engagement` criterion averaged across seven; `engagement` is superseded by [Register Match].)

**Avoid:** "rating", "evaluation result".

### Story Eval
The database record (`StoryEval` table) holding all judge scores for a single generation attempt of a book. One book may have multiple `StoryEval` rows if regeneration happened. Used both for the regeneration decision and for aggregate metrics on the admin dashboard.

**Avoid:** "quality check", "evaluation log".

### Fast Flow
Synchronous generation path (~5 seconds): pick a pre-authored `Template`, fill placeholders with child's name / age / chosen `LearningGoal`, pick pre-rendered illustrations by tags, return PDF directly. **No AI calls.** Defined by course requirements.

**Avoid:** "template flow" (acceptable informally, but "fast flow" is the term in code paths and docs).

### Custom Flow
Asynchronous generation path (3-10 min): full AI pipeline via BullMQ job, all phases owned by `StoryGeneratorService` — **Plan** → **Companions** (only if `belongings` seeds given) → **Prose** → **Title** (derived from the finished story, not the abstract plan — see [Story Plan]) → `StoryEvaluator` (with regeneration loop) → `ImageGenerator` (Gemini 2.5 Flash Image per page with a reference portrait for character consistency; gpt-image-1 fallback) → `PDFRenderer` (Puppeteer). Progress streamed to frontend via SSE. (Pre-ADR-0005 this began with a `VocabularyRag` stage and a single mega-call; both are superseded. The ADR-0005 "Read-Aloud Edit" phase was never built — Plan+Prose alone met the quality bar.)

**Avoid:** "AI flow" (every flow technically uses AI somewhere — be specific), "slow flow" (negative framing).

### Protagonist Mode
Per-book choice in the Custom Flow (`Book.protagonistMode`): `child` — the hero **is** the child (name and `appearance` used); `observer` — a third-person story about an **invented** character (the child's name and appearance are deliberately not used). Observer mode is the pedagogically safer framing for sensitive learning goals (tantrums, greed), so the child watches a proxy learn rather than seeing themselves shamed.

**Avoid:** "narrator mode", "POV" — the term is "protagonist mode" with values `child` / `observer`.

### Character Appearance
Free-text visual description of the child stored on `Child.appearance` (reusable across books). **Image-only:** in `child` mode it is converted, by an isolated derivation step, into the English `characterProfile` that drives the illustrations. It is deliberately **never** shown to the Plan or Prose phase, so a visual detail (a hair-bow, a dress) cannot leak into the plot or title (#216). If blank, the LLM invents an age-appropriate `characterProfile`.

**Avoid:** "avatar", "portrait" — there is no image of the child; this is a text description only.

### Personalization Seeds
Soft, concrete per-book material stored on `Book` (`interests`, `belongings`, `motifs`, `favoriteWords`) and supplied in the Custom Flow. Fed into the **Plan** phase to attack banality with specifics: they flavour the hero's **world** (props, setting, small touches) but never change the premise, conflict, or lesson — those come from the `Gold Exemplar` and `Learning Goal`. `favoriteWords` are woven only where natural, never forced (forcing flattens prose, per ADR-0005). Empty by default; when empty the Plan prompt is unchanged (#197).

**Avoid:** "keywords", "constraints" — seeds are soft flavour, not hard requirements.

### Companion Descriptor
A short, fixed English visual descriptor (species + colour + one detail) for a recurring non-hero animal/creature, so it renders consistently across every page it appears on — the same anchoring idea as `characterProfile`, extended past the hero. Two sources: (1) **named companions** from the `belongings` seed (e.g. «кошка Мира» → `deriveCompanions` step, isolated `generateObject` call, own LangFuse trace) and (2) **story-invented recurring characters** (e.g. a rescued kitten with no seed behind it) — the Prose phase itself must invent and reuse one fixed descriptor per prose rule 8. Without an anchor, a recurring animal drifts (colour/species changes page to page) or a named companion's bare name gets illustrated as a person.

**Avoid:** "pet profile", "character sheet" — it is a short visual tag for image consistency, not a personality description.

### Arc Type
The narrative arc assigned to a `LearningGoal`, stored as `LearningGoal.arcType` (`virtue` | `flaw`).

- **`virtue`** — the protagonist *acquires* a good trait through effort and challenge (courage, generosity, honesty). Beat sheet: setup → temptation/challenge → attempt → partial failure → resolution-with-lesson.
- **`flaw`** — the protagonist *has* a flaw that backfires. Beat sheet: setup → flaw-in-action → consequence ("Расплата": a friend's trust is lost, a treasured thing breaks, being left out) → reflection → earned repair. The repair must be shown, not declared; instant forgiveness scores zero on `earnedResolution`.

`arcType` is assigned by the admin when creating or editing a `LearningGoal`, with a backfill default of `virtue` for existing goals. The orchestrator passes it to the prompt builder, which selects the matching beat sheet and a matching Gold Exemplar.

**Avoid:** "story type", "goal type" — the term is "arc type" with values `virtue` / `flaw`.

### Gold Exemplar
A human-approved reference story used as a few-shot example to steer generation quality — its structure, richness, tone, and (critically) its **safe conflict type**. A draft may be machine-generated, but it becomes an exemplar only after the pedagogy expert approves it. An auto-generated, unreviewed story is never an exemplar. The approved exemplar set is also the source of truth from which the judge rubric is calibrated (we measure deviation from the gold set, not from hand-written rules — and per ADR-0005 the judge literally **sees** the exemplars when scoring [Register Match]). Each exemplar is arc-specific: virtue-arc goals use virtue exemplars; flaw-arc goals use flaw exemplars with a visible "Расплата" beat.

The **target register** (ADR-0005, amended 2026-06-27) is a **rich, warm, read-aloud storybook voice in the Сутеев / Russian folk-tale tradition**: warm narrator ("Жил-был…"), folk rhythm, gentle humour, natural dialogue, real feeling, lesson emerging from the events and stated once. The enemy is two-sided — flat event-summary AND adult preciousness ("свет, как чай с мёдом"); richness of voice is the GOAL. (An earlier "spare/picture-trusting" framing, inferred from an early-decoding reader, was tried and rejected — see ADR-0005.) Exemplars are the operational definition of "good" and are used in **two** places: the `Prose Pass` few-shot target and the judge's [Register Match] calibration. Register and exemplars are **per age band** — the 5–6 band (both arcs) is the flagship; the 3–4 band is simpler and repetition-driven (virtue arcs only).

**Avoid:** "sample", "template" — an exemplar shows the craft to imitate, it is not a fill-in-the-blank skeleton.

### Story Plan
The first-class intermediate artefact produced by the **Plan** phase of generation (own Zod schema `StoryPlanSchema`, own `generateObject` call, own LangFuse trace). The story "bible": fixed hero name, a placeholder `characterProfile`, voice/trait, and the page-by-page beat list (including the chosen safe conflict and, for flaw arcs, the `Расплата` beat). It is the **consistency anchor** — both the `Prose Pass` and the image generator read it. Its own `title` field is a working title only — the book's final title is decided **after** the Prose phase from the finished, concrete story, not from the Plan (the Plan's title kept naming the abstract learning value; deriving it from the finished story fixes that). See [docs/adr/0005-decomposed-generation-pipeline.md](docs/adr/0005-decomposed-generation-pipeline.md).

**Avoid:** "outline", "draft" — the plan is the structural source of truth, not a rough sketch; the `Story` is rendered *from* it.

### Prose Pass
The single whole-story generation call that renders the `Story Plan`'s beats into page text in the target register (rich, warm, read-aloud Сутеev voice — see [Gold Exemplar]), given one rebuilt `Gold Exemplar`. It carries no narrative prohibitions — their causes are resolved in the `Story Plan`. Decomposition is **by concern, not by page**: the Prose Pass sees the whole story in one context, so cross-page consistency is preserved.

**Avoid:** "page generation", "per-page call" — generating pages independently is explicitly rejected (it causes name/tone/plot drift).

### Read-Aloud Edit
The optional whole-story revision phase that trims ornateness and length to register after the `Prose Pass`. Operates on the whole story, never per-page. This is where a strong-but-ornate model's overshoot is reined in.

**Avoid:** "polish", "cleanup" — it is a register-tightening pass, not cosmetic.

### Register Match
The judge's **two-sided** craft criterion: how close the prose sits to the `Gold Exemplar` register. High = same register as gold; low if **flatter** (event-summary, no dialogue) **or** **more ornate** (dense metaphor, rare words, precious imagery). Measured against exemplars shown to the judge, not against hand-written rules. The craft signal that triggers regeneration — see [Judge Score].

**Avoid:** "engagement" (the old single-sided criterion it replaces), "style score".

### Safe Conflict
The narrative tension a story is allowed to use for ages 5–6. The boundary is about the **modeled action** in the resolution, not the scary element itself: a story may feature fear, but the resolution must never model a child approaching a real-world danger. **Allowed** — emotional/social/internal conflicts: fear of the dark, trying something new, speaking up, a friend upset, making a mistake, missing a parent. **Forbidden** — a real physical danger that the hero approaches or befriends: wild animal, stranger, fire, water, heights, getting lost. Test by the action: "a dog as a known friend" is fine; "approach an unknown dog" is not.

**Avoid:** "no scary content" — fear is allowed and useful; the constraint is on the modeled action, not on the presence of tension.

### Art Style
Per-book illustration style (`Book.artStyle`): `watercolor` (default) / `cartoon` / `storybook` / `pixel` / `realistic`. Maps to an English suffix (`STYLE_SUFFIXES` in `ai.config.ts`) appended to every illustration prompt. Custom Flow only; fast-flow uses its pre-rendered illustrations.

**Avoid:** "theme", "skin" — the term is "art style".

### Character Profile
The English visual description of the protagonist that the LLM emits in `StorySchema.characterProfile`, prepended to **every** page's illustration prompt so the character looks consistent across pages. In `child` mode it derives from `Character Appearance`; in `observer` mode it describes the invented character.

**Avoid:** "character sheet", "bio" — it is a short visual descriptor, not a backstory.

### Discussion Question
A single open-ended question for the parent to ask the child after reading. Five per story, generated as part of `StorySchema`. Rendered on the last page of the PDF, not as an interactive quiz.

**Avoid:** "quiz question" (we explicitly do NOT do interactive quizzes), "comprehension check".

### LangFuse Trace
A single observability record for one LLM call (text generation, embedding, or judge). Includes prompt, response, latency, token usage, cost, and any custom scores attached. Created via `experimental_telemetry` config in Vercel AI SDK calls. Aggregated into dashboards used to track output quality over time.

**Avoid:** "log entry", "AI log".

### Pedagogical Schema
Synonym for [Story Structure] in conversation. In code, the Zod schema is named `StorySchema`. Do not invent additional names.

---

## Pipeline-level terms

### AI Pipeline
End-to-end sequence in Custom Flow: **plan → companions? → prose → title → evaluate → (regenerate?) → illustrate → render**. The former `retrieve` (vocabulary-RAG) stage is removed (ADR-0005); the former single `generate` stage is decomposed into `Story Plan` → `Prose Pass` → title derivation (the ADR-0005 "Read-Aloud Edit" phase was never built). Each phase is a method on `StoryGeneratorService` (`backend/src/ai/story-generator/`) and is independently testable (and independently runnable via `eval:text`).

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
| `StoryEval` vs `Judge Score` vs `Final Score` | DB row holding all scores for one attempt vs one criterion's 0-10 number vs the accept/regenerate decision | `StoryEval` for the row; "judge score" for a criterion; "final score" for the craft-gated decision (post-ADR-0005: guardrails must clear AND craft ≥ threshold, not a mean) |
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
