# Page Templates Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce Page Templates as a typed contract between StoryGenerator and PDFRenderer, replacing the flat `illustrationPrompts[]` in `StorySchema` with a structured `pages[]` array (Issue #60, blocks #11 and #17).

**Architecture:** A single `page-templates.config.ts` is the source of truth for all six layout templates — it is consumed by three stages: the story-generator prompt builder (tells LLM what constraints exist), the `BookPlanValidator` (deterministic post-generation check), and the future PDF renderer (resolves HTML file + DALL-E sizes). `StorySchema` imports the template-name catalogue from that config so Zod enforces valid template names at the type level.

**Tech Stack:** TypeScript strict mode, Zod v3, Jest/ts-jest, NestJS conventions (no framework needed for this PR — all files are pure modules).

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| **Create** | `backend/src/pdf/page-templates/page-templates.config.ts` | Typed template catalogue — single source of truth |
| **Create** | `backend/src/pdf/page-templates/book-plan.validator.ts` | Deterministic post-generation validator |
| **Create** | `backend/src/pdf/page-templates/book-plan.validator.spec.ts` | Validator unit tests (TDD) |
| **Create** | `backend/src/pdf/page-templates/cover.html` | HTML stub |
| **Create** | `backend/src/pdf/page-templates/image-top.html` | HTML stub |
| **Create** | `backend/src/pdf/page-templates/image-bottom.html` | HTML stub |
| **Create** | `backend/src/pdf/page-templates/image-left.html` | HTML stub |
| **Create** | `backend/src/pdf/page-templates/text-focus.html` | HTML stub |
| **Create** | `backend/src/pdf/page-templates/final.html` | HTML stub |
| **Modify** | `backend/src/ai/schemas/story.schema.ts` | Replace `illustrationPrompts` + flat fields with `pages[]` |
| **Modify** | `backend/src/ai/schemas/index.ts` | Update exports |
| **Create** | `backend/src/ai/prompts/story-generator.prompt.ts` | `buildStoryUserPrompt` with template catalogue |
| **Delete** | `backend/src/ai/prompts/.gitkeep` | Replaced by real file |

---

## Task 1: Create git branch

- [ ] **Switch to a clean branch**

```bash
cd /Users/mac/Projects/storygrow
git switch -c issue/60-page-templates-contract
```

Expected: `Switched to a new branch 'issue/60-page-templates-contract'`

---

## Task 2: Page templates config

**Files:**
- Create: `backend/src/pdf/page-templates/page-templates.config.ts`

- [ ] **Create the directory and config file**

```bash
mkdir -p backend/src/pdf/page-templates
```

- [ ] **Write `page-templates.config.ts`**

```typescript
// backend/src/pdf/page-templates/page-templates.config.ts

export type AspectRatio = 'portrait' | 'landscape' | 'square';
export type DalleSize = '1024x1024' | '1024x1792' | '1792x1024';

/**
 * All valid template names. This array is imported by StorySchema to build
 * the Zod enum — it is the single source of truth for template names.
 */
export const TEMPLATE_NAMES = [
  'cover',
  'image-top',
  'image-bottom',
  'image-left',
  'text-focus',
  'final',
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export interface ImageSlot {
  /** Slot identifier used as a CSS class and render target. */
  slot: string;
  aspect: AspectRatio;
  /** DALL-E 3 size that best fits this slot on an A5 page at 150 DPI. */
  dalleSize: DalleSize;
}

export interface MaxChars {
  /** Max characters for the `text` field, if this template has a text block. */
  text?: number;
  /** Max characters for the `title` field, if this template has a title block. */
  title?: number;
}

export interface PageTemplateConfig {
  /** HTML stub filename under backend/src/pdf/page-templates/. */
  htmlFile: string;
  maxChars: MaxChars;
  images: readonly ImageSlot[];
  /** Child ages (inclusive) for which this template is pedagogically appropriate. */
  suitableFor: readonly number[];
}

/**
 * PAGE_TEMPLATES — typed catalogue of all six page layouts.
 *
 * Physical sizing rationale (ADR 0002):
 *   A5 = 148 × 210 mm, target 150 DPI → ~874 × 1240 px canvas.
 *   DALL-E sizes: 1024×1024 (square), 1792×1024 (landscape), 1024×1792 (portrait).
 *
 * `text-focus` is intentionally absent for ages 5–6:
 *   younger children need image-heavy layouts for comprehension.
 */
export const PAGE_TEMPLATES: Readonly<Record<TemplateName, PageTemplateConfig>> = {
  cover: {
    htmlFile: 'cover.html',
    maxChars: { title: 60 },
    images: [{ slot: 'main', aspect: 'portrait', dalleSize: '1024x1792' }],
    suitableFor: [5, 6, 7, 8],
  },
  'image-top': {
    htmlFile: 'image-top.html',
    maxChars: { text: 120 },
    images: [{ slot: 'illustration', aspect: 'landscape', dalleSize: '1792x1024' }],
    suitableFor: [5, 6],
  },
  'image-bottom': {
    htmlFile: 'image-bottom.html',
    maxChars: { text: 120 },
    images: [{ slot: 'illustration', aspect: 'landscape', dalleSize: '1792x1024' }],
    suitableFor: [5, 6],
  },
  'image-left': {
    htmlFile: 'image-left.html',
    maxChars: { text: 200 },
    images: [{ slot: 'illustration', aspect: 'square', dalleSize: '1024x1024' }],
    suitableFor: [6, 7, 8],
  },
  'text-focus': {
    htmlFile: 'text-focus.html',
    maxChars: { text: 350 },
    images: [{ slot: 'illustration', aspect: 'square', dalleSize: '1024x1024' }],
    suitableFor: [7, 8],
  },
  final: {
    htmlFile: 'final.html',
    maxChars: { text: 200 },
    images: [{ slot: 'illustration', aspect: 'portrait', dalleSize: '1024x1792' }],
    suitableFor: [5, 6, 7, 8],
  },
} as const;
```

