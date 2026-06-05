# Character Personalization & Illustration Style — Design

**Date:** 2026-06-05
**Status:** Approved (pending implementation plan)
**Scope:** Custom (AI) story flow only. Fast-flow is untouched.

## Problem

The custom story flow always casts the child as the protagonist, and the LLM
invents the character's appearance from name + age alone. Two consequences:

1. **No control over who the hero is.** For sensitive learning goals (tantrums,
   greed, lying), showing the actual child as the one exhibiting the behaviour
   can feel like shaming rather than teaching. A third-person "observer" story
   ("there was a boy who…") is pedagogically safer for these cases.
2. **No control over appearance or style.** The parent cannot describe how the
   child looks, and every book uses one hard-coded watercolour style.

A `characterProfile` field (English visual description, prepended to every page's
illustration prompt) was already added to `StorySchema` to keep the character
description identical across pages within a book. This design builds on that.

## Decisions

- **Protagonist mode** is a per-book choice:
  - `child` — hero is the child; the child's name is used; appearance comes from
    the child's profile (or is invented if blank).
  - `observer` — third-person story about an invented character; the child's name
    is **not** used; the child's appearance is **not** used; the LLM invents the
    proxy character (name + appearance).
- **Appearance** is free text on the `Child` entity, reusable across books. If
  blank, the LLM invents it (current behaviour). Entered inline when creating a
  new child. Editing an existing child's appearance is out of scope (there is no
  child-edit page yet).
- **Art style** is a per-book choice with five values, mapped to an image-prompt
  suffix: `watercolor` (default), `cartoon`, `storybook`, `pixel`, `realistic`.
- **Bug fix (in scope):** the child's `gender` is collected by the form today but
  never passed into generation. Wire it through so the character matches.

## Out of scope

- Photo upload + vision agent (deferred to a later round).
- Reference-image models (flux-kontext / gemini image) for true facial likeness.
- A child-edit page for updating an existing child's appearance.
- Applying art-style selection to the fast-flow.

## Known limitation

Text-based character consistency is *maximized* (identical `characterProfile`
prepended to every page) but not *guaranteed* — each image is generated
independently, so minor drift between pages is possible. True visual likeness
and perfect cross-page consistency require reference-image conditioning, which
is the deferred photo path.

## Data model

```prisma
enum ProtagonistMode {
  child
  observer
}

enum ArtStyle {
  watercolor
  cartoon
  storybook
  pixel
  realistic
}

model Child {
  // … existing fields …
  appearance String?   // free-text visual description; blank → LLM invents
}

model Book {
  // … existing fields …
  protagonistMode ProtagonistMode @default(child)
  artStyle        ArtStyle        @default(watercolor)
}
```

Migration adds the two enums plus three columns, all nullable or defaulted —
safe on existing rows.

## Generation flow (custom)

`generation.processor` reads the new fields off `book` / `book.child` and passes
them to the orchestrator, which threads them into `GenerateStoryInput`:

- `gender?` (from `Child.gender`)
- `appearance?` (from `Child.appearance`)
- `protagonistMode`
- `artStyle`

Story generation branches on `protagonistMode`:

- **child:** hero name = child name. `characterProfile` is built from
  `appearance` (if provided) plus gender and age; if `appearance` is blank, the
  LLM invents it.
- **observer:** the LLM invents a proxy character (name + appearance). The story
  is third-person ("Жил-был мальчик…"). The child's name and appearance are not
  used. `characterProfile` describes the proxy.

`artStyle` is passed to the image generator, which selects the matching suffix.

## Prompts & config

- `story-generator.prompt.ts`: add a protagonist-mode block and gender; the
  `characterProfile` instruction consumes `appearance` when present.
- `ai.config.ts`: replace the single `IMAGE_STYLE_SUFFIX` constant with a
  `STYLE_SUFFIXES: Record<ArtStyle, string>` map plus a lookup helper. Each
  value is a short English style suffix appended to every illustration prompt.
- `image-generator.service.ts`: accept `artStyle` and apply
  `STYLE_SUFFIXES[artStyle]` instead of the constant. The `characterProfile`
  prefix (already implemented) stays.

## API

- `POST /children`: accept optional `appearance`.
- `POST /books` (custom mode): accept optional `protagonistMode` and `artStyle`;
  persist on the `Book`. Defaults apply when omitted.

## UI (new-book form)

- **Inline new-child section:** add an optional "Как выглядит" textarea, saved to
  `Child.appearance` on create.
- **Custom-mode section:** a "Режим героя" radio (Ребёнок-герой / История про
  другого) and an art-style selector (Watercolor / Cartoon / Storybook / Pixel /
  Realistic). Both are relevant only in custom mode.

## Testing

- Schema/enum coverage for `ProtagonistMode` and `ArtStyle`.
- Prompt builder: child vs observer branches; gender included; appearance used
  when present and ignored in observer mode.
- Image generator: `artStyle` selects the correct suffix.
- Update existing Story fixtures (already carry `characterProfile`).
- Backend: child creation stores `appearance`; custom book creation stores
  `protagonistMode` and `artStyle`.
