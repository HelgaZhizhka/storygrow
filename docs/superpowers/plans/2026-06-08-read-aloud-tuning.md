# Read-Aloud Text & Vocabulary Tuning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make 5–6-year-old story text longer and lexically richer for the read-aloud model, without removing the vocabulary RAG.

**Architecture:** Four small changes — two constants, one prompt reframe, one evaluator-gate decoupling. `maxChars` is the single source of truth (flows to prompt catalogue + structural validator), so the limit bump propagates automatically.

**Tech Stack:** NestJS, Zod, Vercel AI SDK, Jest.

Spec: `docs/superpowers/specs/2026-06-08-read-aloud-text-tuning-design.md`

---

## Task 1: Raise content-page text limits + widen retrieval

**Files:**
- Modify: `backend/src/pdf/page-templates/page-templates.config.ts`
- Modify: `backend/src/ai/ai.config.ts:3`

- [ ] **Step 1: Bump `image-top` and `image-bottom` text limit 120 → 220**

In `page-templates.config.ts`, change both `image-top` and `image-bottom`:

```ts
    maxChars: { text: 220 },
```

- [ ] **Step 2: Widen vocabulary retrieval**

In `ai.config.ts`, change line 3:

```ts
export const DEFAULT_TOP_K = 150;
```

- [ ] **Step 3: Verify validator tests still pass (limit is read from config)**

Run: `pnpm --filter backend test -- book-plan.validator`
Expected: PASS. If a test hard-codes 120, update it to 220.

- [ ] **Step 4: Commit**

```bash
git add backend/src/pdf/page-templates/page-templates.config.ts backend/src/ai/ai.config.ts
git commit -m "feat(ai): raise 5-6 page text limit to 220 and widen vocab retrieval"
```

---

## Task 2: Reframe the vocabulary prompt for read-aloud

**Files:**
- Modify: `backend/src/ai/prompts/story-generator.prompt.ts`

- [ ] **Step 1: Soften system rule 2**

Replace:

```
2. Use ONLY vocabulary from the provided allowed-words list plus common
   function words (prepositions, conjunctions, pronouns, particles).
   Any word outside the list is a violation.
```

with:

```
2. PREFER the provided allowed-words list plus common function words. You MAY
   also use other simple, age-appropriate Russian words that a child understands
   when the story is read ALOUD by a parent. Favour concrete, emotionally clear
   words (e.g. feelings) over rare or abstract ones.
```

- [ ] **Step 2: Update the user-prompt vocabulary line**

Replace:

```ts
Allowed vocabulary (Russian words — use ONLY these plus common function words):
${allowedWords.join(', ')}
```

with:

```ts
Preferred vocabulary (Russian words — prefer these; you may also add other simple
words a 5–6-year-old understands by ear when read aloud):
${allowedWords.join(', ')}
```

- [ ] **Step 3: Verify prompt tests pass**

Run: `pnpm --filter backend test -- story-generator.prompt.spec`
Expected: PASS (existing tests assert protagonist/gender/appearance, not the vocabulary wording).

- [ ] **Step 4: Commit**

```bash
git add backend/src/ai/prompts/story-generator.prompt.ts
git commit -m "feat(ai): reframe vocabulary prompt for read-aloud comprehension"
```

---

## Task 3: Decouple vocabulary compliance from the hard pass-gate

**Files:**
- Modify: `backend/src/ai/story-generator/story-evaluator.service.ts`
- Test: `backend/src/ai/story-generator/story-evaluator.service.spec.ts`

- [ ] **Step 1: Update the failing test first**

In `story-evaluator.service.spec.ts`, the test `returns passed=false when vocabulary compliance is below threshold` now describes the OLD behaviour. Replace it with:

```ts
  it('does NOT hard-fail on low vocabulary compliance (soft signal), but still reports it', async () => {
    const storyWithRareWords: Story = {
      ...validStory,
      title: 'бегемот жираф слон антилопа носорог лемур',
      pages: validStory.pages.map((page) =>
        page.text ? { ...page, text: 'бегемот жираф слон антилопа носорог' } : page,
      ),
    };
    mockGenerateObject.mockResolvedValueOnce({ object: passingJudge } as never);
    const result = await service.evaluate({
      ...baseInput,
      story: storyWithRareWords,
      corpusWords: ['кот'],
    });
    expect(result.passed).toBe(true); // judge + structure + language pass; vocab is soft
    expect(result.outOfCorpus.length).toBeGreaterThan(0); // still reported
    expect(result.vocabularyCompliance).toBeLessThan(0.4); // still computed
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter backend test -- story-evaluator.service.spec`
Expected: FAIL — `passed` is currently `false` because compliance gates it.

- [ ] **Step 3: Drop `compliance.passed` from the hard gate**

In `story-evaluator.service.ts`, change:

```ts
    const passed =
      structural.passed &&
      languagePurity.passed &&
      compliance.passed &&
      computedFinalScore >= evalThreshold;
```

to:

```ts
    // Vocabulary compliance is a SOFT signal under the read-aloud model: it is
    // still computed, stored, and fed into regeneration feedback, but it no
    // longer hard-fails a book on its own. Hard gates: structure, language
    // purity (Russian-only), and the judge score.
    const passed =
      structural.passed && languagePurity.passed && computedFinalScore >= evalThreshold;
```

Leave the `compliance` computation, the `vocabularyCompliance` return value, and the warning log unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter backend test -- story-evaluator.service.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/story-generator/story-evaluator.service.ts backend/src/ai/story-generator/story-evaluator.service.spec.ts
git commit -m "feat(ai): treat vocabulary compliance as a soft signal, not a hard gate"
```

---

## Task 4: Verify + PR

- [ ] **Step 1: Full smoke check**

Run: `./init.sh`
Expected: `Smoke check PASSED`.

- [ ] **Step 2: Manual (optional, costs tokens)**

Regenerate a 6-year-old custom book; confirm pages now carry 2–3 sentences,
richer feeling-words, and text stays Russian-only.

- [ ] **Step 3: PR**

```bash
git push -u origin issue/160-read-aloud-tuning
gh pr create --title "feat(ai): read-aloud text & vocabulary tuning" --body "Closes #160"
```

---

## Self-review

- **Spec coverage:** limits (T1), topK (T1), prompt reframe (T2), compliance decoupling (T3) — all four spec changes mapped.
- **Hard gates preserved:** structure + languagePurity + judge threshold remain; only vocabulary moves to soft. Confirmed in T3 Step 3.
- **No placeholders:** every step shows the exact before/after.