- [ ] **Commit**

```bash
git add backend/src/pdf/page-templates/page-templates.config.ts
git commit -m "feat(pdf): add page-templates.config.ts — typed template catalogue"
```

---

## Task 3: BookPlanValidator (TDD)

**Files:**
- Create: `backend/src/pdf/page-templates/book-plan.validator.spec.ts`
- Create: `backend/src/pdf/page-templates/book-plan.validator.ts`

- [ ] **Write the failing tests first**

```typescript
// backend/src/pdf/page-templates/book-plan.validator.spec.ts

import { validateBookPlan, ValidationError } from './book-plan.validator';
import { Page } from '../../ai/schemas/story.schema';

const makePage = (template: Page['template'], overrides: Partial<Page> = {}): Page => ({
  template,
  illustrationPrompt: 'A friendly bear in a forest',
  ...overrides,
});

const validPages: Page[] = [
  makePage('cover', { title: 'Мишка и дружба' }),
  makePage('image-top', { text: 'Жил-был медвежонок.' }),
  makePage('image-bottom', { text: 'Он нашёл нового друга.' }),
  makePage('image-left', { text: 'Вместе они играли весь день.' }),
  makePage('image-bottom', { text: 'Медвежонок понял ценность дружбы.' }),
  makePage('final', { text: 'Дружба — это главное.' }),
];

describe('validateBookPlan', () => {
  describe('structure rules', () => {
    it('passes a valid page sequence', () => {
      const result = validateBookPlan(validPages, 6);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('errors when first page is not cover', () => {
      const pages: Page[] = [makePage('image-top'), ...validPages.slice(1)];
      const result = validateBookPlan(pages, 6);
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === 'template' && e.pageIndex === 0);
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/cover/i);
    });

    it('errors when last page is not final', () => {
      const pages: Page[] = [...validPages.slice(0, -1), makePage('image-left')];
      const result = validateBookPlan(pages, 6);
      expect(result.valid).toBe(false);
      const lastIndex = pages.length - 1;
      const err = result.errors.find((e) => e.field === 'template' && e.pageIndex === lastIndex);
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/final/i);
    });
  });

  describe('maxChars validation', () => {
    it('errors when text exceeds template maxChars.text', () => {
      const longText = 'А'.repeat(121); // image-top allows 120
      const pages: Page[] = [
        validPages[0],
        makePage('image-top', { text: longText }),
        ...validPages.slice(2),
      ];
      const result = validateBookPlan(pages, 6);
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === 'text' && e.pageIndex === 1);
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/120/);
    });

    it('passes when text is exactly at the limit', () => {
      const exactText = 'А'.repeat(120); // image-top allows 120
      const pages: Page[] = [
        validPages[0],
        makePage('image-top', { text: exactText }),
        ...validPages.slice(2),
      ];
      const result = validateBookPlan(pages, 6);
      // no text-length error; may have other errors if age check fails
      const textErr = result.errors.find((e) => e.field === 'text' && e.pageIndex === 1);
      expect(textErr).toBeUndefined();
    });

    it('errors when title exceeds template maxChars.title', () => {
      const longTitle = 'А'.repeat(61); // cover allows 60
      const pages: Page[] = [
        makePage('cover', { title: longTitle }),
        ...validPages.slice(1),
      ];
      const result = validateBookPlan(pages, 6);
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === 'title' && e.pageIndex === 0);
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/60/);
    });

    it('ignores text check when template has no maxChars.text defined', () => {
      // cover has no maxChars.text — text field present but not limited
      const pages: Page[] = [
        makePage('cover', { title: 'Мишка', text: 'very long text that covers do not limit at all' }),
        ...validPages.slice(1),
      ];
      const result = validateBookPlan(pages, 6);
      const textErr = result.errors.find((e) => e.field === 'text' && e.pageIndex === 0);
      expect(textErr).toBeUndefined();
    });
  });

  describe('age suitability', () => {
    it('errors when template is not suitable for the child age', () => {
      // text-focus is only for ages 7–8; using it for age 5 is invalid
      const pages: Page[] = [
        validPages[0],
        makePage('text-focus', { text: 'Короткий текст.' }),
        ...validPages.slice(2),
      ];
      const result = validateBookPlan(pages, 5);
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === 'template' && e.pageIndex === 1);
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/age/i);
    });

    it('passes text-focus for age 7', () => {
      const pages: Page[] = [
        validPages[0],
        makePage('text-focus', { text: 'Короткий текст.' }),
        makePage('image-left', { text: 'Продолжение.' }),
        makePage('image-left', { text: 'Ещё страница.' }),
        makePage('image-left', { text: 'Финальная страница текста.' }),
        makePage('final', { text: 'Мораль истории.' }),
      ];
      const result = validateBookPlan(pages, 7);
      const ageErr = result.errors.find((e) => e.field === 'template' && e.pageIndex === 1);
      expect(ageErr).toBeUndefined();
    });
  });

  describe('collects multiple errors', () => {
    it('reports all violations, not just the first', () => {
      const longText = 'А'.repeat(200); // exceeds image-top (120) and image-bottom (120)
      const pages: Page[] = [
        makePage('image-top', { text: longText }), // error: not cover + text too long
        makePage('image-bottom', { text: longText }), // error: text too long
        makePage('image-left', { text: 'ok' }),
        makePage('image-left', { text: 'ok' }),
        makePage('image-left', { text: 'ok' }),
        makePage('image-top', { text: 'ok' }), // error: last page not final
      ];
      const result = validateBookPlan(pages, 7);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
```

