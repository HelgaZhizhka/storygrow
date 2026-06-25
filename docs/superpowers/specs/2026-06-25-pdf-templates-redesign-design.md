# PDF page templates — Claude Design redesign + Cyrillic book fonts

**Issue:** #179
**Date:** 2026-06-25
**Depends on:** the PDF rendering pipeline (`backend/src/pdf/`), #174 (illustrations carry no baked text)

## Problem

The PDF renderer (`PdfRenderService`) still uses the original six page-template
HTML files. The Claude Design handoff shipped redesigned "magic publishing"
versions (cream paper, indigo ink, sparkle ornaments, a full-bleed cover with a
gradient curtain, a final page with numbered discussion-question circles). They
are **drop-in replacements** — verified: same six files, same five
`{{placeholders}}`, same A5 size (874×1240 px), same class structure — so the
renderer's substitution logic and `page-templates.config.ts` do not change.

The one real adaptation: the design templates use **Bricolage Grotesque +
Outfit**, which have **no Cyrillic**, but the book content is Russian. As in the
frontend redesign (#164), the fonts must be swapped for Cyrillic-capable ones.

## Goal

Adopt the six redesigned templates, rendering Russian text in a Cyrillic book
font pairing, with fonts **self-hosted** (embedded, no network fetch at render
time) for reliable offline rendering during the defense demo.

## Decisions (from brainstorming)

1. **Font pairing:** a print/book pairing distinct from the app UI —
   **Comfortaa** (display/headings) + **Literata** (body). Both have full
   Cyrillic and are on Google Fonts.
2. **Font delivery:** **self-hosted** — download the needed weights' Cyrillic
   woff2, embed as base64 `@font-face`. No `@import`, no network dependency at
   Puppeteer render time. (The README also recommends this.)
3. **Injection point:** the `@font-face` block is added **once** in
   `PdfRenderService.buildDocument()`'s `<head>` `<style>` — not duplicated
   across the six templates. Templates keep only
   `font-family: 'Comfortaa' | 'Literata'`.

## Scope

In scope:
- Replace the six template HTML files with the design versions, with the
  per-template `@import` removed and `font-family` pointing at Comfortaa /
  Literata.
- Add the Cyrillic woff2 font files and embed them via `@font-face` in
  `buildDocument()`.

Out of scope (unchanged): `page-templates.config.ts`, the placeholder
substitution, `StorySchema`, which templates the LLM picks, the Puppeteer
render settings.

## Components

### 1. Fonts (`backend/src/pdf/page-templates/fonts/`)

- `comfortaa-500.woff2`, `comfortaa-700.woff2` — headings (titles, cover,
  eyebrows, moral, question numbers).
- `literata-400.woff2`, `literata-600.woff2` — body text + emphasis.
- Each subset to **Cyrillic + Latin** (the Google Fonts gstatic Cyrillic subset)
  to keep size down (~20–40 KB each; ~150–200 KB total once base64-embedded).
- Obtained one-time from Google Fonts (the gstatic woff2 the CSS API serves for
  the Cyrillic `unicode-range`). Committed to the repo so the build is offline.

### 2. Renderer (`backend/src/pdf/pdf-render.service.ts`)

- At service init, read the four woff2 files and build a `FONT_FACE_CSS` string:
  one `@font-face` per file using `src: url(data:font/woff2;base64,…) format('woff2')`
  with the right `font-family` / `font-weight`.
- In `buildDocument()`, inject `FONT_FACE_CSS` into the `<head>` `<style>` (before
  the existing rules). Update the base `html, body { font-family }` fallback to
  `'Literata', serif` so any unstyled text still uses the book body font.
- `waitUntil: 'networkidle0'` stays — illustrations are still remote signed URLs
  that must load; fonts no longer add a network wait.

### 3. Templates (`backend/src/pdf/page-templates/*.html`)

Replace all six (`cover`, `image-top`, `image-bottom`, `image-left`,
`text-focus`, `final`) with the Claude Design versions from the handoff bundle,
edited only to:
- remove the `@import url('https://fonts.googleapis.com/...')` line;
- keep `font-family: 'Comfortaa'` (display elements) and `'Literata'` (body).

The hardcoded decorative text in the design templates (wordmark "StoryGrow",
eyebrow "Волшебная история", sparkle ornaments) stays as-is — it is not a
placeholder and needs no data.

## Data flow (unchanged except fonts)

```
story page → PdfRenderService.renderPage()
  → pick template HTML (now the redesigned one)
  → replaceAll {{title}} {{text}} {{illustrationUrl}} {{illustrationPrompt}} {{discussionQuestionsHtml}}
buildDocument() wraps pages + injects @font-face(base64 woff2) once in <head>
  → Puppeteer setContent(networkidle0) → PDF (Comfortaa/Literata render from embedded fonts)
```

## Error handling / risks

- **Missing/again-Latin font:** if a woff2 is absent at init, fail fast with a
  clear error (the renderer can't produce correct PDFs without the embedded
  fonts) rather than silently falling back to Helvetica.
- **Size:** base64 fonts add ~150–200 KB to every rendered document's HTML; this
  is in-memory only (not the PDF size) and acceptable.
- **Cover text:** illustrations are already text-free (#174 rule 11); the cover
  title comes from the template's `{{title}}` overlay.

## Testing

- **Unit (`pdf-render.service.spec.ts` or new):** `buildDocument()` output
  contains an `@font-face` for each weight with `font-family: 'Comfortaa'` /
  `'Literata'` and a `data:font/woff2;base64,` src; and contains no
  `fonts.googleapis.com` `@import`. A guard test: each of the six template files
  contains `font-family` referencing only Comfortaa/Literata and no `@import`.
- **Manual e2e:** generate (or reuse) a ready book, download its PDF, and
  confirm: Russian text renders in Comfortaa/Literata (not a fallback), all six
  layouts match the design (full-bleed cover + gradient curtain + wordmark/
  eyebrow; final page moral + numbered question circles; the three image
  templates), and rendering works with no outbound font request (e.g. offline).

## Files touched

- Replace: `backend/src/pdf/page-templates/{cover,image-top,image-bottom,image-left,text-focus,final}.html`.
- Add: `backend/src/pdf/page-templates/fonts/{comfortaa-500,comfortaa-700,literata-400,literata-600}.woff2`.
- Modify: `backend/src/pdf/pdf-render.service.ts` (build + inject `@font-face`; body fallback font).
- Add/extend: `backend/src/pdf/pdf-render.service.spec.ts`.
