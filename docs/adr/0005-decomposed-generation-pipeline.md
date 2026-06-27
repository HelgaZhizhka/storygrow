# ADR-0005: Decomposed generation pipeline + drop vocabulary-RAG

**Status:** Accepted
**Date:** 2026-06-26 (amended 2026-06-27)

> **Amendment (2026-06-27) — register correction + age bands.** The original
> decision below described the target register as **"spare + dialogue-forward +
> picture-trusting"**, inferred from Usborne *First Reading* (*The Boy Who Cried
> Wolf*). A validation experiment in that register was **rejected by the product
> owner** as "оборвано, скупо, плоско" (choppy, sparse, flat). Root cause of the
> mis-step: Usborne *First Reading* is an **early-decoding reader** (the child
> reads it), a different genre from our **parent-read-aloud illustrated storybook**.
> The corrected north star is **Сутеев / Russian folk-tale read-aloud voice**:
> rich, warm, musical, gentle humour, real feeling — the lesson emerging from the
> events. The enemy stays **two-sided** (flat summary AND adult preciousness), but
> richness of voice is the GOAL, not something to strip. Read sections 2–3 of the
> Decision through this correction. Additional decision: **target age bands are
> 3–4 and 5–6** (7–8 dropped — they are independent readers); **5–6 is the
> flagship band** (both arcs, Сутеев register); **3–4 is a simpler, repetition-
> driven profile, virtue arcs only** (the flaw-arc "Расплата" is too heavy for
> 3–4). Register, exemplars, and template caps are therefore **per age band**.

## Context

The product's core quality problem is **story-text quality**: generated prose
comes out either **banal/flat** (on `gpt-4o`) or **ornate/precious** (on `gpt-5`,
e.g. "свет мягкий, как чай с мёдом"). The target is *vivid + simple + natural* —
the register of a parent reading aloud to a ~5-year-old.

Previous attempts slid into **reactive prompt-patching**: each failure mode was
answered with one more prohibition until the generation prompt carried ~12 hard
"do NOT / MUST / NEVER" clauses (anti-moralising, anti-narrator-commentary,
anti-rename, safe-conflict, stakes…). This did not work, and we believe it is a
*cause* of the flatness, not a cure: a single LLM call was asked to invent the
arc, enforce structure, choose a safe conflict, keep the hero consistent, satisfy
all 12 prohibitions, **and** write in register — all at once. Overloading one
call flattens the prose.

Two further root causes surfaced while grilling this decision:

1. **The gold exemplars were themselves mis-calibrated.** Our exemplars
   (`backend/src/ai/prompts/exemplars.ts`) are "writerly" — a simile in nearly
   every beat ("как два сонных червяка", "как барабан на параде"). Comparison
   against a real published book for this age (Usborne First Reading,
   *The Boy Who Cried Wolf*) and against picture-book craft sources shows the
   real register is **far sparer**: short plain sentences, dialogue carries the
   story, **almost no simile**, and **description is the illustrator's job, not
   the text's.** Our per-page spec ("3–4 full sentences, ~180–220 chars, one
   sensory detail, make the feeling visible") actively *manufactures* the
   over-written register and duplicates work the image generator already does.

2. **The judge cannot see the problem.** `engagement` is a single 0–10 integer
   that only penalises the *flat* failure; nothing penalises *ornate*. And
   `finalScore` is the **mean of 7 criteria**, so the one prose signal is diluted
   1:7 and never trips regeneration. We were flying blind on the exact axis we
   care about.

Separately, **vocabulary-RAG is now vestigial.** RAG Phase 1 (`7984bfe`) already
removed allowed-word injection from generation; what remained was "informational"
and shapes nothing. The corpus is English-sourced (Dale-Chall), mismatched for
Russian read-aloud prose. Age-appropriateness already lives in the judge's
`ageAppropriateVocab` guardrail.

## Decision

**1. Decompose the `generate` stage into phases — by concern, not by page.**

```
RAG(removed) → [ PLAN → PROSE → EDIT ] → JUDGE → ILLUSTRATE → RENDER
```

- **Plan** — a first-class `StoryPlan` artefact (own Zod schema, own
  `generateObject` call, own LangFuse trace). Owns the arc, page-by-page beats,
  safe-conflict choice, pedagogy, and the **consistency anchor** (hero name +
  `characterProfile` + voice fixed here). This is the story "bible" both the
  Prose phase and the image generator read.
- **Prose** — a single whole-story call that *renders the plan's beats* in the
  spare register, given one rebuilt exemplar + a small register anchor. It keeps
  the whole story in one context, so cross-page consistency is preserved exactly
  as before. It carries **none** of the 12 prohibitions — their causes are
  resolved in the Plan.
