# StoryGrow — Session Log

Multi-session continuity log. **Newest entry at the bottom.** One entry per work session.

Each entry uses this template:

```
## YYYY-MM-DD — short topic

**Done:**
- ...

**Decisions:**
- ...

**Next:**
- ...

**Blockers:**
- ... (or "none")
```

---

> **Rotation policy (2026-07-16):** this file keeps only recent entries (~last 10).
> Older entries are archived in `docs/process/progress-archive-*.md` — do not read
> archives at session start; they are history, not state.

---

## 2026-06-26 — Priority reset + text-quality push (#188/#187 merged, #191 docs, RAG plan)

**Done:**
- **#188 (two-arc model) and #187 (appearance limit) merged to `main`** (`33e3731`, `d4bd213`). Live flaw regen verified the consequence beat + `earnedResolution` row.
- **Text-quality fixes** (in #188): removed beat-meta leakage ("но без последствий"), enforced hero-name consistency, demanded concrete external consequences, forbade characters (incl. mentors) from pronouncing the moral. Verified on 3 flaw goals via `eval:text`.
- **`eval:text` harness** now derives `arcType` from the goal — text-only A/B without burning image tokens.
- **#191 (this entry)** — docs recalibrated away from "course defense as the priority/substance" toward product quality + deployment (CLAUDE.md, AGENTS.md, PROJECT_PLAN.md, CONTEXT.md, ARCHITECTURE.md). `docs/defense/*` materials and ADRs left intact (history + tools for the eventual defense).

**Priority reset (supersedes earlier "defense prep (primary)" / "no deploy" notes above):**
- The course defense is **no longer the priority** — it remains a later milestone, not the organizing principle.
- **Priority 1: product quality** — genuinely good, non-banal story text. Blandness is the core problem.
- **Priority 2: deployment** — the app WILL be deployed (Dokploy/Hetzner); the earlier "no deploy" plan is reversed.

**RAG plan (agreed):** the vocabulary RAG constrains lexicon downward and contributes to banality.
- **Phase 1 (next):** stop injecting the allowed-words list into generation (free the lexicon); keep the `ageAppropriateVocab` judge as the age guardrail; drop the out-of-corpus regeneration feedback. A/B a stronger creative model via `eval:text` (Anthropic model needs the `@ai-sdk/anthropic` dep — discuss before adding).
- **Phase 2 (optional):** repurpose pgvector toward craft/exemplar retrieval (dynamic high-quality few-shot) so RAG serves voice.
- **#190 (vocab corpus fix)** to be reoriented or closed — fixing a vocab *limiter* loses meaning if we free the lexicon.

**Next:**
1. Open `issue/191` PR (docs recalibration).
2. RAG Phase 1 — separate issue/branch: remove vocab injection from generation + clean regen feedback; re-test text via `eval:text`.
3. Discuss model A/B (dep decision) and run the comparison.
4. Plan deployment as its own workstream (brainstorm → spec).

**Blockers:** None.

---

## 2026-06-27 — Text-quality design grill → ADR-0005 (decomposed pipeline)

**Done:**
- **Grilling session** (`/grill-with-docs`) on the core problem — story-TEXT quality (banal vs ornate). Reframed it from a single register dial to three root causes: (1) one overloaded `generate` call, (2) mis-calibrated "writerly" exemplars + a per-page density spec that manufactures over-writing, (3) a judge blind to register that dilutes craft 1:7.
- **Studied a real published book** (Usborne First Reading, *The Boy Who Cried Wolf*, in `~/Downloads/book_example.pdf`) + picture-book craft sources. Target register = **spare + dialogue-forward + picture-trusting**: short plain sentences, dialogue carries the story, almost no simile, description is the illustrator's job. Our exemplars (e.g. "как два сонных червяка") are over-written by comparison.
- **`ADR-0005` written + committed** (`99331cc`): decompose `generate` into **Plan → Prose → Edit** (by concern, not by page); `StoryPlan` as first-class consistency anchor; retarget register; rebuild exemplars (used by both prose and judge); **split judge into Guardrail gates + two-sided `registerMatch`** so the craft signal can't be averaged away; **drop vocabulary-RAG** (pgvector repurposed for future craft-exemplar retrieval).
- **CONTEXT.md updated** (same commit): new terms `Story Plan`, `Prose Pass`, `Read-Aloud Edit`, `Register Match`; updated `AI Pipeline`, `Custom Flow`, `Judge Score`, `Gold Exemplar`; deprecated `Vocabulary Entry` / `Grade Level`.
- **Validation-gate experiment** (per ADR) via `eval:text` on Честность + Смелость: retargeting the prose spec + 2 exemplars to the spare register shifted output decisively (avg **145→74** and **137→61** chars, dialogue-forward, no scenery padding, no mid-story moralising). The current judge stayed at engagement **7** / finalScore ~8.7 across the whole shift → **empirical proof the judge is register-blind**. Experiment edits reverted (clean tree); ADR/CONTEXT remain committed.

**Decisions:**
- Reference repo `yakovlef/storycraft` is **behind us**, not a model to copy (raw per-page calls, no judge/structure). Its only transferable idea — decomposition — is adopted.
- **Exemplars are NOT dropped** — they are the operational definition of "good" and the judge's `registerMatch` yardstick. They are *rebuilt*, not removed.
- Correction to sequencing: the `registerMatch` judge depends on trustworthy exemplars, so **"the meter" = rebuild exemplars (spare *and* lively) FIRST, then build the judge.** Sparse ≠ automatically lively (the quick spare rewrites tipped into terse-flat); liveliness must come from characterful, funny dialogue.
- Issues: **#190 to close** (fixing a removed vocab limiter is moot); **#193 reframe** "free the lexicon" → "remove vocab-RAG from pipeline".

**Next (the meter, then decomposition):**
1. Rebuild exemplars → spare **and** lively (Usborne as north star), update `exemplars.spec.ts`.
2. Build `registerMatch` judge: split schema (Guardrails gates + Craft), judge prompt shows exemplars, two-sided (penalise flatter AND ornate); stop averaging craft into the mean.
3. Generation decomposition: `StoryPlan` schema + Plan/Prose/Edit phases; choose Prose-phase model via `eval:text` under the new meter.
4. (Branch hygiene) Decide #193 PR scope now that it carries the ADR.

**Blockers:** None.

---

## 2026-06-27 (cont.) — register corrected (Сутеев) + exemplars rebuilt + age bands

**What changed since the entry above (important reversal):**
- The "spare register" direction from the entry above was **WRONG and is reversed.** A spare experiment was rejected by the product owner as "оборвано, скупо, плоско". Root cause: Usborne *First Reading* is an early-**decoding** reader (child reads it), not our genre. Our genre is **parent-read-aloud illustrated storybook**.
- **New north star: Сутеев / Russian folk-tale read-aloud voice** (portal `deti-online.com/skazki/dlya-detey-4-5-let`). Rich, warm, musical: warm narrator ("Жил-был…"), folk rhythm/inversion, gentle humour, natural dialogue, real feeling, lesson emerging once. Enemy is two-sided — flat summary AND adult preciousness; **richness of voice is the GOAL**.

**Done (committed `46e5cc5`):**
- All 6 gold exemplars rebuilt to the Сутеев register (5–6 band). Converged via tight loop on ONE (Гриша) until product owner approved ("это подходит"), then propagated. tsc 0, prompt tests 11/11, lint 0.
- ADR-0005 amended (register correction + age bands); CONTEXT.md `Gold Exemplar` / `Prose Pass` wording corrected.

**Decisions (new):**
- **Age bands: 3–4 and 5–6; drop 7–8** (independent readers, different product). **5–6 = flagship** (both arcs, Сутеев). **3–4 = simpler, repetition-driven, virtue-only** (flaw "Расплата" too heavy for 3–4). Register/exemplars/template caps become **per band**.
- "More text" = **more pages** (page stays short + image), not denser pages; the Plan phase spreads the arc across age-capped pages.
- **Personalization** (user supplies interests / motifs / soft words / child's likes → more personal, less generic) = **separate workstream, deferred**, needs its own discussion → likely its own issue. Seeds feed the Plan phase; words are SOFT (weave-if-natural), never hard constraints (avoid recreating vocab-injection flattening). Directly attacks banality (generic input → generic output).

**Next:**
1. (When postgres is up) `eval:text` a flaw + virtue goal to see generation under the new exemplars (judge still register-blind — eyeball only).
2. Build `registerMatch` judge: split schema (Guardrail gates + Craft), judge prompt shows exemplars, two-sided. Then the prose signal stops being averaged away.
3. Generation decomposition (`StoryPlan` → Plan/Prose/Edit); choose Prose model via `eval:text` under the new meter.
4. 3–4 band profile (simpler exemplars + smaller template caps) after 5–6 is solid.
5. Personalization: brainstorm → spec → issue.

**Blockers:** postgres/docker stack was down at end of session (`eval:text` needs it); user runs the stack themselves.

---

## 2026-06-27 (cont. 2) — registerMatch judge built + model A/B done

**Done (committed):**
- `e872a3c` — **`registerMatch` judge**: split criteria into Guardrails (gates) + Craft; judge shows 2 exemplars and scores register **two-sided**; accept = guardrails ≥ floor (6) AND registerMatch ≥ threshold (7); `computeFinalScore` = registerMatch (no mean). Replaces single-sided `engagement`. Acceptance: text that scored a flat 9.43 (praising "туча заволокла солнце") now scores 7–8 with register-specific reasoning. tsc 0, ai tests 96/96, lint 0.
- **Model A/B under the new meter** (3 runs × {gpt-4o, gpt-5, gpt-4.1} × {Смелость, Честность}): registerMatch means 7.5 / 7.83 / 8.0 — all within noise. **gpt-4.1 disqualified** (passed 1/6 — overflows page caps). **Decision: stay on gpt-4o** — model is NOT the lever; the ~7–8 ceiling is set by the overloaded single call. Recorded in `docs/process/ai-text-quality-evolution.md` (Глава 2).

**Next:** generation **decomposition** (`StoryPlanSchema` + Plan/Prose/Edit) — the last big lever, now measurable. Then revisit Prose-phase model under the meter; then 3–4 band; then personalization.

**Blockers:** none (docker up).

---

## 2026-06-27 (cont. 3) — decomposition built; the lever is Plan + gpt-5 prose

**Done (committed):**
- `0a3cfec` — **decomposition Plan → Prose** (ADR-0005): `StoryPlanSchema` (bible: hero/name, page layout, per-page beat+intent, lesson, questions) + `plan.prompt` (structure, gpt-4o) → `prose.prompt` (voice, gpt-5) rendering the plan in the Сутеев register. `StoryGeneratorService.generateStory` runs both, traced separately. Model split `PLAN_MODEL=gpt-4o` / `PROSE_MODEL=gpt-5`.
- `f3a75a3` — lint fix. **`./init.sh` exit 0** (backend + frontend tsc/lint/test all green).
- Journal Глава 2 / Эксп. 9 updated (`docs/process/ai-text-quality-evolution.md`).

**Key result (measured under registerMatch):** the lever is the **combination** — decomposition alone on gpt-4o stays flat (6–8); gpt-5 alone on the old single call was noise; **gpt-5 on the isolated Prose phase** finally delivers warm, show-don't-tell prose (rm 7–8, judge: "warm, avoids both flatness and ornamentation"). This *revises* cont.2's "stay on gpt-4o" — that held for the single call; for the decomposed Prose phase gpt-5 wins.

**Next:**
1. **Push branch + open PR** (per plan: build decomposition first, then one PR). Branch `issue/193-…` now carries RAG-phase1 + ADR-0005 + exemplars + judge + decomposition + process docs → PR `Closes #193`; also close #190.
2. Edit pass (optional) if registerMatch dips; raise threshold over time.
3. 3–4 band profile; personalization workstream; delete legacy mega-prompt.

**Blockers:** none.

---

## 2026-06-28/29 — Railway deploy: LIVE ✅

**StoryGrow is deployed and generating books in production.**

**Stack:** Railway — backend (NestJS) + frontend (Next.js) + Postgres (pgvector) + Redis. Cloudflare R2 for S3 (images/PDF). LangFuse off. Google OAuth login working. Full custom-flow verified end-to-end: login → create child → generate book (Plan→Prose gpt-5 → judge → Gemini images in R2 → PDF).

**Domains:**
- API: `https://storygrow-production.up.railway.app`
- Web: `https://storygrow-web-production.up.railway.app`

**Deploy bugs found and fixed (all in main):**
- `#203` — backend Docker build: prisma schema before install, tsconfig.base.json, system Chromium, pnpm deploy --legacy, packages/ workspace, dummy DATABASE_URL for prisma generate.
- `#205` — frontend Dockerfile: NEXT_PUBLIC_API_URL as build ARG; Railway deploy guide `docs/deploy-railway.md`.
- `#207` — prisma CLI in prod image for in-container migrate deploy.
- `#209` — prisma client emits `.js` imports (not `.ts`); dockerignore src/generated so builds regenerate consistently.
- `#211` — bind API to `0.0.0.0` (Node binds IPv6-only by default in container → Railway proxy 502).
- **Railway-specific gotcha:** Railway injects `PORT=8080`, not the app's default (3001/3000). Domain **Target Port must = 8080**. Pre-Deploy Command: `prisma migrate deploy && seed scripts`.

**Seeds:** LearningGoal (20), Template (5) — idempotent, safe to keep in Pre-Deploy. fast-illustrations skipped (requires real R2 + Gemini; re-run manually when needed).

**Next open workstreams:**
1. Text quality follow-ups: #196 (3–4 age band), #197 (personalization).
2. Drop dead VocabularyEntry/vector schema → plain Postgres (no pgvector required).
3. LangFuse Cloud (add keys, remove LANGFUSE_ENABLED=false).
4. Stripe real keys when payments needed.
5. Custom domain (optional).

**Blockers:** none.

---

## 2026-07-07 — quality/UX hardening pass; MVP at a shippable, complete state ✅

All work below shipped to `main` and auto-deployed to Railway (backend + frontend live, `/health` ok, `/books` 200).

**Structural fixes (schema/data-flow, not prompt whack-a-mole):**
- `#217` (#216) — **appearance → images only.** Appearance leaked into the Plan and drove plot/title (a hair-bow became a magic gimmick). Now derived separately into `characterProfile` (image-only); Plan/Prose see only name+gender. Removed redundant prose rule 4a.
- `#219` (#218) — **Plan templates constrained by age.** `buildStoryPlanSchema(childAge)` restricts the template enum to `templatesForAge()`, so an age-invalid template (`text-focus`@6) can't be emitted → no more `structural=false` fails.
- `#222` (#221) — **cover title length gated in `StorySchema`** (single-sourced from `PAGE_TEMPLATES.cover.maxChars.title`); over-length cover titles can't be emitted.
- `#224` (#223) — **companion anchor.** Named pets/toys (`belongings`) had no visual anchor → drifted (cat→plush, name→person). Isolated `deriveCompanions` step yields English descriptors; Prose names companions by descriptor verbatim in every illustrationPrompt.

**Features:**
- `#220` (#197) — **personalization seeds** (interests/motifs/favoriteWords/belongings) on `Book`, fed SOFT into the Plan (flavour the hero's world, never change premise/conflict/lesson). Form fields (custom mode), `eval:text` seed flags. CONTEXT.md updated.
- `#226` (#225) — **delete a book** (DELETE endpoint + S3 cleanup + detail-page button).
- `#228`/`#229` (#227) — delete from gallery card (overlay-link pattern; button top-left, reveal on hover).
- `#231` (#230) — **persistent `AppHeader`** on all app pages (was: `(app)` layout was only an auth guard → generation screen trapped the user); **generation screen redesigned** into the design system with friendly Russian statuses (fixed raw `generating` leak).

**Verdict (agreed with user):** the core product is a **complete, deployed MVP** that fulfils its promise — personalized, pedagogically-grounded children's books with quality control. Text quality reached the north star ("genuinely good, showable"): the Тёма/честность book reads as a real Сутеев-register story. Remaining items are **optional polish/hardening/growth, not missing core functionality.**

**Known-but-deferred quality items (optional, not blockers):**
- Title quality — Plan sometimes emits abstract titles that name the value («…с честностью») despite rule 9; needs a stronger structural nudge.
- **Story-entity drift** — recurring *plot* animals (the rescued kitten changed colour black→ginger) aren't anchored; `#223` only covers user-supplied `belongings`. Generalize the companion anchor to recurring story entities.
- Prose content quality — occasional weak beat (e.g. an absurd tall-tale that collides with the climax animal); a variance/selection concern, not systemic flatness.
- #196 (3–4 age band), PDF discussion-question double-numbering, "Волшебная история" generic label.

**Explicitly rejected this pass:** best-of-N selection (user preference).

**Blockers:** none.

---

## 2026-07-08/13 — remaining quality items closed; ultra-review; docs-currency audit

All shipped to `main`, auto-deployed to Railway.

**Quality items closed (both deferred items from the 2026-07-07 pass):**
- `#236` (#232) — **concrete titles.** Plan's title kept naming the abstract learning value («…с честностью») despite rule 9. New isolated `deriveTitle` step runs *after* Prose, titling from the finished concrete story; `isConcreteTitle` validator gates it (rejects value-naming/dull-template titles, ≤3 retries). Verified: «Алиса и рыжий кот на вершине горки» etc.
- `#237` (#233) — **story-entity anchor.** `#223` anchored user-supplied `belongings` but not animals invented by Prose itself (the rescued kitten drifted black→ginger). New prose rule 8: any recurring non-hero animal gets one fixed descriptor at first appearance, reused verbatim in every illustrationPrompt. Verified: same kitten descriptor across all 4 pages it appears on.
- `#239` (#238) — PDF polish: strip LLM-supplied «N.»/«N)» prefixes from discussion questions (were double-numbered against the template's own CSS counter); cover eyebrow «Волшебная история» → «Персональная история».

**Ultra-review of #231 (AppHeader + progress screen) found 2 real regressions, both fixed in `#235`:**
- `AppHeader` used undefined Tailwind v4 `@theme` tokens (`border-border`, `font-head`) that silently drop — fixed to `border-border-subtle` / `font-display`.
- Progress bar snapped to 0% on SSE reconnect mid-generation (backend replays a bare `{type:'generating'}` with no `progress` on reconnect) — now reads the last log entry with a numeric progress.

**Docs-currency audit (`#241`):** found and fixed real drift accumulated across `#197`/`#223`/`#232` and the Railway migration, none of which updated living docs:
- `CONTEXT.md` — `Story`/`Story Structure` described a pre-ADR-0005 schema shape; `Custom Flow` named classes never built and omitted the Title/Companions phases; added a `Companion Descriptor` glossary term (previously undocumented).
- `docs/ARCHITECTURE.md` — pipeline diagram missing Title/Companions; `Book` Prisma sketch missing the `#197` seed columns; **Deployment section still described Hetzner+Dokploy — the app is actually live on Railway** (the most significant gap).
- `CLAUDE.md` — required env vars missing `GOOGLE_GENERATIVE_AI_API_KEY` (required — Gemini is the default image provider) and `IMAGE_PROVIDER`.

**Verdict:** every known quality gap from the PDF book review is now closed. The MVP-complete verdict from 2026-07-07 stands and is now also true of the docs.

**Blockers:** none.

---

## 2026-07-13 — belongings seed: found broken in prod, fixed, then removed (net simplification)

User reported a personalized pet (`belongings`) didn't appear in a prod-generated book — asked whether that's expected.

**Diagnosis (`#243`):** reproduced with `eval:text --belongings` — the named pet was present in only ~1 of 3 generations. Root cause: the honesty/flaw exemplar's [Расплата] beat requires the hero to discover an **unfamiliar stray** creature — the "nobody believes it's real" tension only works if the animal is a stranger, not the hero's own pet. The seeds instruction was fully soft ("use where it fits"), so the model inconsistently guessed how to reconcile a given pet with that beat.

**Fix shipped (`#244`):** split `belongings` out of the soft seeds block into a firm standalone instruction (must appear on ≥2 pages; the stray-creature beat, if present, must use a different character). Verified 3/3 completed runs — companion present every page.

**Then reversed (`#246`), per user judgment call:** the fix was validated against only ONE exemplar; with ~20 learning goals × 2 arc types, other exemplars likely have similar hidden conflicts — meaning `#243` wasn't a one-time fix, it was the start of a per-exemplar whack-a-mole category. `belongings` was also the only seed requiring its own sub-pipeline (derivation call, schema, prose rule, firm-presence carve-out) versus `interests`/`motifs`/`favoriteWords`, which are simple soft text with zero issues since `#197`. Removed entirely: Prisma column + migration, `companions.prompt.ts`, `deriveCompanions`, prose rule for named descriptors, the form field, docs. `#237` (story-invented recurring character anchor — the rescued-kitten fix) is **independent and unchanged** — it's about animals the story itself invents, not user-supplied pets.

**Lesson:** a fix validated against one test case can still be the wrong call if the underlying mechanism (soft data conflicting with exemplar-specific plot beats) will keep recurring per-exemplar. Recognizing "this fix works but doesn't generalize cheaply" and cutting scope is sometimes better than shipping a narrow patch.

**Blockers:** none.

---

## 2026-07-13 — `#196` design + implementation plan complete (execution deferred to a new session)

Ran the full `superpowers:brainstorming` → `superpowers:writing-plans` process for `#196` (3–4 age-band profile). Both artefacts are written, self-reviewed, and merged to `main`:

- **Spec:** `docs/superpowers/specs/2026-07-13-age-band-3-4-design.md` (`#248`). Key finding during brainstorming: **no page template currently accepts age 3 or 4 at all** (`suitableFor` never includes 3/4 for any template) — this is not "shorten the text," it's "make it work at all." Design: a single `AgeBand = '3-4' | '5-6'` type drives everything (extends the existing `templatesForAge` pattern); per-band `maxChars`/page-count; a simplified 5-beat virtue-only beat sheet (drops "Внутренняя борьба"); 2 draft exemplars (Катя/горка, Мишка/Ёжик) pending pedagogy review; judge recalibrated so repetition is the 3-4 target register, not a "flat" defect; flaw-arc goals hidden from 3-4 parents at the `listLearningGoals` query level; `StorySchema` factored into `buildStorySchema(ageBand)` for Custom Flow only — **Fast Flow explicitly untouched** (its templates aren't age-filtered and weren't designed for per-band caps).
- **Plan:** `docs/superpowers/plans/2026-07-13-age-band-3-4.md` (`#249`). 15 TDD tasks, full real code in every step (no placeholders), covering all ~17 touched files. Self-review caught and fixed 3 real bugs before merge: (1) the original `StorySchema`/`buildStorySchema` draft would have silently dropped Fast Flow's cover-title cap entirely — fixed so `StorySchema` literally **is** `buildStorySchema('5-6')`, byte-identical behavior; (2) a dead `buildStorySchemaForAge` helper with no caller — removed; (3) an unused import left over from that removal, plus a duplicate-import in the validator task — fixed. Also closed one spec-coverage gap (added the "buildStoryPlanSchema rejects a 5-6-only template for age 3" test the spec called for but the first draft plan omitted).

**Explicitly deferred to a new session, per user request:** actual execution (Tasks 1–15). Do NOT start coding in a continuation of this session — the next session should read the plan file and either run `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` starting at Task 1.

**Entry point for the next session:** `docs/superpowers/plans/2026-07-13-age-band-3-4.md`. `session-handoff.md` is intentionally left empty — this isn't a mid-feature interruption (spec+plan are a complete, closed unit of work), it's a deliberate handoff boundary, same as any other "next task queued" entry in this journal.

**Blockers:** none.

---

## 2026-07-16 — Harness audit + lifecycle automation (recs 1–3 implemented)

**Done:**
- **Harness audit** written and merged: `docs/process/harness-audit-2026-07-16.md` (#251) — five-subsystem assessment; bottleneck = Lifecycle 2/5 (everything manual).
- **Rec 1 — progress.md rotation:** 48 old entries (2026-05-21…2026-06-25) archived to `docs/process/progress-archive-2026-05-21--2026-06-25.md`; live file 127 KB → ~25 KB; AGENTS.md now says "read the last 1–2 entries", not the whole file.
- **Rec 2 — CI is now a required check on `main`** (`./init.sh` + `Conventional Commits`), set via branch-protection API; repo `allow_auto_merge` enabled; workflow docs updated to `gh pr merge --squash --delete-branch --auto` (merge queues until CI passes — no polling).
- **Rec 3 — lifecycle hooks** (project `.claude/settings.json`, committed):
  - `SessionStart` → `scripts/hooks/session-start.sh` auto-injects orientation (branch, commits, progress tail, handoff state) — session start no longer depends on the model remembering to read files.
  - `PreToolUse` gate → `scripts/hooks/pre-merge-gate.py` blocks `gh pr merge` of an `issue/*` PR whose diff lacks `progress.md` (mechanically enforces the "bundle the session entry into the feature PR" rule; docs/chore branches exempt; fails open on any uncertainty). Both hooks tested against real PRs (block and pass cases).
- **Rec 5 — codified:** AGENTS.md now requires ≥1 live `eval:text` run before any AI-pipeline PR (was de-facto practice since ADR-0005).
- Stale AGENTS.md rule cleaned (frontend visual-contract referenced long-closed issues).

**Decisions:**
- Direction agreed with the user re "constraining the model": keep product invariants and process rules, avoid thought-micromanagement, and **convert verbal rules into mechanical checks** wherever possible — a rule the machine enforces costs the model zero attention. This session moved two rules (CI-green-before-merge, progress-entry-in-feature-PR) from prose to machine.

**Next:**
- `#196` execution (3–4 age band) in a fresh session — entry point `docs/superpowers/plans/2026-07-13-age-band-3-4.md`.
- Remaining audit recs: #162 batch-eval (the big verification gap), permissions hygiene in `.claude/settings.local.json`.

**Blockers:** none. NOTE for next session: hooks in `.claude/settings.json` will ask for approval on first run — approve them.

---

## 2026-07-16 (cont.) — #162 batch-eval harness (last big verification gap)

**Done:**
- **`eval:batch`** (`backend/src/scripts/eval-batch.ts`): runs a fixed 10-case eval set (both arcs × both protagonist modes × ages 5–6, including two fallback-exemplar goals) through the text-only pipeline with bounded concurrency; prints a per-run table + per-criterion mean/min aggregates + pass rate; `--out=` writes JSON for before/after diffing; exit 1 if any run errored. First-attempt quality only (no regeneration loop) — the metric is "% passing on first attempt".
- **Shared runner extracted** (`scripts/lib/eval-run.ts`) — `eval:text` refactored onto it, output unchanged.
- **Pure aggregation module** (`scripts/lib/eval-aggregate.ts`) — TDD'd (5 unit tests: pass-rate/mean/min, all-failed batch, table/summary formatting).
- **LangFuse tracing in both harnesses** (issue scope item 2): `instrument.ts` imported + `shutdownTelemetry()` flush on exit — batch runs land on the local dashboard when LANGFUSE_* keys are set.
- **Baseline recorded**: `docs/process/eval-baselines/2026-07-16-baseline.json` — the "before" reference for future prompt/model comparisons.
- Scope item 3 (LangFuse datasets/experiments) intentionally skipped — the issue itself marks it optional; YAGNI until we actually compare versions in the dashboard.

**Next:**
- `#196` execution (3–4 age band) — after it ships, extend DEFAULT_SET with age-3/4 cases.
- Re-run `eval:batch` after any prompt/model change and diff against the baseline JSON.

**Blockers:** none.

---

## 2026-07-17 — #256: surreal titles fixed via reference + measurement (not bans)

**Done:**
- The 2026-07-16 baseline surfaced systematic title pseudo-whimsy (3–4 of 10: «булочки, привыкнувшие скучать», invented word «велик-двоечник», «шёпот энциклопедии») — over-correction of #232's "CONCRETE and PLAYFUL vivid image" framing, whose 3 quirky-idiomatic examples the model imitated on the surface.
- **Fix per ADR-0005 philosophy (user-grilled: no new ban lists):** (1) TITLE_SYSTEM re-anchored on PLAIN real-book titles («Кто сказал „мяу"?», «Под грибом», «Мешок яблок» + approved exemplar titles) with a positive goal — name a simple thing that actually appears in the story; (2) the judge's registerMatch now covers the title (measured against the exemplar «Название:» lines, cap ≤6 for invented words / surreal imagery / things not in the story) — selection, not restriction.
- **Verified via eval:batch** (`2026-07-17-after-title-fix.json` vs baseline): all 10 titles plain and concrete, zero invented words; pass 10/10 unchanged; registerMatch 8.1→8.2, structureCompleteness 8.9→9.2, safety 9.3→9.8 — no regressions. First real use of the before/after workflow the batch harness was built for.

**Next:**
- `#196` execution (3–4 age band) in a fresh session — plan at `docs/superpowers/plans/2026-07-13-age-band-3-4.md`.

**Blockers:** none.

---

## 2026-07-17 (cont.) — global context cleanup (audit rec #6, second half) + session close

**Done (user-level config, outside git — recorded here because it closes the audit's last open item):**
- **claude.ai connectors disabled by owner:** Figma, Linear, Gmail, Calendar, Notion (5 of 6 were unauthenticated dead weight surfacing tools into every session).
- **computer-use and Chrome integration disabled** (owner found the app toggle; agent set `claudeInChromeDefaultEnabled=false`). Net effect verified live: **−50 deferred MCP tools, minus the two largest instruction blocks** in every session's system prompt. Chrome re-attaches on demand via `/chrome`.
- **Personal skills pruned** 18 → 12 (archived to `~/.claude/skills-archive/`: caveman, prototype, to-prd, teach, zoom-out, setup-matt-pocock-skills + broken `mentor-review` command and its orphaned `reviwer-prompt.md` agent draft). Measurement correction: skill descriptions were all compact (86–404 B) — the earlier "27 KB skill" readings were a measuring-script bug; the skills folder was never the problem.
- **`fsd-code-reviewer` agent description** trimmed 2.4 KB → 0.3 KB (removed 5 example blocks; body/behaviour unchanged). Plugin `claude-code-setup` disabled.
- **Scoping rule agreed:** new MCP servers go into the project that needs them (`claude mcp add`, local scope), never global — prevents this cleanup from ever being needed again. Backups: `~/.claude/backup-2026-07-17/`, `~/.claude/skills-archive/`.

**Session verdict:** all 6 audit recommendations fully closed (incl. the owner-decision half of #6). Harness state: mechanical lifecycle, required CI, batch-eval with baseline, clean global context.

**Next:**
- `#196` execution (3–4 age band) in a fresh session — plan at `docs/superpowers/plans/2026-07-13-age-band-3-4.md`; then add 3–4 cases to `eval:batch` DEFAULT_SET.

**Blockers:** none.

---

## 2026-07-19 — #196 executed: 3-4 age band shipped (PR #259)

**Done:**
- Executed all 15 tasks of `docs/superpowers/plans/2026-07-13-age-band-3-4.md` via `superpowers:subagent-driven-development` — fresh implementer + task-scoped reviewer per task, all Approved. `AgeBand = '3-4' | '5-6'`, derived once via `ageToAgeBand(childAge)`, now dispatches page-template caps, page count, beat sheets, Gold Exemplars, and judge register calibration. 3-4 is virtue-arcs-only (ADR-0005). Frontend age field opened 5-6 → 3-6.
- Per-task review caught and fixed 3 real issues mid-execution: (1) Task 10's plan brief predated commit b3339c5 (#257, merged 2026-07-17) and would have silently dropped the shipped "TITLE is part of the register" judge bullet for 5-6 — restored byte-for-byte, extended to 3-4; (2) Task 12's brief gave `deriveTitle` a 4th positional param, violating CLAUDE.md's 3-param hard constraint — converted to an object param; (3) Task 13's spec additions had 3 eslint `no-unsafe-*` errors (untyped Prisma mock) that slipped through task-level `pnpm test` and were only caught by Task 15's full `./init.sh` run.
- **Final whole-branch review (opus)** found one more real gap only visible across the full diff: Task 13's server-side flaw-arc-goal filter was unreachable from the actual book-creation form (child created only on submit, so no `childId` exists at goal-fetch time) — a 3-4 parent could still pick a flaw goal and crash generation. Fixed as Task 16 (not in the original plan): `listLearningGoals` gained an explicit `age` param, frontend now refetches goals on `childAge` change and resets a stale selection. Also incidentally fixed a pre-#196 gap — age-range filtering was never wired into this form at all.
- Verified via `./init.sh` (tsc/lint/tests clean, 282 backend + 36 frontend) and three live `eval:text` runs: age 3 virtue (Смелость, registerMatch 9/10), age 4 virtue (Доброта, registerMatch 9/10 — one earlier attempt hit an ordinary first-attempt 112-vs-110-char boundary miss, confirmed non-systemic on retry), age 6 flaw regression guard (Честность, registerMatch 8/10, unaffected).
- **PR #259 opened** (`Closes #196`), queued for auto-merge after required CI.

**Decisions:**
- Manual browser QA (Task 15 Step 6 — real book generation + PDF via the UI) was **deferred by user decision**, not skipped silently: local dev Postgres has a pre-existing migration-drift issue unrelated to this branch, and resetting it would drop local dev data. Flagged in the PR description as a known gap rather than resolved unilaterally.
- FEAR_3_4 / KINDNESS_3_4 (the two new Gold Exemplars) are first-draft Russian text, per the plan's own Global Constraints — flagged in the PR as pending a pedagogy-expert edit pass before the band is launch-ready. **Reviewed and approved by the user 2026-07-19** — read `exemplars.ts` directly, judged the register/refrain device/concrete stakes good. Band now considered launch-ready on the content side.

**Next:**
- Run the deferred manual browser QA once the local dev DB migration drift is resolved.
- Add 3-4 cases to `eval:batch` DEFAULT_SET (carried over from the 2026-07-16 session, still pending).

**Blockers:** none.

---

## 2026-07-19 (cont.) — #196 manual QA completed; migration-drift was a false alarm

**Done:**
- **Correction:** the "migration drift" that blocked manual QA earlier today was a false alarm caused by misusing the `prisma:migrate` wrapper (`pnpm prisma:migrate status` runs `migrate-dev.mjs status`, which forwards `status` as a garbage arg to `prisma migrate dev` — not the same as the real `prisma migrate status`). The real `prisma migrate status` reports the dev DB clean, no drift. No reset was ever needed.
- Ran the deferred Task 15 Step 6 for real: started `docker compose up -d` (full stack, already had a persistent local volume with real data), `pnpm --filter backend dev` + `pnpm --filter frontend dev`, minted a throwaway JWT for a `manual-qa-3-4@test.local` user (via `@nestjs/jwt`'s `JwtService`, written straight to a scratch file — never printed the signed token to the transcript, matching CLAUDE.md's secrets rule) to drive the real API without a Google OAuth flow.
- **`GET /learning-goals`** confirmed Task 16's fix against real Postgres: unfiltered call returns all 19 goals (6 flaw + 13 virtue); `?age=3` returns exactly the 6 age-appropriate virtue goals, zero flaw — the exact behavior the whole-branch review's Important finding was about.
- **Full Custom Flow generation** for a real 3-year-old (`Катя QA`, goal Доброта): Plan → Prose (regenerated once, attempt 2 passed judge gate — the existing "no silent regeneration" behavior held up for the new band too) → images → PDF, all real (OpenAI/Gemini + MinIO + Puppeteer). Judge: registerMatch 9, all criteria 9-10, passed. Story: cover title «Катя и яблоко для лягушки» (well under the 40-char 3-4 cap), 7 pages total (within the 3-4 band's 6-8 range, visibly shorter than a 5-6 book), refrain device present ("Поделиться? Не поделиться?"). Downloaded and verified the actual PDF from MinIO: valid, 7 pages, 13.8 MB.
- Cleaned up the throwaway `mint-test-token.mts` script from the backend source tree (never committed).

**Next:**
- Add 3-4 cases to `eval:batch` DEFAULT_SET (still pending, carried over).
- Dev servers (backend :3001, frontend :3000) and the full docker compose stack were left running for the user's own follow-up poking — stop with `docker compose down` when done.

**Blockers:** none. Task 15 (all 8 steps) and the whole #196 body of work are now fully verified, not just code-reviewed.

---

## 2026-07-20 — #262: eval:batch now covers the 3-4 band

**Done:**
- Added 4 virtue-only 3-4 cases to `DEFAULT_SET` in `backend/src/scripts/eval-batch.ts` (Смелость/age 3 and Забота о младших/age 3 → dedicated exemplars; Доброта/age 4 → dedicated exemplar, observer mode; Самостоятельность/age 4 → 3-4's fallback-exemplar path, mirroring how the 5-6 set already measures its own fallback path via Дружба/Любопытство). No flaw cases added — 3-4 is virtue-only per ADR-0005, unaffected by this change.
- Recorded a new baseline covering both bands: `docs/process/eval-baselines/2026-07-19-with-3-4-band.json` (14 cases, 12/14 pass on a clean full run — the batch harness is single-attempt/no-regeneration by design, so a couple of near-cap first-attempt misses is expected signal, not a regression: Честность/5-6 rm=7 struct-fail is a pre-existing case unrelated to this change; Смелость/age-3 rm=9 but tripped a per-page char cap on one page, consistent with the tight-cap variance already observed during #196's manual `eval:text` testing).
- Hit a real OpenAI quota exhaustion mid-run (not a code bug) after a day of heavy real-LLM testing (#196's manual QA book + repeated eval runs) — user topped up billing, reran cleanly.

**Next:** none pending from this thread. Remaining carried-over item: audit-rec permissions hygiene in `.claude/settings.local.json` (from the 2026-07-16 harness audit, still open).

**Blockers:** none.

---

## 2026-07-20 (cont.) — #264: exemplar-variety pilot (Доброта / 3-4)

**Done:**
- Root-caused why 3-4/Доброта generations felt repetitive despite strong judge scores: `pickExemplar` was deterministic first-match, so every book for a goal with a dedicated exemplar always adapted the same proven plot. High registerMatch scores measure "on-register", not "delightful" — the judge is calibrated against the very exemplar it grades.
- Brainstormed a pilot fix with the user (scoped narrow on purpose: one goal, one band). Added `SHELTER_3_4` — a second Доброта/3-4 Gold Exemplar, "Под грибом"-inspired (widening-circle shelter/inclusion premise), structurally distinct from the existing "lonely creature, give an object" skeleton. Changed `pickExemplar`/`getRegisterReferences` from deterministic-first-match to pooled-random selection.
- Executed via `superpowers:subagent-driven-development`, 4 tasks, all Approved. Task 2's review surfaced a real, previously-undiscussed consequence: `pickExemplar` is shared band-agnostic code, so randomizing 3-4/Доброта unavoidably also randomizes the 5-6 virtue fallback path (~6/14 5-6 goals with no dedicated exemplar — Дружба, Любопытство, Уважение к природе/старшим, Принятие различий, Преодоление разлуки — previously always COURAGE, now random COURAGE/KINDNESS/INDEPENDENCE). Paused, explained it, user explicitly accepted (same variety benefit, no code change).
- Task 4 (integration verification) caught a real flaky test outside this plan's own file scope: `plan.prompt.spec.ts`'s `base3to4` fixture's topic ('Честность') hits the now-randomized fallback pool, and the test asserted one fixed hero — ~2/3 fail rate. Fixed as its own tested commit; verified stable over 5 reruns.
- Final whole-branch review (opus): Ready to merge. Independently verified goalTitles parity, doc-comment cleanup, a 4th 'Катя'-asserting test not on the controller's checklist (safe), and no caching/memoization anywhere assumes deterministic exemplar selection.
- Verified live: 4× `eval:text "Доброта" 3 child` — both skeletons (SHELTER: umbrella + "Тесно? Не тесно?"; KINDNESS: apple + "Дать? Не дать?") confirmed reachable and reading well, 0 structural errors, registerMatch 8-9.
- Mid-session: flagged and ignored a suspicious text fragment that arrived attached to a tool-interruption event (unrelated alarming content in Russian) — did not act on it, explained the likely input-buffer mechanism to the user when asked.

**Decisions:**
- North-star correction from the user: most of this project's prior effort went into *removing badness* (register drift, unsafe titles, structural gaps) via judge/prompt tuning — that machinery is mature. The actual bottleneck on "genuinely good" text is plot variety, and the fix is *more distinct proven plots per goal*, sourced from real premises (not more LLM-drafted variations, which compounds sameness). This pilot is the first test of that lever, deliberately scoped to one goal before deciding whether to expand.

**Next:**
- If the pilot's variety-of-craft holds up in practice, expand to more goals (still one new exemplar at a time, still sourced from real premises) — no commitment made yet on scope/pace.
- Carried over, still pending: `.claude/settings.local.json` permissions hygiene (2026-07-16 harness audit).

**Blockers:** none.

---

## 2026-07-20 (cont. 2) — #268: Stripe billing actually wired (single Premium tier)

**Done:**
- Diagnosed why the user couldn't understand "how a user uses the subscription": `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` in `.env` were literal placeholder text (`sk_test_...`, `whsec_...`), not real credentials — checkout would have thrown immediately. Billing code itself (`billing.module`/`.controller`/`.service`, webhook handling, `/pricing` page) was already complete, just never connected to a real Stripe account.
- User created a real Stripe sandbox account and filled in `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` locally, then added the same three to Railway.
- Collapsed the product from free/basic/premium (3 tiers) to free/premium (1 paid tier) at the user's request: 20€/mo, capped at 30 books/mo — explicitly NOT unlimited, per a real unit-economics concern raised and agreed on (image generation cost per book makes true "unlimited" a margin risk). Free tier restored to its 1-book limit (an existing code comment had already flagged this as "restore once billing works" — this session is that moment).
- `SubscriptionPlan` Prisma enum lost `basic`. Hand-wrote the migration (standard Postgres enum-swap pattern) since `prisma migrate dev` requires a real TTY unavailable in this environment; applied via `migrate deploy` (non-interactive, same mechanism prod uses) after confirming zero `basic` rows in local dev data.
- Local dev DB needed a full reset to clear pre-existing, unrelated migration-checksum drift before the new migration could apply — went through Prisma's own AI-agent safety gate (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`), which demanded fresh explicit consent in-turn rather than relying on an earlier answer. Confirmed dev-only (prod is a separate Railway Postgres, applies via `migrate deploy`, no drift-detection).
- `billing.controller`'s subscribe endpoint no longer takes a body (only one plan exists); `.env`/`.env.example` collapsed to a single `STRIPE_PRICE_ID`; `/pricing` page shows one plan card.
- Full suite green: 281 backend + 36 frontend tests, tsc/lint clean both workspaces, `./init.sh` PASSED.

**Next:**
- Register the production webhook endpoint in the Stripe dashboard pointing at the Railway backend URL (separate signing secret from local) — user's action, not yet confirmed done.
- Manual end-to-end check: real (sandbox) checkout → webhook → quota unlock, not yet run live.

**Blockers:** none.

---

## 2026-07-20 (cont. 3) — #268 confirmed working end-to-end in production

**Done:**
- User registered the production Stripe webhook endpoint and ran the real checkout live: logged into `storygrow-web-production.up.railway.app` with her actual account, subscribed via `/pricing`, paid with a Stripe test card, and confirmed the subscription went through (success page shown, subscription active).
- Caught and corrected a wrong verification path first: an attempted local test-checkout session (via a synthetic local-only JWT) would have failed at the webhook step — the webhook was registered against the *production* URL, and the local synthetic test user doesn't exist in the production database (would hit a foreign-key violation on `Subscription.userId`). Redirected to testing through the real deployed app with a real account instead, which is what actually matters.
- **#268 is now fully done** — not just code-complete but verified working in production, closing the "Next" items from the previous two entries.

**Blockers:** none.
