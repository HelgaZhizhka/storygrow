---
status: Accepted
date: 2026-05-26
---

# ADR 0002 — Page Templates as LLM–PDF contract

## Context

StoryGrow generates personalised children's books and renders them as PDFs. The AI pipeline produces a story (text + illustration prompts) and then passes it to a PDF renderer (Puppeteer).

Without a typed layout contract, the LLM has no knowledge of the physical constraints of the page:

- How much text fits next to an illustration on an A5 page?
- What aspect ratio should DALL-E use for a full-width image vs a side image?
- How many pages should a book for a 5-year-old have vs an 8-year-old?

Without answers baked into the system, the LLM generates text that may not fit, requests images of the wrong shape, and the PDF renderer receives structurally ambiguous data. These problems surface late — only during PDF rendering — and are expensive to fix retroactively.

A second observation, drawn from analysing the course reference project (storycraft/stream2): the pedagogical value of text vs illustration shifts with age. For 5–6-year-olds the ratio is roughly 70/30 in favour of illustration; for 7–8-year-olds it is closer to 50/50. A single fixed story structure cannot serve both age groups well. Page-level layout must be age-aware.

## Decision

Introduce **Page Templates** as a typed contract between the story generator and the PDF renderer. A page template is a named layout with fixed physical constraints. The LLM is told which templates exist and must compose the book from those templates — it cannot invent layouts.

### 1. Template catalogue — `backend/src/pdf/page-templates/page-templates.config.ts`

Each template entry defines:

```typescript
interface PageTemplateConfig {
  htmlFile: string;          // filename under backend/src/pdf/page-templates/
  maxChars: { text?: number; title?: number };  // enforced by validator + prompt
  images: Array<{
    slot: string;            // slot name (e.g. "main", "illustration")
    aspect: 'portrait' | 'landscape' | 'square';
    dalleSize: '1024x1024' | '1024x1792' | '1792x1024';
  }>;
  suitableFor: number[];     // child ages this template is designed for
}
```

Initial set of templates:

| Template | Description | Max text | Images | Ages |
|---|---|---|---|---|
| `cover` | Title + full-page illustration | title: 60 chars | 1 portrait | 5–8 |
| `image-top` | Illustration (60% height) + text below | 120 chars | 1 landscape | 5–6 |
| `image-bottom` | Text above + illustration below | 120 chars | 1 landscape | 5–6 |
| `image-left` | Illustration left + text right | 200 chars | 1 square | 6–8 |
| `text-focus` | Large text block + small illustration | 350 chars | 1 square | 7–8 |
| `final` | Moral + discussion questions + illustration | 200 chars | 1 portrait | 5–8 |

The `text-focus` template is intentionally absent for ages 5–6: for younger children, an image-heavy layout is pedagogically more effective.

### 2. Extend `StorySchema`

Replace the current `illustrationPrompts: string[]` with a structured `pages` array:

```typescript
const PageSchema = z.object({
  template: z.enum(['cover', 'image-top', 'image-bottom', 'image-left', 'text-focus', 'final']),
  text: z.string().optional(),         // validated against template.maxChars.text
  title: z.string().optional(),        // validated against template.maxChars.title
  illustrationPrompt: z.string(),      // passed to DALL-E with the template's dalleSize
});

// StorySchema gains:
pages: z.array(PageSchema).min(6).max(12),
// replaces: illustrationPrompts, setup/conflict/lesson/resolution are now in pages
```

The pedagogical narrative structure (setup → conflict → lesson → resolution) is encoded in the **order and template selection** of pages, not as separate top-level fields.

### 3. One source of truth — three consumers

`page-templates.config.ts` is read by all three stages:

1. **StoryGenerator prompt builder** — describes available templates and their text limits to the LLM so it can make valid choices.
2. **BookPlan validator** — checks that the LLM's page list uses real template names, respects `maxChars`, uses correct `dalleSize` per template slot.
3. **PDFRenderer** — resolves the HTML file by template name and passes text + image URL into it.

### 4. HTML as source, PDF as derivative

The book exists as a composed HTML document (one `<section class="page page--{template}">` per page, scoped CSS). PDF is generated from that HTML by Puppeteer on demand.

Consequences:
- The HTML can be previewed in a browser without a PDF render.
- Iterating on layout means changing HTML/CSS — not the rendering logic.
- Future: the HTML could be served as a web-readable version of the book.

CSS must be **scoped per template** (all rules under `.page--{template}`) to avoid cascade conflicts when pages are composed into one document.

### 5. Physical sizing from A5 + 300 DPI

All slot dimensions are derived from the page size, not from AI model presets:

- Page: A5 = 148 × 210 mm
- Target: 150 DPI (web-quality print; 300 DPI would require an upscaler, out of scope for MVP)
- At 150 DPI: ~874 × 1240 px canvas

DALL-E 3 available sizes and their mapping:
| DALL-E size | Aspect | Use |
|---|---|---|
| `1024x1024` | square | `image-left` slot, `final` illustration |
| `1792x1024` | landscape | `image-top`, `image-bottom` slots |
| `1024x1792` | portrait | `cover` main illustration |

True 300 DPI print quality would require upscaling (e.g. Real-ESRGAN). This is **out of scope for the MVP** — the current output is suitable for digital use and home printing. Noted as a post-MVP improvement.

## Consequences

**Positive:**
- LLM cannot produce a layout the PDF renderer cannot handle — the contract is enforced at validation time, before rendering.
- Image aspect ratios are correct by construction — no resizing hacks in the renderer.
- Age-appropriate layouts are enforced by template selection rules, not by prompting alone.
- CSS scoping prevents cascade conflicts as the template catalogue grows.
- Single config file to update when adding a new template.

**Negative / trade-offs:**
- StorySchema becomes more complex — `pages` array replaces flat story fields.
- The pedagogical narrative structure (setup/conflict/lesson/resolution) is implicit in page order rather than explicit top-level fields; the LLM prompt must make this clear.
- Template catalogue must be maintained as the product evolves (new age groups, new layouts).

## Alternatives considered

**A. Keep flat `illustrationPrompts: string[]`, handle sizing in the renderer.**
Rejected — the renderer cannot know what aspect ratio the prompt was intended for, leading to either stretching or cropping. The LLM also has no guidance on text length per page.

**B. Let the LLM freely describe the page layout in prose.**
Rejected — unstructured layout descriptions cannot be reliably parsed or validated. The contract must be machine-readable.

**C. Generate text and images separately, assemble in the renderer with a fixed single template.**
Rejected — a single layout cannot serve both 5-year-olds (image-heavy) and 8-year-olds (text-heavier). The product differentiation depends on age-aware layouts.

## Related

- [ADR 0001 — Git workflow](./0001-git-workflow.md)
- Spec: [2026-05-26-story-generator-controlled.md](../superpowers/specs/2026-05-26-story-generator-controlled.md) — StoryGenerator must be updated to produce `pages[]` not `illustrationPrompts[]`
- GitHub issue: to be created as `issue/N-page-templates-contract`
