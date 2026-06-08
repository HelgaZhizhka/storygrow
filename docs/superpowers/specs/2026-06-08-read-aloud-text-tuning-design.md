# Read-Aloud Text & Vocabulary Tuning — Design

**Date:** 2026-06-08
**Status:** Draft for review
**Scope:** Custom (AI) flow story text + vocabulary. No schema, no UI, no image changes.

## Problem

For 5–6-year-olds the generated text is too short and lexically flat. Two coupled
causes:

1. **Char limits.** Most content pages for ages 5–6 are capped at **120 chars**
   (`image-top` / `image-bottom`) — roughly 1–2 short sentences.
2. **Vocabulary constraint.** The story prompt instructs the LLM to use *only*
   the grade-level allowed-words list, and the evaluator **hard-fails** any story
   whose vocabulary-compliance score is below `COMPLIANCE_THRESHOLD` (0.4). Even
   if we raise the char limit, the narrow word pool keeps prose repetitive.

## Decision: the reading model is **parent-reads-aloud**

The product is read-aloud (it already ships parent-facing discussion questions).
This reframes the vocabulary constraint: it should target words the child
**understands by ear**, not words the child can **decode** themselves. That is a
much wider set, and it lets emotional/narrative words in ("испугался",
"решился", "обрадовался") that make a 5–6 story richer.

**The vocabulary RAG is NOT removed** — it remains one of the project's three
AI-engineering differentiators. It is *reframed*: from "decoding word-list gate"
to "comprehension-level vocabulary guidance + tracked quality signal."

## Changes

### 1. Page text limits (`page-templates.config.ts`)

| Template | Current | New |
|---|---|---|
| `image-top` | 120 | **220** |
| `image-bottom` | 120 | **220** |
| `image-left` | 200 | 200 (unchanged) |
| `text-focus` | 350 | 350 (unchanged) |
| `final` | 200 | 200 (unchanged) |
| `cover` (title) | 60 | 60 (unchanged) |

`maxChars` is the single source of truth — the value flows into both the prompt
catalogue (`buildTemplateCatalogue`) and the structural validator, so this one
change propagates everywhere.

### 2. Wider vocabulary retrieval (`ai.config.ts`)

`DEFAULT_TOP_K`: **80 → 150**. More allowed words per story gives the LLM more
lexical room *from the corpus itself*, before any relaxation.

### 3. Prompt reframe (`story-generator.prompt.ts`)

- System rule 2 ("Use ONLY vocabulary from the provided allowed-words list…")
  → "**Prefer** the provided allowed-words list. You may also use other simple,
  age-appropriate Russian words a child understands when the story is **read
  aloud** by a parent. Favour concrete, emotionally clear words."
- User-prompt vocabulary line updated to match ("prefer these… read-aloud").

### 4. Decouple vocabulary compliance from the hard pass-gate (`story-evaluator.service.ts`)

Today: `passed = structural && languagePurity && compliance && finalScore≥threshold`.

New: drop `compliance.passed` from the hard AND. Vocabulary compliance becomes a
**soft signal**:
- still computed and stored on `StoryEval.vocabularyCompliance` (defense metric intact);
- still fed into regeneration feedback when low (the LLM is nudged toward simpler
  words on retry);
- no longer hard-fails a book on its own.

Hard gates that **remain**: `structural`, `languagePurity` (no Latin/English),
and `finalScore ≥ EVAL_THRESHOLD`. The judge already scores age-appropriate
vocabulary, so quality is still protected — by a graded score, not a binary cliff.

## Out of scope

- **Audio narration / TTS** — tracked separately (roadmap issue).
- **Age-adaptive lengths** (different limits for 5 vs 6) — keep one limit for the
  5–6 band for now; revisit if needed.
- Schema, UI, image generation — untouched.

## Defense / metric note

This intentionally changes the eval gate. "% of books passing on first attempt"
will rise because vocabulary no longer hard-fails a book. The narrative improves:
vocabulary compliance becomes a **weighted quality signal we track and optimize**,
not a brittle binary gate — a more credible multi-signal eval story. Language
purity (Russian-only) stays a hard gate, so the "no English words" guarantee is
unchanged.

## Testing

- `vocabulary-compliance.spec`: unchanged scoring; still returns `score` + `outOfCorpus`.
- `story-evaluator.spec`: update the gate expectation — a story with low
  compliance but a passing judge score and clean language/structure now returns
  `passed: true`. Add a test that low compliance still appears in regeneration
  feedback.
- `book-plan.validator` tests: confirm 220-char text passes for `image-top`/`bottom`.
- Manual: regenerate a 6-year-old book and confirm noticeably richer 2–3-sentence
  pages with intact Russian-only text.