- [ ] **Run tests — expect failures (module not found)**

```bash
cd backend
pnpm test --testPathPattern="book-plan.validator" --silent 2>&1 | head -20
```

Expected: `Cannot find module './book-plan.validator'`

- [ ] **Implement `book-plan.validator.ts`**

```typescript
// backend/src/pdf/page-templates/book-plan.validator.ts

import { Page } from '../../ai/schemas/story.schema';
import { PAGE_TEMPLATES } from './page-templates.config';

export interface ValidationError {
  pageIndex: number;
  field: 'text' | 'title' | 'template';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * validateBookPlan — deterministic post-generation validator.
 *
 * Checks every page in the LLM's output against the template catalogue:
 * - Structure: first page must be 'cover', last must be 'final'.
 * - Text length: `text` and `title` must not exceed the template's maxChars.
 * - Age suitability: template must be in the suitableFor list for this child.
 *
 * Returns all errors, not just the first — the caller uses this to build
 * regeneration feedback that fixes all violations at once.
 */
export const validateBookPlan = (pages: Page[], childAge: number): ValidationResult => {
  const errors: ValidationError[] = [];

  if (pages.length === 0) {
    return { valid: false, errors: [{ pageIndex: 0, field: 'template', message: 'Page list is empty' }] };
  }

  // Structure: first and last page templates
  if (pages[0].template !== 'cover') {
    errors.push({
      pageIndex: 0,
      field: 'template',
      message: `First page must use the 'cover' template, got '${pages[0].template}'`,
    });
  }

  const lastIndex = pages.length - 1;
  if (pages[lastIndex].template !== 'final') {
    errors.push({
      pageIndex: lastIndex,
      field: 'template',
      message: `Last page must use the 'final' template, got '${pages[lastIndex].template}'`,
    });
  }

  // Per-page checks
  pages.forEach((page, index) => {
    const config = PAGE_TEMPLATES[page.template];

    // Age suitability
    if (!config.suitableFor.includes(childAge)) {
      errors.push({
        pageIndex: index,
        field: 'template',
        message: `Template '${page.template}' is not suitable for age ${childAge} (suitable for ages: ${config.suitableFor.join(', ')})`,
      });
    }

    // Text length
    if (page.text !== undefined && config.maxChars.text !== undefined) {
      if (page.text.length > config.maxChars.text) {
        errors.push({
          pageIndex: index,
          field: 'text',
          message: `Text on page ${index} is ${page.text.length} chars; template '${page.template}' allows ${config.maxChars.text}`,
        });
      }
    }

    // Title length
    if (page.title !== undefined && config.maxChars.title !== undefined) {
      if (page.title.length > config.maxChars.title) {
        errors.push({
          pageIndex: index,
          field: 'title',
          message: `Title on page ${index} is ${page.title.length} chars; template '${page.template}' allows ${config.maxChars.title}`,
        });
      }
    }
  });

  return { valid: errors.length === 0, errors };
};
```

