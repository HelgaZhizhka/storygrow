# StoryGrow — Defense Demo Script

**Total time:** 7 minutes + Q&A  
**Format:** live browser demo, one window open; LangFuse in second tab ready to switch  
**Pre-flight:** start `docker compose up -d`, `pnpm --filter backend dev`, `pnpm --filter frontend dev`; log in as admin user; open LangFuse at `http://localhost:3030`

---

## 00:00–00:30 — Opening hook (30 s)

> «Представьте: ребёнок боится темноты. Можно купить обычную сказку, а можно за две минуты сгенерировать историю именно про Машу, именно про страх темноты, именно для пятилетнего ребёнка — со словарным запасом, который она точно поймёт. Именно это делает StoryGrow.»

Point at the browser — show the books list at `/books`. Mention it's a working product, not a prototype.

---

## 00:30–01:30 — Fast Flow live demo (60 s)

**Navigate:** click **+ Новая книга** → select existing child (e.g. Алиса, 5 лет) → pick goal «Доброта» → choose **Fast** mode → click **Создать**.

While the result appears (~3 s):

> «Fast Flow — синхронный путь. Берём один из пяти авторских шаблонов, подставляем имя ребёнка и цель обучения, подбираем готовые иллюстрации по тегам. Результат — мгновенно, без вызовов нейросети.»

Show the book detail: illustrated pages, "Скачать PDF" button.

> «Шаблоны — это разогрев. Настоящая ценность — кастомный флоу.»

---

## 01:30–03:30 — Custom Flow live demo with visible retry (120 s)

**Navigate:** click **+ Новая книга** → same child → same goal → choose **Custom** mode → **Создать**.

Browser redirects to `/books/:id/progress`. SSE stream starts.

**While waiting (~3 min), narrate the pipeline:**

> «Запускается асинхронный BullMQ-джоб. Первый шаг — Plan: отдельный `generateObject`-вызов, который строит арк истории, разбивку по страницам, выбирает безопасный конфликт и фиксирует "якорь консистентности" — имя героя и его описание.»

> «Второй шаг — Prose: отдельный вызов, который пишет текст целиком по этому плану, в регистре тёплой сказки а-ля Сутеев — не по одной странице за раз, а всей историей целиком, чтобы сохранить связность.»

> «Третий шаг — судья. Прохождение книги — это четыре независимых гейта: детерминированная структурная проверка, детерминированная проверка языковой чистоты, шесть guardrail-критериев судьи (порог 6 из 10 каждый), и отдельный craft-сигнал `registerMatch` — насколько текст близок к golden-эталонам, порог 7.0 из 10. Если хоть один гейт не пройден — цикл повторяется, максимум два раза, с явным фидбеком в промпте.»

When the book finishes (or open the staged book `cmpzhjeac0000m2lpzi7sj5q3` — see `staged-books.md`), show the book detail. Live generation may pass on the first attempt or need a retry — narrate whichever actually happened, don't force the retry story if it didn't occur:

> **Если попыток 1:** «Смотрите: прошла с первой попытки, оценка N/10. Это не значит "повезло" — это значит, что все четыре гейта (структура, языковая чистота, шесть guardrail-критериев, и craft-сигнал регистра) сошлись сразу.»

> **Если попыток > 1:** «Смотрите: "Попыток генерации: N". Первая версия не прошла один из гейтов — деталь видна в LangFuse через секунду — и система перегенерировала с явным фидбеком в промпте.»

**Switch to LangFuse tab:**

> «Каждый вызов трассируется в LangFuse под трейсом `story-generation`: `story-planner` — план и арк истории, `story-prose` — сам текст, `story-title` — финальное название, придуманное уже после текста, `story-evaluator` — судья по всем гейтам. Для каждого — точный промпт, точный ответ, токены, стоимость, латентность. Это то, что отличает production AI-систему от учебного эксперимента.»

---

## 03:30–05:00 — Eval Dashboard walkthrough (90 s)

**Navigate:** `/admin/metrics`

> «Это eval-дашборд. Метрики из таблицы `StoryEval` в Postgres — там хранится каждая оценка судьи с номером попытки.»

Point at each number:

| Screen element | What to say |
|---|---|
| Total / Ready books | «Всего сгенерировано X книг, Y готовы.» |
| Pass rate | «Pass rate — доля книг, дошедших до статуса ready.» |
| Passed 1st attempt | «N книг прошли с первой попытки — это наш ключевой KPI качества.» |
| Criterion bars | «Vocabulary и Safety — стабильно выше 9. Это значит, что лексика действительно соответствует возрасту, и история безопасна для детей.» |
| Mean final score | «Средний финальный скор — X.XX/10 за последние 7 дней.» |

> «Этот дашборд — доказательство, что качество измеримо и воспроизводимо. Не "история написана хорошо на взгляд автора", а числовые метрики с историей.»

---

## 05:00–06:00 — Architecture talk-through (60 s)

Open `docs/ARCHITECTURE.md` or show the ASCII pipeline in the terminal — or draw on a whiteboard:

```
User → form
  → BullMQ job
    1. Plan            (generateObject + ZodSchema → StoryPlan: arc, page beats, safe conflict)
    2. Prose            (generateObject → whole-story text in Сутеев read-aloud register)
    3. StoryEvaluator   (4 gates: structural, language purity, 6 LLM guardrails, craft registerMatch; retry loop)
    4. ImageGenerator   (Gemini 2.5 Flash Image + портрет-референс → один герой; gpt-image-1 fallback)
    5. PDFRenderer      (Puppeteer → S3/MinIO)
  ← SSE progress → frontend
```

> «Стек: NestJS + Next.js, Prisma + PostgreSQL с pgvector, BullMQ + Redis, Vercel AI SDK — никакого LangChain. Для детерминированного пайплайна "план → проза → судья → иллюстрации → рендер" LangChain добавил бы только слои абстракции.»

> «Отдельно: все LLM-вызовы идут через `generateObject` с Zod-схемой — ни одного сырого `chat.completions`. Это гарантирует, что мы получаем контракт на выходе, а не строку.»

---

## 06:00–07:00 — Q&A buffer / closing (60 s)

> «Платёжная интеграция — Stripe Webhooks, единый платный план premium (20€/мес) плюс free, с квотами на книги. Деплой — Railway, Docker multi-stage build с Chromium для Puppeteer.»

> «Что дальше — фото ребёнка как референс для иллюстраций. Заблокировано GDPR-анализом, запланировано в backlog.»

Leave time for jury questions. See `qa-prep.md` for prepared answers.

---

## Contingency

If OpenAI is down or generation takes >10 min: open a **pre-generated book** directly.  
Book IDs and URLs are in `staged-books.md`.