- **Edit** (optional) — a whole-story read-aloud revision pass that trims
  ornateness and length to register. This is where a strong-but-ornate model's
  controllable overshoot is reined in.

Decomposition is **by concern, not by page.** Per-page generation (as in naive
implementations) is rejected: it blinds each call to the others and causes name /
tone / plot drift.

**2. Retarget the register** (see Amendment 2026-06-27 — supersedes the original
"spare" wording). Target = a **rich, warm, read-aloud storybook voice in the
Сутеев / Russian folk-tale tradition**: warm narrator ("Жил-был…"), folk rhythm
and inversion, gentle humour, natural dialogue, real feeling, lesson emerging
from the events and stated once. Text may carry vivid concrete detail; it leans
on the illustration for the scene but is not stripped to a skeleton. The rigid
per-page density spec ("3–4 sentences, ~180–220 chars, one sensory detail") is
removed — richness comes from voice and rhythm, and length comes from MORE pages,
not denser pages. Enemy is two-sided: flat summary AND adult preciousness.

**3. Rebuild the gold exemplars** to this rich Сутеев register (5–6 band). Exemplars remain the
**core quality anchor** — the operational definition of "good" — and are used in
**two** places: as the Prose phase's few-shot target and as the Judge's
calibration reference. Exemplars are *not* dropped; describing register with
rules instead of examples is exactly the whack-a-mole this ADR rejects.

**4. Rebuild the judge.**
- The judge **sees the exemplars** and scores `registerMatch` **two-sided**: high
  = same register as gold; low if **flatter** (event-summary, no dialogue) **or**
  **more ornate** (dense metaphor, rare words, precious imagery).
- Criteria **split into two groups**: **Guardrails** (safety, structure,
  age-vocab, moral, length) are pass/fail gates; **Craft** (`registerMatch`) is
  the signal we optimise and the one that triggers regeneration. A story passes
  only if guardrails clear **and** craft ≥ threshold. The prose signal can no
  longer be diluted by averaging.

**5. Drop vocabulary-RAG from the pipeline.** Age-fit stays in the
`ageAppropriateVocab` guardrail. The `pgvector` infrastructure is **retained but
repurposed**: if the exemplar library grows, the same vectors can serve
*craft-exemplar retrieval* (pick the closest gold story by goal/arc) — a
legitimate future RAG use, unlike vocabulary gating.

**6. The model choice is deferred to measurement.** `gpt-4o` vs `gpt-5` vs
`gpt-4.1` becomes a question for the **Prose phase only**, answered empirically
via `eval:text` under the rebuilt judge — not guessed.

## Considered alternatives

- **Keep one mega-call, fix only register + exemplars + judge.** Rejected: one
  call still juggles everything; we would keep fighting the overload — patching
  at the prompt level instead of the architecture level.
- **Simplify toward a naive per-page baseline** (no judge, no structure, raw
  per-page calls, as seen in a sibling project). Rejected: that throws away
  structured output, the judge, and the eval loop — i.e. the only way to
  *measure* prose quality, which is the keystone of fixing it. It is behind us,
  not ahead.
- **Drop exemplars entirely.** Rejected: exemplars are the operational definition
  of "good" and the judge's only linear reference for `registerMatch`. Without
  them we are back to describing register with rules, which provably cannot
  separate "как два сонных червяка" (fine) from "чай с мёдом" (ornate).

## Consequences

- **ADR-0004 (safe-conflict) is preserved, relocated.** Its constraint is no
  longer a prohibition bolted onto the prose prompt; it is decided in the **Plan**
  phase (the beats choose a safe conflict before any prose exists) and still
  enforced by the widened `safetyForChildren` guardrail. Stakes-not-danger and
  the flaw-arc "Расплата" beat are unchanged — they live in the plan.
- **The 12 prompt prohibitions are removed, not rewritten** — their causes are
  resolved upstream (name fixed in plan, arc fixed in plan, safe conflict chosen
  in plan).
- **Issue #190 (vocabularyCompliance) is closed** — fixing a vocabulary *limiter*
  we have removed is meaningless. **Issue #193** is reframed from "free the
  lexicon" to "remove vocabulary-RAG from the pipeline".
- **Product identity shift.** StoryGrow was pitched as "age-adapted vocabulary via
  RAG". Dropping vocabulary-RAG removes that framing. This is a deliberate trade
  in line with the current priority (genuinely good output over a kept buzzword).
- **Cost/latency:** 2–3 LLM calls instead of 1. The Custom Flow is already async
  (3–10 min); text tokens are cheap relative to images. Acceptable.
- **Validation gate.** No pipeline code is committed until the cheapest experiment
  confirms the hypothesis: rewrite **one** exemplar + the prose spec to the spare
  register, run `eval:text` on 3–4 goals, and confirm the register actually
  shifts. If it does not, the design is reconsidered before any build.
