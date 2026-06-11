# Public marketing screens — landing + login + pricing

**Issue:** #166
**Date:** 2026-06-11
**Depends on:** #164 (design system + authenticated app screens)

## Goal

Implement the three public-facing screens from the Claude Design handoff
prototype (`prototype/StoryGrow.html`) on the existing StoryGrow design system.
#164 already shipped the design tokens, fonts, and the authenticated app screens
(books list, new-book form, book detail). This completes the public funnel:
landing → login → pricing.

The prototype is the single source of truth for layout, spacing, and visuals.
Implementation must match it 1:1, translated from the prototype's plain
HTML/CSS into React + the `@layer components` class approach already used for
the `sg-*` app classes.

## Screens

### Landing `/` (replaces the current 16-line "под разработкой" stub)

Public marketing page, top to bottom:

1. **Sticky nav** (`PublicNav` component): wordmark (spark + "StoryGrow"),
   anchor links (Как это работает `#how`, Возможности `#features`, Тарифы
   → `/pricing`), theme toggle, "Войти" ghost button → `/login`.
2. **Hero** (two-column): eyebrow chip "Персональные книги с ИИ"; display title
   "Книги, где ваш ребёнок — *главный герой*" (gradient on "главный герой");
   subtitle; two CTAs ("Создать книгу" primary, "Смотреть тарифы" ghost);
   trust row (4.9 средняя оценка · возраст 5–8 · PDF за 1–2 мин). Right column:
   animated **3D book cover** (CSS `rotateY` transform, float keyframe, gradient
   spine, overlay title "Лучик и потерянная звезда", floating star shapes via
   `clip-path`). `prefers-reduced-motion` disables the float.
3. **Features** section (`#features`): 3 cards (persona­lization, pedagogical
   QA, keepsake PDF) with gradient icon tiles.
4. **How it works** section (`#how`, alt background with aura): 3 numbered steps.
5. **Sample spreads** section: 3 gradient placeholder page cards.
6. **CTA block**: full-width gradient card, "Создайте первую книгу сегодня",
   primary button.
7. **Footer**: wordmark + copyright line.

### Login `/login` (restyle; keep behavior)

Centered auth card (`auth-card`) on a fixed aura background (`auth-bg`):
wordmark, "Войдите в аккаунт", subtitle, full-width Google button (real OAuth,
`href={\`${API_URL}/auth/google\`}`, existing inline Google SVG), and a terms
disclaimer line. No public nav on this screen.

### Pricing `/pricing` (restyle; keep behavior)

`PublicNav` header + centered pricing head (eyebrow, title "Выберите свой план",
subtitle). Two plan cards in a `plans` grid:

- **Basic** — 299 ₽/мес, "10 книг в месяц", features: Персонализированные
  истории / PDF скачивание / Иллюстрации ИИ. Ghost "Подключить" button.
- **Premium** (`plan--featured`, glow border, "Популярный" tag) — 699 ₽/мес,
  "Безлимитные книги", Basic features + Приоритетная генерация + Ранний доступ
  к новинкам. Primary "Подключить Premium" button.

Preserve the existing Stripe flow verbatim: `handleSubscribe(plan)` posts to
`/api/stripe/subscribe`, redirects to the returned Checkout URL, and gates on
`isAuthenticated()` → `/login`. Update plan feature copy to match the prototype
("Иллюстрации ИИ", not "DALL-E").

## CTA routing (decision)

Landing CTAs ("Создать книгу", "Начать бесплатно") are auth-aware: a small
client helper checks `isAuthenticated()` and routes guest → `/login`,
authenticated → `/books/new`. "Смотреть тарифы" → `/pricing`.

## Theme toggle (decision)

A working light/dark toggle ships in `PublicNav`: sets `data-theme` on
`<html>`, persists to `localStorage` (`sg-theme`), and reflects the current
state on the button icon. Dark tokens already exist in `globals.css`. Reads the
stored value on mount to avoid a flash where practical.

## Architecture

- **Components**
  - `PublicNav` (client) — shared header for landing + pricing; wordmark, links,
    theme toggle, login button.
  - `ThemeToggle` (client) — the toggle button + localStorage logic (used inside
    `PublicNav`; small, isolated).
  - Landing is a single page composed of section markup; sub-sections kept as
    local presentational fragments if the file approaches the 400-line limit.
- **Routing** — `/`, `/login`, `/pricing` stay outside the `(app)` route group,
  so they do not get the authenticated app shell. They use `PublicNav` (except
  login) instead.

## CSS

- New marketing-only classes live in **`frontend/src/app/marketing.css`**,
  imported at the top of `globals.css` (after `@import 'tailwindcss'`) so
  Tailwind processes the `@layer components` block in the same context.
  Rationale: `globals.css` is already ~618 lines; adding ~250 lines of landing
  CSS would push it well past the project's 400-line file guideline.
- Classes ported from the prototype: `lp-nav`, `lp-nav__links`, `lp-hero`,
  `lp-hero__*`, `book-3d` (+ `__spine`, `__face`), `cover-*`, `float-star`,
  `lp-section` (+ `--alt`, `__head`), `eyebrow`, `lp-h2`, `lp-features`,
  `feature` (+ `__icon`), `lp-steps`, `step` (+ `__n`), `lp-pages`,
  `lp-page-card`, `lp-cta` (+ `__inner`), `lp-footer`, `chip`, `sg-wordmark`,
  `sg-spark` (+ `--indigo`), `h-display`, `auth-bg`, `auth-card`, `pricing-head`,
  `plans`, `plan` (+ `--featured`, `__tag`, `__name`, `__price`, `__books`,
  `__features`). The prototype's screen-router / proto-switch / appbar classes
  are NOT ported (prototype-only scaffolding).
- New tokens to add to `globals.css`: `--indigo-strong`, `--gold`, `--sh-glow`,
  `--r-2xl` (both light and dark where color-valued). `--sh-glow` replaces the
  inline fallback currently in `.sg-btn-primary`.

## Translation approach (chosen)

Port the prototype's component classes into a `@layer components` block and use
them via `className` in React — the same pattern #164 used for `sg-*`. Rejected
alternatives: (a) inline Tailwind utilities — the 3D transform, keyframes, and
`clip-path` stars become unreadable utility soup; (b) per-page CSS Modules —
diverges from the established global design-system layer and duplicates tokens.

## Out of scope

- SEO / Schema.org / OG tags (#28).
- Real book covers on the landing sample section (decorative gradients are fine).
- Deploy.

## Verification

- `pnpm --filter frontend exec tsc --noEmit` clean; `pnpm --filter frontend lint`
  clean (no new warnings).
- Browser check on the running dev server (do NOT run `./init.sh`/`next build`
  while `next dev` is live — corrupts `.next`): landing renders all sections in
  both light and dark; theme toggle persists across reloads; login OAuth link
  points at the API; pricing subscribe still hits Stripe and gates on auth;
  responsive breakpoints (880px, 560px) collapse grids as in the prototype.
