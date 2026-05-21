# Code Style — StoryGrow

Adapted from the RS School clean-code checklist (`mentor-resources/clean-code/Check-List.md`), tightened for our NestJS + Next.js + AI-pipeline stack.

> **Source of truth:** when a rule here conflicts with `mentor-resources/clean-code/`, **this file wins** — it is the project-specific adaptation.

This list complements (does not replace) the **Hard Constraints** in [../CLAUDE.md](../CLAUDE.md). Hard Constraints are NEVER violated; this checklist is the everyday discipline.

---

## ✅ Naming

- Names are understandable without comments.
- No single-letter variables (except `i`, `j` in loops).
- Boolean variables start with `is` / `has` / `should` / `can`.
- Functions are verbs; classes and types are nouns.
- No abbreviations (except widely accepted: `id`, `url`, `db`).

## ✅ Functions

- One responsibility per function.
- Usually ≤ 30 lines; if longer, there must be a clear reason.
- ≤ 3 parameters (or use an object-parameter).
- No hidden side effects (or they are obvious from the name).
- Early return to reduce nesting.
- One return type per function.

## ✅ Code structure

- No duplication (DRY).
- No dead code.
- Nesting ≤ 3 levels.
- Magic numbers and magic strings extracted to constants.
- Simple over clever (KISS).
- No speculative abstractions (YAGNI).
- Braces mandatory for every `if`/`else`/`for` block.
- File size ≤ 400 lines.

## ✅ SOLID

- Single Responsibility — observed.
- Open/Closed — where applicable.
- Dependency Inversion — services accept dependencies via constructor (NestJS DI handles this naturally).

## ✅ Error handling

- Errors are handled, never swallowed.
- Input validation at boundaries (Fail Fast). Internal code trusts internal code.
- No empty `try/catch`.
- `?.` for nullable access.
- `??` where `0`, `''`, `false` must survive (vs `||`).

## ✅ Comments

- Comments explain **why**, not **what**.
- No outdated comments.
- `TODO` / `FIXME` include date and short reason.
- No commented-out code in commits.

## ✅ Async code

- `async/await` over callbacks and `.then`-chains.
- All promises handled (`await` or `.catch`).
- Independent parallel requests via `Promise.all` / `Promise.allSettled`.
- Cleanup for `setInterval` / `setTimeout` / subscriptions / SSE listeners.
- `AbortController` for cancellable requests where race conditions or unmounts matter.

## ✅ Data handling

- Immutability — no mutation of inputs.
- Arrays via `map` / `filter` / `reduce` / `find` / `some` / `for...of` (pick what reads best).
- Objects updated immutably (spread, or libraries like `immer` if it ever justifies the dep — discuss first).
- No mutation of function parameters.

## ✅ Testability

- Pure functions where possible.
- Side effects (DB, AI calls, S3) injected as dependencies.
- No global state.

## ✅ TypeScript

- **No explicit or implicit `any`.** Configure `noImplicitAny: true`, `strict: true`.
- External data (`fetch`, `JSON.parse`, env, request bodies) parsed through **Zod** schemas. Do not cast.
- `as` and `!` only when there is a comment explaining why the type system can't see what you see.
- Union types for discriminated states: `status: 'pending' | 'generating' | 'ready' | 'failed'`.
- Indexed access types treat `undefined` as possible.
- `import type` for type-only imports.

## ✅ NestJS (backend)

- One module per bounded responsibility (`AiModule`, `BookModule`, `AuthModule`, …).
- Services are thin orchestrators; pure logic lives in helpers.
- Controllers do validation + delegation only — no business logic.
- DTOs are Zod schemas (use `nestjs-zod` or hand-rolled), not class-validator unless necessary.
- Use `ConfigService` for env vars — never `process.env` directly outside `ConfigModule`.
- Logging via `Logger` from `@nestjs/common`, never `console.log`.

## ✅ Next.js (frontend)

- App Router only. No Pages Router patterns.
- Server Components by default; `'use client'` only when interactivity demands it.
- No `useEffect` for data fetching that can be done server-side.
- No derived state via `useEffect` — compute during render.
- `useMemo` / `useCallback` / `React.memo` only with measured reason.
- Stable `key` in lists — never `index` for dynamic lists.
- No direct DOM manipulation (`querySelector`, `classList`, `style`) inside React components.
- Named exports over default exports.

## ✅ AI pipeline (StoryGrow-specific)

- **No raw `chat.completions.create`.** All generation through `generateObject` / `generateText` from Vercel AI SDK with a Zod schema.
- **Prompts are constants** in `backend/src/ai/prompts/` — no inline prompt strings in services.
- **Schemas are constants** in `backend/src/ai/schemas/` — one file per schema, Zod + exported TypeScript type.
- **Every LLM call carries telemetry**: `experimental_telemetry: { isEnabled: true, functionId, metadata: { bookId, attempt, ... } }`.
- **Every generation persists a `StoryEval` row** before responding to the client — even passing attempts.
- **Threshold and retry constants** in env (`EVAL_THRESHOLD`, `EVAL_MAX_RETRIES`) — never hard-coded in services.

## ✅ HTML / CSS / a11y

- Semantic tags, labelled form controls.
- Images carry meaningful `alt`, or `alt=""` if purely decorative.
- LCP image not lazy-loaded; below-fold images `loading="lazy"`.
- Visible focus state (`outline` / `:focus-visible`).
- Animations respect `prefers-reduced-motion`.
- No horizontal overflow at 320px width.

## ✅ Formatting

- Prettier-formatted.
- ESLint-clean.
- Imports ordered (external → internal aliases → relative).
- Line length ≤ 120 characters.

---

## Self-review before committing

Before pushing a commit, scan the diff against this list. If any rule was bent, either fix it or write a comment explaining the trade-off.

**Reminder:** Hard Constraints in `CLAUDE.md` are non-negotiable. This file is the everyday checklist.
