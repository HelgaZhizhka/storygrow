# PDF Templates Redesign + Cyrillic Book Fonts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render books with the Claude Design "magic publishing" PDF templates, in a self-hosted Cyrillic book-font pairing (Comfortaa headings + Literata body), with zero network font fetch at render time.

**Architecture:** The six redesigned template HTML files are drop-in (same five `{{placeholders}}`, same A5 size, same classes) — only their fonts change. A one-off script fetches the needed woff2 and writes a self-contained `fonts.css` (base64-inlined `@font-face`). `PdfRenderService.buildDocument()` injects that CSS once into the document `<head>`. The renderer's substitution logic and `page-templates.config.ts` are unchanged.

**Tech Stack:** NestJS, Puppeteer, TypeScript, Jest. Fonts from Google Fonts (Comfortaa, Literata), inlined as base64 woff2.

## Global Constraints

- No `any` — explicit types / `unknown` + guards.
- `pnpm` only; files ≤ 400 lines; functions ≤ 30 lines / ≤ 3 params; no `console.log` in committed code (a one-off script may use `process.stdout.write` and `console.error` in its catch, matching `gen-style-previews.ts`).
- One-off scripts in `backend/src/scripts/` must be CommonJS-compatible: use `__dirname`, never `import.meta` (the backend compiles to CJS; `init.sh` runs `tsc`).
- Tests are Jest: `pnpm --filter backend test -- <pattern>`.
- Renderer/config/StorySchema/template selection are OUT of scope — do not change them beyond the `@font-face` injection and body fallback font.
- The redesigned template source lives in the repo at `docs/design-handoff/pdf-templates/*.html` (committed alongside this plan).
- Conventional Commits for every commit.

---

### Task 1: Generate the self-contained book-font CSS

**Files:**
- Create: `backend/src/scripts/gen-pdf-fonts.ts`
- Create (generated, committed): `backend/src/pdf/page-templates/fonts.css`

**Interfaces:**
- Produces: `backend/src/pdf/page-templates/fonts.css` — a CSS file with `@font-face` rules for `font-family: 'Comfortaa'` (500, 700) and `'Literata'` (400, 600), each `src: url(data:font/woff2;base64,…) format('woff2')` with the Google Fonts `unicode-range` subsets, and NO `fonts.googleapis.com` / `fonts.gstatic.com` URLs.

- [ ] **Step 1: Write the generator script**

```ts
// backend/src/scripts/gen-pdf-fonts.ts
/**
 * One-off: build a self-contained @font-face CSS (base64-inlined woff2) for the
 * PDF book fonts — Comfortaa (headings) + Literata (body) — so Puppeteer renders
 * Cyrillic with no network fetch. Writes page-templates/fonts.css.
 *
 * Run: pnpm --filter backend exec tsx src/scripts/gen-pdf-fonts.ts
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Comfortaa:wght@500;700&family=Literata:wght@400;600&display=swap';
// Google Fonts serves woff2 (not ttf) only to browser-like UAs.
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const OUT = resolve(__dirname, '../pdf/page-templates/fonts.css');

const main = async (): Promise<void> => {
  const css = await fetch(CSS_URL, { headers: { 'User-Agent': UA } }).then((r) => r.text());
  const urls = [
    ...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g),
  ].map((m) => m[1]);
  let out = css;
  for (const url of urls) {
    const buf = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
    out = out.replace(url, `data:font/woff2;base64,${buf.toString('base64')}`);
  }
  await writeFile(OUT, out, 'utf-8');
  process.stdout.write(`wrote ${OUT} — ${urls.length} woff2 inlined\n`);
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run it to generate `fonts.css`**

Run: `pnpm --filter backend exec tsx src/scripts/gen-pdf-fonts.ts`
Expected: `wrote …/page-templates/fonts.css — N woff2 inlined` (N is typically 12–16: 4 weights × the cyrillic/cyrillic-ext/latin/latin-ext subsets). Needs network (one-time).

- [ ] **Step 3: Sanity-check the generated file**

Run: `grep -c "data:font/woff2;base64," backend/src/pdf/page-templates/fonts.css; grep -c "gstatic\|googleapis" backend/src/pdf/page-templates/fonts.css; grep -oE "font-family: '[^']+'" backend/src/pdf/page-templates/fonts.css | sort -u`
Expected: first count ≥ 8; second count `0`; families listed are exactly `'Comfortaa'` and `'Literata'`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/scripts/gen-pdf-fonts.ts backend/src/pdf/page-templates/fonts.css
git commit -m "feat(pdf): generate self-contained Cyrillic book-font CSS (Comfortaa + Literata)"
```

