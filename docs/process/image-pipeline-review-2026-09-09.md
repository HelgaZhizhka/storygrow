# Image pipeline — independent architecture review (2026-09-09)

**Status:** recorded, not yet acted on. Decisions are proposals with risk and order; nothing here changed code.

## How it was produced

Requested by the product owner after five days of image-pipeline work (#353 → #365) with the
question "are we bloating the logic?". A fresh session (no context of the build) was given the
scope below and ran a multi-agent workflow: 7 reviewers (one per question plus a cross-cutting
one), an adversarial verifier pair per block, and a completeness critic. The reviewers finished;
all verifiers and the critic hit the session limit, so the synthesis was assembled by hand with
every key claim re-checked against the code. On 2026-09-11 the following claims were verified again
by the engineer who built the pipeline, all confirmed: `timeOfDay`/`framing` have no consumer; the
Prose phase sees `characterProfile`; the `images_failed` retry re-buys portrait and sheets; the
judge is the only `@Optional` dependency in the backend; the judge calibration counted 6
`judge:unavailable` rows as PASS.

Scope given: `backend/src/ai/image-generator`, `validators`, `prompts/plan|prose|illustration|image-judge`,
schemas `visual-bible` and `image-judge`; context ADR-0007, the judge calibration report, progress.md
2026-09-03…07, issues #364, #366, #367. Six questions: what to delete; where the normalizer compensates
for the schema; one source for the hero appearance; why Prose does not see the bible and what the
Plan → Prose → Image contract should be; which integration test would have caught #364; which env
flags are redundant.

Hypotheses the review overturned:
- "The #365 test would have caught the bug before the fix." It is valid for that parameter; the
  weakness is the hand-built provider list, not the assertion.
- "`IMAGE_EVAL` guards a cheap call." Real money: every judge FAIL buys a re-render on Grok. A lever is
  needed, but a different one.
- "The `eval:images` harness is dead." The runner was reused for the judge calibration; only the
  variant layer is dead.
- "Sheets are already best-effort." Only a content refusal is skipped; any other provider error fails
  the book.

## Decisions by question

### 1. Delete as finished experiments

None of these needs a migration: `storyJson` is read by cast without parsing, and Zod drops unknown keys.

- **Cascade, end to end:** the input field, the second page loop, the `prev` reference slot, the
  continuity line in the prompt, the judge special-case, the harness variant. ADR-0007 calls it
  "flag-gated"; there is no flag — it is production code behind a call argument.
- **`timeOfDay` and `framing` on Scene:** read by no prompt, sheet or judge; a per-page time of day
  contradicts one sheet per location. Keep `props` for now (a consumer appears in §4), otherwise delete
  with them.
- **Gemini Pro leftovers:** the model env override, the budget entry of 14, the silent default of 3
  for an unknown model. The budget should be a property of the provider.
- **The OpenAI *image* provider and the whole `usesReference` dimension:** without references there is
  no portrait, no sheets, no photo — not a fallback but a silent quality regression. An unknown
  `IMAGE_PROVIDER` currently selects Gemini silently; it must fail at startup. (The OpenAI *text*
  models — Plan, Prose, title, text judge — are untouched.)
- **The legacy no-bible path** is reachable from two places: retrying pre-#348 books, and a page-count
  mismatch between Plan and Prose. Close the first with one SQL count in production plus a
  "regenerate" button; the second is closed by §4.
- **The prompt simplifier:** written for DALL-E, cuts the assembled prompt to 150 chars losing hero and
  setting, and is the only `generateText` without a schema. First count `simplify-prompt` spans on Grok
  in LangFuse; at zero delete it together with the image service's dependency on the OpenAI key.
- The harness variant layer, the `variant` span label, three spike scripts, the Qwen env lines.

### 2. Where the normalizer compensates for the contract

Three repairs are legitimate and stay; four paper over contract gaps.

- Legitimate: dropping unknown / duplicate cast and prop ids; forcing the hero onto cover and final.
- **Substring name matching in Russian intents is wrong both ways:** «Мишу» does not contain «миша»,
  «Таня» contains «аня» (verified by execution). Replace with the structural "who is on the page"
  contract from §4; delete the heuristics.
- **`ensureHeroGender`** derives from model text what is already on the input. Build the hero `kind`
  in code from age and gender; for observer mode add a gender enum to the Plan so the choice is
  single and explicit.
- **`withNoun`** exists because the model never sees field meaning: the schemas have zero
  `.describe()`, all JSDoc is invisible to it. Put descriptions on the schema, shrink Plan rule 10 to
  decisions, keep `withNoun` as a canary counter.
- **`characterProfile`** is demanded from the Plan model and echoed by the Prose model; both values
  are discarded. Remove it from both model-facing contracts; keep it on the persisted Story as a
  code-set field.
- The "dangling locationId → first location" fallback silently moves a page elsewhere. Measure its
  frequency first, then decide: accept, or send to the regeneration loop.
- Repairs are unmeasurable today: one summed counter and a warn line; the promised `bibleRepairs`
  span metadata was never implemented. Instrument by kind before touching any heuristic.

### 3. One source for the hero appearance

Today up to six appearance strings per book, diverging in two of four modes.

- Child mode with a parent-given appearance: the Plan's structured look and the gender repair are
  computed and thrown away; what lives is free text from gpt-4o-mini with no required fields and no
  skin tone — exactly the omission class #360 closed for cast, still open for the hero in the launch
  flow.
- Photo mode: the page prompt and the judge get a Russian face-only line; the outfit is pinned
  nowhere in text.
- Decision: one structured `Appearance` object, resolved once in code after the Plan from one source
  per mode, and one renderer. The parent's description is derived into the same Zod schema, parent
  fields win, gender is added deterministically. Photo: the Russian line stays only for the portrait
  step; for pages and the judge the vision call additionally returns English structured face fields.
- Invariant under test: the portrait string, the page hero string and the judge context are identical
  in every mode.
- The Prose phase sees the hero's look, contradicting CONTEXT.md and the #216 invariant. Remove it;
  pass Prose the name and gender explicitly, otherwise gender disappears with the string.

### 4. Why Prose does not see the bible; the Plan → Prose → Image contract

The "sand vs grass" mechanism: #363 narrowed the location descriptor to one object for the picture,
while Prose still sees only the Russian name «горка на площадке» and completes the world from its
prior. Prose rule 4 demands "use most of the character budget", and its only material is the intent.

- **Contract:** the world in the Plan, the words in Prose, an illustrator brief as a separate small call
  after Prose, rendering in code. The Plan owns coherence of intent and world: everything an intent
  names exists in a location or a prop. Prose receives a Russian "in frame: slide, grass" list as a
  constraint, not as material, plus the rule "expand with dialogue and feeling, never with new
  objects, weather or scenery". English descriptors are not shown to Prose (fallback for A/B, Russian
  translation only).