- [ ] **Run tests — expect all pass**

```bash
cd backend
pnpm test --testPathPattern="book-plan.validator" --silent
```

Expected output: `Tests: 9 passed, 9 total` (or similar, all green)

- [ ] **Commit**

```bash
git add backend/src/pdf/page-templates/book-plan.validator.ts \
        backend/src/pdf/page-templates/book-plan.validator.spec.ts
git commit -m "feat(pdf): add BookPlanValidator with unit tests"
```

---

## Task 4: Update StorySchema

**Files:**
- Modify: `backend/src/ai/schemas/story.schema.ts`
- Modify: `backend/src/ai/schemas/index.ts`

**Breaking change:** removes `setup`, `conflict`, `lesson`, `resolution`, `illustrationPrompts`; adds `PageSchema` and `pages[]`.

- [ ] **Replace `story.schema.ts`**

```typescript
// backend/src/ai/schemas/story.schema.ts

import { z } from 'zod';
import { TEMPLATE_NAMES, type TemplateName } from '../../pdf/page-templates/page-templates.config';

export const DISCUSSION_QUESTIONS_COUNT = 5;
export const PAGES_MIN = 6;
export const PAGES_MAX = 12;

/**
 * PageSchema — one page in the book.
 *
 * `template` drives layout in the PDF renderer; `illustrationPrompt` goes to
 * DALL-E; `text` and `title` are validated against template.maxChars in
 * BookPlanValidator after generation.
 *
 * Template names are imported from page-templates.config.ts so that
 * Zod and the config share a single source of truth.
 */
export const PageSchema = z.object({
  template: z.enum([...TEMPLATE_NAMES] as [TemplateName, ...TemplateName[]]),
  /** Narrative body text for this page. Required for all non-cover templates. */
  text: z.string().optional(),
  /** Title text — required for 'cover', unused on most other templates. */
  title: z.string().optional(),
  /** Detailed DALL-E prompt describing the illustration for this page. */
  illustrationPrompt: z.string().min(1),
});

export type Page = z.infer<typeof PageSchema>;

/**
 * StorySchema — full structured output of StoryGenerator.
 *
 * The narrative arc (setup → conflict → lesson → resolution) is encoded in
 * the order and template selection of `pages`, not as separate top-level
 * fields. The first page MUST use the 'cover' template; the last MUST use
 * the 'final' template. This is enforced by BookPlanValidator after generation.
 *
 * `discussionQuestions` are rendered on the 'final' page by the PDF renderer.
 */
export const StorySchema = z.object({
  /** Book title — also used as the cover page title. */
  title: z.string().min(1).max(120),

  /**
   * Exactly five open-ended questions for parent–child discussion.
   * Rendered on the final page alongside the moral.
   */
  discussionQuestions: z.array(z.string().min(1)).length(DISCUSSION_QUESTIONS_COUNT),

  /**
   * Ordered list of pages composing the book.
   * Min 6 (cover + 4 content + final), max 12.
   */
  pages: z.array(PageSchema).min(PAGES_MIN).max(PAGES_MAX),
});

export type Story = z.infer<typeof StorySchema>;
```

- [ ] **Update `index.ts` exports**

```typescript
// backend/src/ai/schemas/index.ts

export { StorySchema, PageSchema, DISCUSSION_QUESTIONS_COUNT, PAGES_MIN, PAGES_MAX } from './story.schema';
export type { Story, Page } from './story.schema';

export { JudgeScoreSchema, JudgeSchema, computeFinalScore } from './judge.schema';
export type { JudgeScores, JudgeResult } from './judge.schema';
```

- [ ] **Run full backend type-check**

```bash
cd backend
pnpm exec tsc --noEmit
```

Expected: no errors. (If there are errors referencing the old `illustrationPrompts`, `setup`, `conflict`, etc., fix them before committing.)

- [ ] **Run all backend tests**

```bash
cd backend
pnpm test --silent
```

Expected: all tests pass.

- [ ] **Commit**