---

### Task 2: Inject the fonts into the rendered document

**Files:**
- Modify: `backend/src/pdf/pdf-render.service.ts`
- Modify: `backend/nest-cli.json` (so the production build copies `fonts.css` to `dist`, like it already copies the `*.html` templates)
- Test: `backend/src/pdf/pdf-render.service.spec.ts`

**Interfaces:**
- Consumes: `backend/src/pdf/page-templates/fonts.css` (Task 1).
- Produces: `buildDocument()` output now begins its `<head>` `<style>` with the `fonts.css` content and uses `'Literata'` as the base body fallback.

- [ ] **Step 1: Write the failing test**

Add to `backend/src/pdf/pdf-render.service.spec.ts` (it already constructs the service and calls render; if it doesn't expose `buildDocument`, test through the public render path that returns/serves HTML — otherwise call the private method via a thin spy). Minimal direct test:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

it('embeds the self-hosted book fonts and no remote font import', () => {
  const css = readFileSync(
    join(__dirname, 'page-templates', 'fonts.css'),
    'utf-8',
  );
  expect(css).toContain('data:font/woff2;base64,');
  expect(css).toContain("font-family: 'Comfortaa'");
  expect(css).toContain("font-family: 'Literata'");
  expect(css).not.toContain('fonts.googleapis.com');
});
```

> If `pdf-render.service.spec.ts` has a test that renders a document and asserts on the HTML string, also assert that the produced `<head>` contains `@font-face` and `font-family: 'Literata'` in the body rule, and does NOT contain `'Helvetica'` as the body default. Use the existing test's render call; do not add Puppeteer to the unit test.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- pdf-render.service.spec`
Expected: the new render-HTML assertion fails (body still says `'Helvetica'`, no `@font-face`). The fonts.css-content test passes already (Task 1 produced it) — that one guards the asset.

- [ ] **Step 3: Implement the injection**

In `pdf-render.service.ts`, near where templates are read (the field `templates` and `TEMPLATES_DIR`), add a cached font CSS field:

```ts
private readonly fontFaceCss = readFileSync(join(TEMPLATES_DIR, 'fonts.css'), 'utf-8');
```

In `buildDocument()`, change the `<style>` block from:

```ts
<style>
  @page { size: ${A5_WIDTH_PX}px ${A5_HEIGHT_PX}px; margin: 0; }
  html, body { margin: 0; padding: 0; font-family: 'Helvetica', 'Arial', sans-serif; }
  .page { page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
</style>
```

to:

```ts
<style>
${this.fontFaceCss}
  @page { size: ${A5_WIDTH_PX}px ${A5_HEIGHT_PX}px; margin: 0; }
  html, body { margin: 0; padding: 0; font-family: 'Literata', Georgia, serif; }
  .page { page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
</style>
```

(`readFileSync` and `join` are already imported in this file. If `fontFaceCss` is read as a field initializer, a missing `fonts.css` throws at construction — the desired fail-fast.)

Also update `backend/nest-cli.json` so the build copies the new CSS asset. Change the `assets` array from:

```json
"assets": [{ "include": "pdf/page-templates/*.html" }],
```

to:

```json
"assets": [
  { "include": "pdf/page-templates/*.html" },
  { "include": "pdf/page-templates/*.css" }
],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter backend test -- pdf-render.service.spec`
Expected: PASS. Then `pnpm --filter backend exec tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/pdf/pdf-render.service.ts backend/src/pdf/pdf-render.service.spec.ts backend/nest-cli.json
git commit -m "feat(pdf): embed book fonts once in buildDocument; Literata body fallback"
```

---

### Task 3: Replace the six page templates with the redesigned versions

**Files:**
- Replace: `backend/src/pdf/page-templates/cover.html`
- Replace: `backend/src/pdf/page-templates/image-top.html`
- Replace: `backend/src/pdf/page-templates/image-bottom.html`
- Replace: `backend/src/pdf/page-templates/image-left.html`
- Replace: `backend/src/pdf/page-templates/text-focus.html`
- Replace: `backend/src/pdf/page-templates/final.html`
- Test: `backend/src/pdf/page-templates.templates.spec.ts` (create)

**Interfaces:**
- Consumes: the redesigned source at `docs/design-handoff/pdf-templates/*.html`; the fonts from Task 2 (`'Comfortaa'`, `'Literata'`).
- Produces: six templates that contain no `@import` and reference only `'Comfortaa'` / `'Literata'`, keeping all five placeholders.

- [ ] **Step 1: Write the failing guard test**

```ts
// backend/src/pdf/page-templates.templates.spec.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, 'page-templates');
const NAMES = ['cover', 'image-top', 'image-bottom', 'image-left', 'text-focus', 'final'];

describe.each(NAMES)('template %s', (name) => {
  const html = readFileSync(join(DIR, `${name}.html`), 'utf-8');

  it('has no remote font import', () => {
    expect(html).not.toContain('@import');
    expect(html).not.toContain('fonts.googleapis.com');
  });

  it('uses only the book fonts', () => {
    expect(html).not.toContain('Bricolage Grotesque');
    expect(html).not.toContain('Outfit');
    expect(/font-family:\s*'(Comfortaa|Literata)'/.test(html)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- page-templates.templates.spec`
Expected: FAIL — the current templates either lack the book fonts or (after copying the design source) still contain `@import` / `Bricolage Grotesque` / `Outfit`.

- [ ] **Step 3: Replace each template and remap its fonts**

For EACH of the six names, copy the redesigned source over the live template, then in the copied file delete the `@import` line and remap the two font families:

```bash
cd backend/src/pdf/page-templates
for f in cover image-top image-bottom image-left text-focus final; do
  cp ../../../../docs/design-handoff/pdf-templates/$f.html ./$f.html
  # remove the Google Fonts @import line
  perl -0pi -e "s/\\s*\\\@import url\\('https:\\/\\/fonts\\.googleapis\\.com[^;]*\\);//g" ./$f.html
  # remap fonts to the Cyrillic book pairing
  perl -pi -e "s/'Bricolage Grotesque'/'Comfortaa'/g; s/'Outfit'/'Literata'/g" ./$f.html
done
cd -
```

(After running, open `final.html` and `cover.html` to confirm the `@import` line is gone and `font-family` reads `'Comfortaa'` / `'Literata'`. The placeholders `{{title}}`, `{{text}}`, `{{illustrationUrl}}`, `{{illustrationPrompt}}`, `{{discussionQuestionsHtml}}` and the `class="page page--…"` wrappers must remain intact.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter backend test -- page-templates.templates.spec`
Expected: PASS (all 12 assertions). Then `pnpm --filter backend test` (full backend) → green, and `pnpm --filter backend exec tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/pdf/page-templates/*.html backend/src/pdf/page-templates.templates.spec.ts
git commit -m "feat(pdf): adopt Claude Design page templates (Cyrillic book fonts)"
```

---

### Task 4: Full verification + manual PDF e2e

**Files:** none (verification only).

- [ ] **Step 1: Smoke check**

Run: `./init.sh` (no `next dev` running)
Expected: backend tsc + lint + tests green; frontend green.

- [ ] **Step 2: Render a real PDF and inspect it**

With docker infra up and the backend running, open a ready book in the UI and click **Скачать PDF** (or call `GET /books/:id/pdf-url` and open the signed URL). Confirm:
- Russian text renders in **Comfortaa** (headings/title) and **Literata** (body), NOT a fallback sans;
- the **cover** is a full-bleed illustration with the gradient curtain, wordmark, and "Волшебная история" eyebrow;
- the **final** page shows the moral as an accent phrase with numbered gradient question circles;
- the three image templates (`image-top` / `image-bottom` / `image-left`) and `text-focus` match the design;
- rendering issues no outbound font request (the fonts are embedded) — e.g. it works with networking to fonts.googleapis.com blocked.

- [ ] **Step 3: If a book needs regenerating**, create one via the new-book form (any provider) and download its PDF; otherwise reuse an existing ready book.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin issue/179-pdf-templates-redesign
gh pr create --title "feat(pdf): adopt Claude Design PDF templates with self-hosted Cyrillic book fonts" --body "Closes #179"
```

---

## Notes for the implementer

- `fonts.css` is a generated artifact committed to the repo; the renderer reads it at startup and a missing file fails fast (intended).
- Do not touch `page-templates.config.ts`, the placeholder substitution, or `StorySchema`. The redesign is templates + fonts only.
- The redesigned templates hardcode decorative copy (wordmark, eyebrow, sparkles) — that is not placeholder data and needs no wiring.