- **Take the ACTION away from Prose.** Recommended: a post-Prose brief that sees the final text and the
  bible and returns per page `heroOnPage`, `castIds`, `propIds` as enums of the book's ids and one
  English sentence with a schema limit. Assembler and judge consume the same string, the normalizer
  heuristics disappear, Prose stops writing English — which makes hypothesis 2 of #367 testable.
  Precedent: the title is already derived from the finished story. Cheap alternative: Prose returns
  `heroOnPage` and `castOnPage` next to the action, but then gpt-5 keeps writing English.
- Fix the Prose page count by the Plan in the schema; a template mismatch or a missing scene becomes a
  structural error in the existing regeneration loop. Delete the align-by-index.
- Scale for #366 belongs in a structured Location: key object, materials, size relative to the child
  as an enum, surroundings; rendered in code for sheet and page alike. Replace the judge's
  `adultScaleNatural` with a general `proportionsNatural` and recalibrate. A sheet with a silhouette
  is a harness experiment, not a contract.
- A deterministic "text vs bible" check is impossible (Russian morphology vs English descriptors).
  Give the text judge the bible and an informational `pictureConsistency` criterion; gate after
  calibration.
- The Plan is not persisted, so #367 could not say where the sand came from. Decide on storing intents
  next to `storyJson`.

### 5. The integration test that would have caught #364

Minimal test: compile the real `AiModule` through a testing module with Prisma, S3 and Config
replaced, and assert the resolved generator judges. The #365 test wires providers by hand and would
not notice the judge being dropped from the module.

- The root class is "a production dependency declared optional": no startup failure, the log does not
  distinguish "flag off" from "not wired", and `ImageEval` rows have no reader. Make the judge a
  required dependency (the scripts already pass it), name the reason in the log, forbid `@Optional`
  in `src/ai`.
- The same class is open on main right now by a second route: when the judge throws, the page passes
  without a row, and the Google key is read as an empty string instead of `getOrThrow`. **In the
  calibration table six `judge:unavailable` rows were counted as pass; the claimed 0/65 was measured on
  59 pages** (corrected in this wave, see the calibration report).
- A paid e2e in per-PR CI is not needed: `verify` runs only fast-flow, which never enters the image
  pipeline. The honest guard: fail loud at startup, a module test in `./init.sh`, a `check:book`
  script as the last line of the manual DoD asserting "ImageEval rows = pages × attempts".

### 6. Redundant env flags

- Delete: `IMAGE_REFERENCE_SHEETS` (decided by ADR), `IMAGE_EVAL` (a lever of the wrong shape),
  `GEMINI_IMAGE_MODEL` (single, rejected consumer), the Qwen lines.
- Keep one documented kill switch, `IMAGE_EVAL_MAX_RETRIES`, meaning "0 = judge and write rows, do not
  buy a re-render" — for a miscalibration after a vision-model change.
- Make the code default provider `xai`: the app already does not start without a Gemini key (photo
  descriptor), so "starts without an xAI key" does not hold, and CI can use a dummy value. Parse the
  value strictly.
- The OpenAI key in the image service is needed only by the simplifier and leaves with it.
  `EVAL_MAX_RETRIES` moves from `process.env` to ConfigService.