```bash
git add backend/src/ai/schemas/story.schema.ts backend/src/ai/schemas/index.ts
git commit -m "feat(ai): replace illustrationPrompts with pages[] in StorySchema"
```

---

## Task 5: HTML template stubs

**Files:** 6 HTML files under `backend/src/pdf/page-templates/`

Each file is a self-contained `<section>` fragment (not a full HTML document) with scoped CSS. Slots use `{{placeholder}}` syntax — the PDF renderer replaces them in Issue #17.

The scoped CSS class convention: `.page--{template-name}` (hyphen as separator). All CSS rules are nested under that class to prevent cascade conflicts when pages are composed into one document.

- [ ] **Write `cover.html`**

```html
<!-- backend/src/pdf/page-templates/cover.html -->
<!-- Template: cover — full-page illustration with title overlay -->
<!-- Slots: {{title}}, {{illustrationUrl}}, {{illustrationPrompt}} -->
<section class="page page--cover">
  <style>
    .page--cover {
      position: relative;
      width: 874px;
      height: 1240px;
      overflow: hidden;
      font-family: inherit;
    }
    .page--cover__illustration {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .page--cover__title-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 32px 40px;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
    }
    .page--cover__title {
      margin: 0;
      font-size: 48px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.2;
    }
  </style>

  <img
    class="page--cover__illustration"
    src="{{illustrationUrl}}"
    alt="{{illustrationPrompt}}"
  />
  <div class="page--cover__title-bar">
    <h1 class="page--cover__title">{{title}}</h1>
  </div>
</section>
```

- [ ] **Write `image-top.html`**

```html
<!-- backend/src/pdf/page-templates/image-top.html -->
<!-- Template: image-top — landscape illustration (60% height) + text below -->
<!-- Slots: {{illustrationUrl}}, {{illustrationPrompt}}, {{text}} -->
<section class="page page--image-top">
  <style>
    .page--image-top {
      display: flex;
      flex-direction: column;
      width: 874px;
      height: 1240px;
      font-family: inherit;
    }
    .page--image-top__illustration {
      width: 100%;
      height: 60%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .page--image-top__text-block {
      flex: 1;
      display: flex;
      align-items: center;
      padding: 32px 48px;
      background: #fefce8;
    }
    .page--image-top__text {
      margin: 0;
      font-size: 28px;
      line-height: 1.6;
      color: #1c1917;
    }
  </style>

  <img
    class="page--image-top__illustration"
    src="{{illustrationUrl}}"
    alt="{{illustrationPrompt}}"
  />
  <div class="page--image-top__text-block">
    <p class="page--image-top__text">{{text}}</p>
  </div>
</section>
```

- [ ] **Write `image-bottom.html`**

```html
<!-- backend/src/pdf/page-templates/image-bottom.html -->
<!-- Template: image-bottom — text above + landscape illustration below -->
<!-- Slots: {{text}}, {{illustrationUrl}}, {{illustrationPrompt}} -->
<section class="page page--image-bottom">
  <style>
    .page--image-bottom {
      display: flex;
      flex-direction: column;
      width: 874px;
      height: 1240px;
      font-family: inherit;
    }
    .page--image-bottom__text-block {
      flex: 1;
      display: flex;
      align-items: center;
      padding: 40px 48px;
      background: #fefce8;
    }
    .page--image-bottom__text {
      margin: 0;
      font-size: 28px;
      line-height: 1.6;
      color: #1c1917;
    }
    .page--image-bottom__illustration {
      width: 100%;
      height: 55%;
      object-fit: cover;
      flex-shrink: 0;
    }
  </style>

  <div class="page--image-bottom__text-block">
    <p class="page--image-bottom__text">{{text}}</p>
  </div>
  <img
    class="page--image-bottom__illustration"
    src="{{illustrationUrl}}"
    alt="{{illustrationPrompt}}"
  />
</section>
```

- [ ] **Write `image-left.html`**

```html
<!-- backend/src/pdf/page-templates/image-left.html -->
<!-- Template: image-left — square illustration left + text right (50/50 split) -->
<!-- Slots: {{illustrationUrl}}, {{illustrationPrompt}}, {{text}} -->
<section class="page page--image-left">
  <style>
    .page--image-left {
      display: flex;
      flex-direction: row;
      width: 874px;
      height: 1240px;
      font-family: inherit;
    }
    .page--image-left__illustration {
      width: 50%;
      height: 100%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .page--image-left__text-block {
      flex: 1;
      display: flex;
      align-items: center;
      padding: 48px 40px;
      background: #fefce8;
    }
    .page--image-left__text {
      margin: 0;
      font-size: 26px;
      line-height: 1.7;
      color: #1c1917;
    }
  </style>

  <img
    class="page--image-left__illustration"
    src="{{illustrationUrl}}"
    alt="{{illustrationPrompt}}"
  />
  <div class="page--image-left__text-block">
    <p class="page--image-left__text">{{text}}</p>
  </div>
</section>
```

