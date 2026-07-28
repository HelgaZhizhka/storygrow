# Custom learning goal — design

## Motivation

Feedback from a small preview showing of the product (before the actual
defense — the defense date has since been postponed, so there is real time
to do this properly rather than rush a minimal version): parents want to
type their own learning goal instead of picking only from the curated
`LearningGoal` list. The defense's own narrative this session already
covers the honest evolution of exemplar coverage (#313) — this feature
extends that story rather than fighting it: a custom goal is, by
construction, a goal `pickExemplar` has never seen before, so it always
exercises the exact fallback path #313 fixed (random pick from the
`(arcType, ageBand)` pool, Plan phase invents its own scenario, borrows
craft/register only).

## Scope

- **Custom Flow only.** Fast Flow requires a pre-authored `Template` tied to
  the `learningGoalId` (`assertFastFlowTemplateExists` in
  `books.service.ts`) — a custom goal has no template, and generating one
  on the fly is out of scope (would turn Fast Flow into Custom Flow for
  these goals, with no scoped benefit). When a custom goal is selected, the
  Fast Flow option is hidden/disabled on the form.
- **One free-text field**, not separate title/description. The generation
  pipeline only needs `topic` (→ `title`) and `learningGoal` (→
  `description`) as two prompt-building strings
  (`generation.processor.ts:81-82`); for a one-off custom goal there is no
  reason to make a parent fill in both. Max length ~60 characters (matches
  how curated goal titles read in the dropdown and book list).
- **Persisted, scoped to the creating user.** Reusable across that user's
  future books, invisible to other users. Not scoped to a single book.
- **A lightweight LLM safety check before the goal is saved** — the goal
  text is visible in the book list/admin panel immediately, independent of
  whether generation ever runs or the judge ever sees it. The existing
  `safetyForChildren` judge guardrail only protects generated story output,
  not this input.
- **Arc-type choice, asked in plain language, age-gated.** `flaw` has no
  beat sheet for the 3-4 age band (`getBeatSheet` throws rather than
  silently misapplying a register — see `story-generator.prompt.ts:71-74`).
  So: for a 3-4 child, no arc-type question is shown, the goal is always
  created as `virtue`. For a 5-6 child, the parent is asked in plain
  language, no `virtue`/`flaw` jargon:
  - "герой учится чему-то хорошему" → `virtue`
  - "герой ошибается и учится это исправлять" → `flaw`
- **Explicitly out of scope, tracked separately:** a no-exemplar experiment
  (letting the model find its own register for a custom topic instead of
  anchoring to a Gold Exemplar) was raised during design and deliberately
  **not** folded into this feature — it is a revision of ADR-0005's core
  decision (exemplars as the sole operational definition of "good", and the
  judge's `registerMatch` calibration reference), not a small addition. It
  gets its own cheap `eval:text` experiment first, outside any shipped
  code path, per ADR-0005's own validation-gate precedent. This feature
  ships on the existing, already-verified exemplar-fallback pipeline
  regardless of that experiment's outcome.

## Data model

```prisma
model LearningGoal {
  id               String              @id @default(cuid())
  title            String
  description      String
  arcType          LearningGoalArcType @default(virtue)
  ageRangeMin       Int                 @default(1)
  ageRangeMax       Int                 @default(18)
  createdAt        DateTime            @default(now())
  createdByUserId  String?             // NEW — null = curated/built-in goal
  createdByUser    User?               @relation(fields: [createdByUserId], references: [id], onDelete: Cascade)
  books            Book[]
  templates        Template[]
}
```

- `createdByUserId: null` — existing curated goals, unaffected.
- `createdByUserId: <userId>` — a custom goal, visible only to that user.
- Custom `virtue` goals: `ageRangeMin=1, ageRangeMax=18` (matches existing
  default — no reason to narrow it, `virtue` has a beat sheet for both
  bands).
- Custom `flaw` goals: `ageRangeMin=5, ageRangeMax=6` — written at creation
  time so `listLearningGoals`'s existing age-range filter naturally hides a
  flaw-type custom goal from a 3-4 child on a later book, with no new
  filtering logic needed.

Requires a Prisma migration (new nullable column + FK). No changes to
`Book`, `StoryEval`, or any generation-pipeline table.

## Data flow

1. Parent picks "+ Своя цель" in the existing goal `<select>` (same pattern
   as "+ Новый ребёнок" for children) on `books/new/page.tsx`.
2. Text field appears (≤60 chars); if the child is 5-6, the plain-language
   arc-type choice appears too; Fast Flow toggle is hidden.
3. On submit (before book creation): `POST /learning-goals/custom` — a new
   endpoint, kept separate from the existing `GET /learning-goals` list
   route rather than overloaded onto it, since creation carries a
   materially different contract (validation, a possible rejection, a
   write) — with `{ text, childAge, arcType? }`.
4. Backend runs the safety check (`generateObject`, small model, Zod schema
   `{ safe: boolean, reason?: string }`), traced in LangFuse like every
   other LLM call in the codebase (`createTelemetry`).
5. `safe: false` → 4xx with `reason`, nothing persisted, form shows the
   reason, no book created.
6. `safe: true` → `LearningGoal` row created with `createdByUserId`, the
   resolved `arcType`, and the age range per the rule above. Response
   returns the new goal (id + title), frontend selects it and proceeds
   exactly like picking any existing goal.
7. From here on, **zero new code runs**: `books.service.ts`,
   `generation.processor.ts`, `story-orchestrator.service.ts`,
   `pickExemplar`, the judge, image generation, and PDF render treat this
   `learningGoalId` exactly like a curated one.
8. `listLearningGoals(userId, childId?, explicitAge?)` gains one predicate:
   `createdByUserId IS NULL OR createdByUserId = :userId`.

## Error handling

- Safety check rejects → no DB write, no book creation, parent sees the
  model's `reason` (kept short, non-technical).
- Safety-check LLM call itself fails (timeout/provider error) → fail closed
  (treat as not-safe, do not silently allow through), matching this
  codebase's existing safety-first bias elsewhere (e.g. `safeImageUrl`'s
  reject-by-default in `pdf-render.service.ts`).
- Duplicate custom goals from the same user (typo variants, repeats) — not
  deduplicated in v1. Low stakes, adds complexity for a problem that hasn't
  been observed yet; revisit if it turns out to actually annoy users.

## Testing

- Unit tests: new endpoint's safe/unsafe branches (mocked LLM call),
  `listLearningGoals`'s new predicate, arc-type age-gating (5-6 shows the
  choice, 3-4 doesn't and always resolves `virtue`), the migration's
  default (`createdByUserId` nullable, existing rows unaffected).
- **Mandatory live verification, not optional:** before this is considered
  done, run `eval:batch`-style generation on 3-5 deliberately novel custom
  topics (not close variants of existing goals — pick topics unlikely to
  thematically resemble any current exemplar, e.g. «любовь к чтению»,
  «уважение к чужому мнению», «терпение в очереди»). This is the same
  discipline `AGENTS.md`'s "AI-pipeline changes require a live eval run"
  rule already requires for prompt changes — this change doesn't touch a
  prompt file, but it exercises the exemplar-fallback path in a materially
  new way (every generation now goes through it, not just the rare
  no-exemplar curated goal), so the same discipline applies. Do not ship
  as "done" on unit tests and a green `init.sh` alone.
