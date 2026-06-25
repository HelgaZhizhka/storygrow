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

> «Запускается асинхронный BullMQ-джоб. Первый шаг — RAG: pgvector ищет по embedding-пространству 80 слов из корпуса Дейла–Чалла, соответствующих возрасту ребёнка. Эти слова уходят в генератор как лексические ограничения.»

> «Второй шаг — `generateObject` Vercel AI SDK с Zod-схемой: setup → conflict → lesson → resolution + 5 вопросов для обсуждения + промпты к иллюстрациям. Не просто текст — структурированный JSON, который мы можем валидировать.»

> «Третий шаг — судья. Второй LLM-вызов оценивает историю по шести критериям от 0 до 10. Порог — 7.0. Если история не прошла — цикл повторяется, максимум два раза.»

When the book finishes (or open the staged book `cmpzhjeac0000m2lpzi7sj5q3`), show the book detail:

> «Смотрите: "Попыток генерации: 2". Первая версия получила 9.8 от судьи — но не прошла: детерминированная проверка языковой чистоты нашла английское слово в тексте. 9.8 оказалось недостаточно. Система перегенерировала с явным фидбеком в промпте.»

Point at **Оценка качества: 10.0 / 10** and **10 страниц** with illustrations.

**Switch to LangFuse tab:**

> «Каждый LLM-вызов трассируется в LangFuse. Здесь видно: два вызова генератора, два вызова судьи, метаданные попыток, токен-стоимость и латентность. Это то, что отличает production AI-систему от учебного эксперимента.»

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
    1. VocabularyRag  (pgvector similarity, 812 слов в корпусе)
    2. StoryGenerator (generateObject + ZodSchema → structured JSON)
    3. StoryEvaluator (LLM-judge, 6 критериев, retry loop)
    4. ImageGenerator (Gemini 2.5 Flash Image + портрет-референс → один герой; gpt-image-1 fallback)
    5. PDFRenderer    (Puppeteer → S3/MinIO)
  ← SSE progress → frontend
```

> «Стек: NestJS + Next.js, Prisma + PostgreSQL с pgvector, BullMQ + Redis, Vercel AI SDK — никакого LangChain. Для детерминированного пайплайна "retrieve → generate → judge → render" LangChain добавил бы только слои абстракции.»

> «Отдельно: все LLM-вызовы идут через `generateObject` с Zod-схемой — ни одного сырого `chat.completions`. Это гарантирует, что мы получаем контракт на выходе, а не строку.»

---

## 06:00–07:00 — Q&A buffer / closing (60 s)

> «Платёжная интеграция — Stripe Webhooks, подписки free/basic/premium с квотами на книги. Деплой — Dokploy на Hetzner VPS, Docker multi-stage build с Chromium для Puppeteer.»

> «Что дальше — фото ребёнка как референс для иллюстраций. Заблокировано GDPR-анализом, запланировано в backlog.»

Leave time for jury questions. See `qa-prep.md` for prepared answers.

---

## Contingency

If OpenAI is down or generation takes >10 min: open a **pre-generated book** directly.  
Book IDs and URLs are in `staged-books.md`.