- [ ] **Write `text-focus.html`**

```html
<!-- backend/src/pdf/page-templates/text-focus.html -->
<!-- Template: text-focus — large text block (top 2/3) + small illustration (bottom 1/3) -->
<!-- For ages 7–8. Slots: {{text}}, {{illustrationUrl}}, {{illustrationPrompt}} -->
<section class="page page--text-focus">
  <style>
    .page--text-focus {
      display: flex;
      flex-direction: column;
      width: 874px;
      height: 1240px;
      background: #fefce8;
      font-family: inherit;
    }
    .page--text-focus__text-block {
      flex: 2;
      display: flex;
      align-items: center;
      padding: 56px 64px 32px;
    }
    .page--text-focus__text {
      margin: 0;
      font-size: 24px;
      line-height: 1.8;
      color: #1c1917;
    }
    .page--text-focus__illustration-block {
      flex: 1;
      padding: 0 64px 40px;
    }
    .page--text-focus__illustration {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 12px;
    }
  </style>

  <div class="page--text-focus__text-block">
    <p class="page--text-focus__text">{{text}}</p>
  </div>
  <div class="page--text-focus__illustration-block">
    <img
      class="page--text-focus__illustration"
      src="{{illustrationUrl}}"
      alt="{{illustrationPrompt}}"
    />
  </div>
</section>
```

- [ ] **Write `final.html`**

```html
<!-- backend/src/pdf/page-templates/final.html -->
<!-- Template: final — moral text + discussion questions + portrait illustration -->
<!-- Slots: {{text}}, {{discussionQuestionsHtml}}, {{illustrationUrl}}, {{illustrationPrompt}} -->
<section class="page page--final">
  <style>
    .page--final {
      display: flex;
      flex-direction: row;
      width: 874px;
      height: 1240px;
      font-family: inherit;
    }
    .page--final__content {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 48px 40px 48px 48px;
      background: #fefce8;
      overflow: hidden;
    }
    .page--final__moral {
      margin: 0 0 32px;
      font-size: 24px;
      font-weight: 600;
      line-height: 1.5;
      color: #1c1917;
    }
    .page--final__questions-label {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 700;
      color: #78350f;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .page--final__questions {
      margin: 0;
      padding-left: 20px;
      font-size: 18px;
      line-height: 1.7;
      color: #292524;
    }
    .page--final__questions li {
      margin-bottom: 12px;
    }
    .page--final__illustration {
      width: 38%;
      height: 100%;
      object-fit: cover;
      flex-shrink: 0;
    }
  </style>

  <div class="page--final__content">
    <p class="page--final__moral">{{text}}</p>
    <p class="page--final__questions-label">Вопросы для обсуждения</p>
    <ol class="page--final__questions">
      {{discussionQuestionsHtml}}
    </ol>
  </div>
  <img
    class="page--final__illustration"
    src="{{illustrationUrl}}"
    alt="{{illustrationPrompt}}"
  />
</section>
```

- [ ] **Delete the `.gitkeep` placeholder**

```bash
rm backend/src/ai/prompts/.gitkeep
```

- [ ] **Commit the HTML stubs**

```bash
git add backend/src/pdf/page-templates/*.html
git commit -m "feat(pdf): add 6 HTML page template stubs with scoped CSS"
```

---

## Task 6: Story-generator prompt builder

**Files:**
- Create: `backend/src/ai/prompts/story-generator.prompt.ts`

This file is consumed by Issue #11 (StoryGeneratorService). For #60, we build the template-aware user-prompt builder — the function that tells the LLM what templates are available and how to compose a valid book.

- [ ] **Write `story-generator.prompt.ts`**

```typescript
// backend/src/ai/prompts/story-generator.prompt.ts

import { PAGE_TEMPLATES, TEMPLATE_NAMES, TemplateName } from '../../pdf/page-templates/page-templates.config';

// ─── System prompt ───────────────────────────────────────────────────────────

/**
 * STORY_SYSTEM_PROMPT — role definition and hard rules for story generation.
 *
 * Deliberately concise: detailed per-request constraints (vocabulary, templates,
 * text limits) go into the user prompt so they can be updated per-call.
 */
export const STORY_SYSTEM_PROMPT = `
You are a professional author of children's books in Russian.
Your task is to generate a structured, age-appropriate, educational story
in valid JSON that exactly matches the provided schema.