- Record the configuration rule in ARCHITECTURE: env for secrets, topology and documented kill
  switches with a reason; experiments are explicit options on the service input, never env; after an
  ADR a flag becomes a constant in the same PR. Validate env with a Zod schema at startup.
- Two sources of truth for env: `backend/.env.example` and `deploy-railway.md`, which today lists no
  image variable at all.

## Found outside the questions

- **(Added 2026-09-11 while doing wave 0.)** The six `judge:unavailable` calibration rows are
  deterministic: Gemini blocks the judge request with `PROHIBITED_CONTENT` when the "Hero expected on
  the page" line meets certain innocent page texts; the production judge lets such pages through
  with no verdict. Tracked as #369 (drop the hero line when a portrait is passed; record a block as
  its own outcome; recalibrate).

- **LangFuse is off in production.** Hard constraint 10 is not met for text or images — a separate
  track, but it must be known before any claim about tracing.
- **The `images_failed` retry is not idempotent.** Portrait and sheets are bought again, `ImageEval` rows
  are written again with `attempt = 1`, the "passed on first attempt" metric double-counts. Needs a
  run discriminator and artefact reuse.
- **The page prompt is stored nowhere.** Provider calls bypass telemetry; image cost is not counted.
  Acceptance: a bad page is diagnosable from the DB without LangFuse.
- **The 400 / 30-line limits are convention only.** The image-generator spec is already 420 lines; the
  S3 key layout is hand-built in five places.
- **Docs diverge from code in at least seven places.** Write the consolidated image-pipeline document
  as the last PR of the cycle; mark the spec and the calibration report as point-in-time.

## Order and risk

| # | Decision | Risk | Size | Depends on / proves |
|---|---|---|---|---|
| A1 | Delete cascade, `timeOfDay`/`framing`, Pro leftovers, spike scripts | low | S | grep empty, `./init.sh` green |
| A2 | Instrument normalizer repairs by kind | low | S | before touching any heuristic |
| A3 | Judge a required dependency, a row on `judge:unavailable`, key via `getOrThrow`, module test, `check:book` | medium | S | local dev without a Gemini key fails loudly |
| A4 | Default `xai`, strict provider parsing, Zod env validation, config rule in ARCHITECTURE | medium | M | check Railway variables before merge |
| A5 | Delete `IMAGE_REFERENCE_SHEETS`, `IMAGE_EVAL`, `GEMINI_IMAGE_MODEL`; keep `IMAGE_EVAL_MAX_RETRIES` | low | S | A4 |
| A6 | Delete the OpenAI image provider and `usesReference`; move refusal tests to page-renderer | medium | M | A4; a Grok book unchanged |
| A7 | Simplifier: count spans in LangFuse, then delete | medium | M | A6; a refusal becomes a visible event |
| A8 | Collapse harness variants, keep the runner with `--run` | low | S | A1, A6 |
| B1 | `characterProfile` out of the Plan and Prose contracts; Prose gets name and gender explicitly | low | S | A/B `registerMatch` on frozen fixtures |
| B2 | Page count by Plan in the schema; scene and template as structural errors; delete the legacy path after the SQL count | medium | M | B1; zero "align by index" rows |
| B3 | Hero `kind` from age and gender in code; gender enum for observer; delete `ensureHeroGender` | low | S | B1 |
| B4 | `.describe()` on every model-facing field; shrink rule 10 | low | S | A2; `withNoun` counter drops to zero |
| B5 | One appearance source: parent description into the structured schema; invariant test portrait/page/judge | medium | M | B1, B3 |
| B6 | Photo path: Russian line only for the portrait, English fields for pages and judge; or gate | medium | M | B5; manual migration on Railway |
| B7 | Prose: Russian "in frame" list, intent↔world coherence rule, "no new objects" | low | S | B1; A/B `registerMatch` + owner reading |
| B8 | Post-Prose illustrator brief, ids as enums, delete normalizer heuristics | medium | L | B2, B7; re-render five books, ImageEval pass rate not lower |
| B9 | Text judge sees the bible; informational `pictureConsistency` | low | S | B7 |
| B10 | Structured Location with size, `proportionsNatural`, recalibration | medium | M | B4; the slide book, calibration at 0 false FAILs |
| C1 | Idempotent retry + run discriminator in ImageEval | medium | M | one migration with C2 |
| C2 | Page provenance in ImageEval and the span; cost per provider | low | M | C1 |
| C3 | Linter for 400/30/3; single S3 key layout | low | S | after A1 |
| C4 | ImageEval dashboard and per-page SSE progress | low | M | A3, C1, C2 |
| D1 | Consolidated image-pipeline document; fix the seven divergences | low | M | last |

Block A closes in three or four small PRs, each green on its own. Block B rebuilds the contract; its
steps B7 and B8 must pass an A/B on prose, because text quality is the north star. Blocks C and D are
independent of B and can run in parallel.

## Owner decisions (2026-09-11)

- Wave 0 first (this record + the calibration correction), then decide on waves A, B, C/D.
- The OpenAI **text** models stay; only the OpenAI **image** provider is a deletion candidate.
- B8 is deferred until B7 + B9 have been measured.
- LangFuse in production is a separate hosting/cost decision.