Hard rules:
1. Write ENTIRELY in Russian. Every word must be Russian.
2. Use ONLY vocabulary from the provided allowed-words list plus common
   function words (prepositions, conjunctions, pronouns, particles).
   Any word outside the list is a violation.
3. The protagonist's name MUST match the child's name provided in the prompt.
4. The narrative arc MUST follow: setup → conflict → lesson → resolution,
   encoded in the order of pages.
5. Each page MUST use exactly one template from the provided catalogue.
6. Text and title lengths MUST NOT exceed the limits shown for each template.
7. The first page MUST use the 'cover' template.
8. The last page MUST use the 'final' template.
9. DALL-E illustration prompts MUST be in English (DALL-E performs better
   with English prompts). All other fields are Russian.
`.trim();

// ─── Template catalogue builder ───────────────────────────────────────────────

/**
 * Build the template catalogue section of the user prompt,
 * filtered to templates suitable for the given child age.
 */
const buildTemplateCatalogue = (childAge: number): string => {
  const lines: string[] = ['Available page templates (use ONLY these):'];

  TEMPLATE_NAMES.forEach((name: TemplateName) => {
    const config = PAGE_TEMPLATES[name];
    if (!config.suitableFor.includes(childAge)) return;

    const limits: string[] = [];
    if (config.maxChars.title !== undefined) {
      limits.push(`title max ${config.maxChars.title} chars`);
    }
    if (config.maxChars.text !== undefined) {
      limits.push(`text max ${config.maxChars.text} chars`);
    }
    const limitStr = limits.length > 0 ? ` — ${limits.join(', ')}` : '';
    lines.push(`  • ${name}${limitStr}`);
  });

  return lines.join('\n');
};

// ─── User prompt ─────────────────────────────────────────────────────────────

export interface BuildStoryPromptOptions {
  childName: string;
  childAge: number;
  topic: string;
  learningGoal: string;
  /** Words from VocabularyRagService — the allowed vocabulary for this age/topic. */
  allowedWords: readonly string[];
  /**
   * Regeneration feedback from the previous failed attempt.
   * Undefined on the first attempt.
   */
  feedback?: string;
}

/**
 * buildStoryUserPrompt — constructs the user-turn message for story generation.
 *
 * Includes:
 * - Child profile (name, age, topic, learning goal)
 * - Template catalogue filtered to age-appropriate layouts
 * - Allowed vocabulary word list
 * - Regeneration feedback (if retrying)
 *
 * The system prompt sets role + hard rules; this prompt provides per-call data.
 */
export const buildStoryUserPrompt = ({
  childName,
  childAge,
  topic,
  learningGoal,
  allowedWords,
  feedback,
}: BuildStoryPromptOptions): string => {
  const catalogue = buildTemplateCatalogue(childAge);
  const wordList = allowedWords.join(', ');

  const feedbackSection = feedback
    ? `\nREGENERATION FEEDBACK (fix these issues):\n${feedback}\n`
    : '';

  return `
Generate a personalised children's book in Russian for the following child:
  Name: ${childName}
  Age: ${childAge}
  Topic: ${topic}
  Learning goal: ${learningGoal}

${catalogue}

Book structure requirements:
  • Minimum 6 pages, maximum 12 pages.
  • Page 1: 'cover' (title only — no text body on the cover).
  • Pages 2–(N-1): content pages using age-appropriate templates.
    Encode the narrative arc across these pages:
    first pages = setup (introduce protagonist and world),
    middle pages = conflict (challenge arises, protagonist struggles),
    later pages = lesson (protagonist learns and applies the learning goal),
    final content pages = resolution (story resolves, lesson reinforced).
  • Last page: 'final' (moral summary + discussion questions placed separately
    in the 'discussionQuestions' field).

Allowed vocabulary (Russian words — use PRIMARILY these):
${wordList}

For each page's illustrationPrompt: write a vivid, detailed DALL-E 3 prompt
in English. Include art style ("watercolour illustration, children's book style"),
the scene, characters, mood, and colours. Keep prompts under 200 characters.
${feedbackSection}
`.trim();
};

// ─── Regeneration feedback builder ───────────────────────────────────────────

export interface JudgeFeedback {
  reasoning: string;
  finalScore: number;
}

/**
 * buildRegenerationFeedback — formats why the previous attempt failed.
 *
 * Used as the `feedback` parameter in the next call to buildStoryUserPrompt.
 * Keeps the message short so it fits comfortably in the context window.
 */
export const buildRegenerationFeedback = (
  outOfCorpus: readonly string[],
  judge?: JudgeFeedback,
): string => {
  const parts: string[] = [];

  if (outOfCorpus.length > 0) {
    const sample = outOfCorpus.slice(0, 10).join(', ');
    const more = outOfCorpus.length > 10 ? ` and ${outOfCorpus.length - 10} more` : '';
    parts.push(
      `Vocabulary violation: the following words are NOT in the allowed list: ${sample}${more}.` +
        ` Use synonyms from the allowed vocabulary.`,
    );
  }

  if (judge) {
    parts.push(
      `Quality score: ${judge.finalScore.toFixed(1)}/10.` +
        ` Judge feedback: ${judge.reasoning}` +
        ` Address the feedback above to raise the score above the required threshold.`,
    );
  }

  return parts.join('\n\n');
};
```

- [ ] **Run type-check to verify imports are clean**

```bash
cd backend
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Run all tests**

```bash
cd backend
pnpm test --silent
```

Expected: all tests pass (existing + new BookPlanValidator tests).

- [ ] **Commit**

```bash
git add backend/src/ai/prompts/story-generator.prompt.ts
git commit -m "feat(ai): add story-generator prompt builder with template catalogue"
```

---

## Task 7: Full verification and PR

- [ ] **Run `./init.sh` from repo root**

```bash
cd /Users/mac/Projects/storygrow
./init.sh
```

Expected: exits 0 (tsc + lint + tests all green).

- [ ] **If lint errors, fix them**

Common issues after this PR:
- `@typescript-eslint/no-explicit-any` on the spread in `z.enum([...TEMPLATE_NAMES] as ...)` — if triggered, wrap in a named constant instead.
- Unused imports if the old `ILLUSTRATION_PROMPTS_*` constants were imported elsewhere.

Run: `pnpm --filter backend lint:fix` to auto-fix formatting.

- [ ] **Check git status is clean**

```bash
git status
```

Expected: clean (all files staged and committed).

- [ ] **Push branch and open PR**

```bash
git push -u origin issue/60-page-templates-contract
gh pr create \
  --title "feat(pdf): page templates contract — typed layouts for LLM and PDFRenderer" \
  --body "$(cat <<'EOF'
## Summary

Introduces Page Templates as a typed contract between StoryGenerator and PDFRenderer (ADR 0002).

## What changed

- **`backend/src/pdf/page-templates/page-templates.config.ts`** — typed catalogue of 6 templates with maxChars, DALL-E sizes, and age suitability lists.
- **`backend/src/pdf/page-templates/book-plan.validator.ts`** — deterministic post-generation validator (structure + text length + age suitability). Includes unit tests.
- **`backend/src/ai/schemas/story.schema.ts`** — replaces flat `illustrationPrompts[]` + `setup/conflict/lesson/resolution` with structured `pages[]` array. `PageSchema` uses template names from the config.
- **`backend/src/ai/prompts/story-generator.prompt.ts`** — `buildStoryUserPrompt` includes the age-filtered template catalogue and text limits; `buildRegenerationFeedback` formats validation failures into LLM feedback.
- **6 HTML template stubs** with scoped CSS and `{{slot}}` placeholders (fleshed out in #17).

## Definition of Done

- [x] `page-templates.config.ts` with all 6 templates, fully typed
- [x] `StorySchema` updated to `pages[]` replacing `illustrationPrompts[]`
- [x] `BookPlanValidator` with unit tests
- [x] 6 HTML template stubs with scoped CSS
- [x] `buildStoryUserPrompt` updated to include template constraints
- [x] `./init.sh` exits 0

Closes #60
EOF
)"
```

- [ ] **Merge after CI is green**

```bash
gh pr merge --squash --delete-branch
```

---

## Self-Review: Spec Coverage

| Requirement (Issue #60) | Task covering it |
|-------------------------|-----------------|
| `page-templates.config.ts` with all 6 templates, fully typed | Task 2 |
| `StorySchema` updated to `pages[]` replacing `illustrationPrompts[]` | Task 4 |
| `BookPlanValidator` with unit tests | Task 3 |
| 6 HTML template stubs with scoped CSS | Task 5 |
| `buildStoryUserPrompt` updated with template constraints | Task 6 |
| `./init.sh` exits 0 | Task 7 |
| ADR 0002: DALL-E size mapping per template | Task 2 (`dalleSize` in `ImageSlot`) |
| ADR 0002: CSS scoped per template (`.page--{name}`) | Task 5 (all HTML stubs) |
| ADR 0002: A5 physical dimensions as canvas size | Task 5 (874×1240 px in stubs) |
| ADR 0002: `text-focus` not for ages 5–6 | Task 2 (`suitableFor: [7, 8]`) + Task 3 (test) |
| ADR 0002: single config file for all three consumers | Task 2–6 (all import from config) |

No gaps found.
