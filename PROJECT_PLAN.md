# StoryGrow — План проекта

## Концепция

**Pedagogically-grounded генератор персонализированных детских книг.** Родитель вводит имя ребёнка, возраст и развивающую цель (например, *«научиться делиться»*, *«перестать бояться темноты»*). Система генерирует сказку, где главный герой носит имя ребёнка, **лексика и структура сюжета адаптированы под возраст по педагогической модели, а качество автоматически проверяется LLM-as-judge с регенерацией при низком скоре**. На выходе — PDF + список вопросов для обсуждения с ребёнком.

## Контекст курса

Проект делается в рамках **«Курса по разработке и запуску SaaS сервиса с помощью AI»** (RS School / Владимир Яковлев). Курс предлагает базовый шаблон — генератор детских книг. Этот проект — **авторский вариант на той же архитектуре**, с углублением в AI-инженерию (RAG, structured generation, evaluation), которое отличает его от базовой версии.

**Дедлайн:** 5 недель до защиты.

## Целевая аудитория

- Родители детей 3–10 лет
- Хотят персонализированные истории с педагогической ценностью, а не «общие сказки»
- Готовы платить подписку за качественный персонализированный контент

## Отличие от базовой версии курса

| | Базовый StoryCraft (курсовой шаблон) | StoryGrow (этот проект) |
|---|---|---|
| AI-pipeline | `prompt → GPT → текст → DALL-E → картинка` | `RAG → structured gen → LLM-judge → регенерация при низком скоре` |
| Возрастная адаптация | Промпт типа «для детей» | RAG над лексическими корпусами по возрасту |
| Контроль качества | Нет | Автоматический LLM-as-judge + метрики в БД |
| Структура сказки | Свободный текст | Function calling по педагогической схеме |
| Observability | Логи | LangFuse: трейсы, скоры, дашборд |

## Технологический стек

| Слой | Технология |
|------|------------|
| Frontend | Next.js (App Router) |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 15+ с расширением `pgvector` |
| Queue | BullMQ + Redis |
| Storage | S3 / MinIO (локально через docker-compose) |
| AI SDK | **Vercel AI SDK** (`ai`, `@ai-sdk/openai`, `zod`) — без LangChain |
| LLM | OpenAI `gpt-4o-mini` (текст + judge), `text-embedding-3-small` (embeddings) |
| Image gen | OpenAI `dall-e-3` (без Flux/IP-Adapter в MVP) |
| Observability | **LangFuse** (self-hosted в docker-compose) |
| PDF | Puppeteer |
| Payments | Stripe (test mode → production к защите) |
| Notifications | SSE (Server-Sent Events) для прогресса медленной генерации |
| Deploy | Dokploy на VPS (Hetzner, ~€5/мес, со 2-3 недели для тестов, на 5-й — продакшен) |
| Monitoring | Sentry + Loki/Grafana (минимальная настройка) |

## Архитектура AI-pipeline

```
Пользователь → форма (ребёнок, возраст, цель)
                ↓
       [BullMQ job: generateBook]
                ↓
  1. VocabularyRagService.retrieve(age)
       → pgvector similarity search
       → topK слов из корпуса для возрастного уровня
                ↓
  2. StoryGenerator.generate()
       → Vercel AI SDK `generateObject` (Zod schema)
       → структурированный JSON: setup, conflict, lesson, resolution,
         discussionQuestions[5], illustrationPrompts[N]
                ↓
  3. StoryEvaluator.evaluate(story)
       → второй LLM-вызов с judge-промптом
       → JudgeSchema: ageAppropriateVocab, hasMoralLesson,
         structureCompleteness, safetyForChildren, length (все 0-10)
       → если средний скор < 7 → goto step 2 (max 2 retry)
                ↓
  4. ImageGenerator.generate(illustrationPrompts)
       → DALL-E 3 для каждой страницы
                ↓
  5. PDFRenderer.render(story, images)
       → Puppeteer → PDF в S3
                ↓
  6. Discussion questions на последней странице PDF
                ↓
       SSE прогресс → фронт
```

Каждый AI-вызов трейсится в LangFuse через `experimental_telemetry`.

## База данных (сущности)

```
User (id, email, googleId, createdAt)
├── Child[] (name, age, gender, interests)
├── Book[] (title, status, childId, learningGoalId, ...)
│   ├── BookPage[] (pageNumber, text, imageUrl)
│   └── StoryEval (judgeScores: JSON, attempt, finalScore, generatedAt)
└── Subscription (stripeSubscriptionId, plan, status, periodEnd)

LearningGoal (admin-managed catalogue, ~20 целей)
VocabularyEntry (word, gradeLevel, frequency, embedding: vector)
Template (для быстрого потока генерации)
```

## Два потока генерации (требование курса)

- **Быстрый (~5с):** готовый шаблон сказки + плейсхолдеры (имя, возраст, цель) + подбор готовых иллюстраций по тегам → быстрый PDF.
- **Кастомный (3–10 мин, через BullMQ):** полная AI-генерация по pipeline выше, SSE-прогресс на фронт.

## Roadmap (5 недель)

### Неделя 1 — Решение + основа *(текущая)*
- [x] Анализ выбора проекта, фиксация плана
- [x] Переименование папки `miranda` → `storygrow`
- [x] Обновление `PROJECT_PLAN.md`
- [ ] Настройка harness: `CLAUDE.md`, `AGENTS.md`, code style
- [ ] Инициализация репозитория, монорепо (`backend/`, `frontend/`)
- [ ] `docker-compose.yml`: PostgreSQL + pgvector, Redis, MinIO, LangFuse
- [ ] Базовый scaffold NestJS + Next.js + Prisma

### Неделя 2 — AI-инженерная глубина
- [ ] Prisma схема: User, Child, Book, BookPage, StoryEval, LearningGoal, VocabularyEntry
- [ ] Установка pgvector в Postgres, миграция
- [ ] Скачать Dale-Chall + AoA-Kuperman, скрипт индексации в `VocabularyEntry`
- [ ] `VocabularyRagService`: retrieval по grade level
- [ ] `StoryGenerator` (Vercel AI SDK + Zod-схема педагогической истории)
- [ ] `StoryEvaluator` (LLM-as-judge с JudgeSchema)
- [ ] Логика regenerate при низком скоре
- [ ] Подключение LangFuse через `experimental_telemetry`
- [ ] BullMQ job `generateBook`, processor
- [ ] Google OAuth + JWT (NestJS Passport)

### Неделя 3 — PDF + базовый UI
- [ ] Puppeteer-job: HTML-шаблон страницы → PDF
- [ ] Layout: иллюстрация + текст + discussion questions на финальной странице
- [ ] Frontend: логин, форма создания книги, страница книги, прогресс через SSE
- [ ] Каталог развивающих целей (`LearningGoal`) + админ-CRUD
- [ ] Деплой dev-окружения на VPS для проверки

### Неделя 4 — Stripe + два потока + админка
- [ ] Stripe checkout + webhooks
- [ ] Prisma `Subscription`, лимиты по плану
- [ ] Быстрый поток: `Template` + плейсхолдер-логика
- [ ] Админка: список книг, judge-скоры, метрики (% книг с первой попытки, средние скоры)
- [ ] SEO-страницы (Schema.org, OG-теги) на отдельном поддомене

### Неделя 5 — Прод + защита
- [ ] Production-деплой на VPS с доменом + HTTPS
- [ ] Sentry, базовый мониторинг (Loki/Grafana)
- [ ] Полировка UI, фиксы багов
- [ ] Подготовка к защите: слайды, демо-сценарий, заготовки ответов
- [ ] Eval-дашборд для жюри (метрики качества из StoryEval)

## Out of scope (явно НЕ делаем в MVP)

- Character consistency через Flux/SDXL с IP-Adapter — оставляем DALL-E 3
- Реферальная программа
- Adaptive feedback loop от родителя
- Quiz как интерактивные тесты (только список вопросов в PDF)
- Полная локализация продукта на английский (только лексические корпуса используем)
- Fine-tuning моделей

## Язык продукта

- **Продукт (UI, сказки):** русский
- **Корпуса для RAG:** английские (Dale-Chall, AoA-Kuperman) как **proxy для уровня сложности** — мапятся в системный промпт описанием уровня, GPT-4o адаптирует под русский по описанию. Открытых русских корпусов «слово → возраст» нет, это честный архитектурный компромисс, объясняемый на защите.

## Бюджет

| Статья | Сумма |
|---|---|
| VPS (Hetzner CX22, 5 неделя продакшен) | ~€5 |
| OpenAI credits (эксперименты + тесты + продакшен на курсе) | ~$15–25 |
| Домен (опционально) | ~$10/год |
| Всё прочее (Dokploy, LangFuse, Stripe test mode, MinIO) | $0 |
| **Итого** | **~$25–40** |

## Связанные проекты в файловой системе

- `/Users/mac/Projects/storycraft/` — **референсный учебный репозиторий** курса. Не используется как стартовая точка кода (пишем с нуля), но можно подсматривать паттерны (BullMQ-processors, Prisma-структура, OAuth-настройка).
- `/Users/mac/Projects/storygrow/` — **этот проект**.

## Подход к разработке

- **Написание с нуля** (без копирования из storycraft) с помощью AI-агентов
- **Harness:** `CLAUDE.md` + `AGENTS.md` с правилами проекта и стиля
- **Superpowers skills:** brainstorming перед каждой крупной фичей, TDD для AI-pipeline, verification-before-completion перед коммитами, systematic-debugging при проблемах
- **Замедление и проверка руками** на AI-pipeline (RAG, structured gen, judge) — это субстанция защиты, нельзя автогенерить и забывать

## Что говорим на защите (заготовка)

> *«Я взяла архитектуру курса (два потока генерации, Stripe, очереди, SSE, VPS-деплой), но в AI-слое реализовала три вещи, которых нет в базовой версии:*
> *(1) RAG над лексическими корпусами для возрастной адаптации сложности;*
> *(2) structured generation по педагогической модели через Vercel AI SDK + Zod;*
> *(3) автоматический LLM-as-judge с регенерацией при низком скоре.*
> *Все AI-вызовы трейсятся в LangFuse — могу показать дашборд: процент книг, проходящих с первой попытки, средние скоры по критериям, дрейф качества во времени.»*

---

**Дата обновления плана:** 2026-05-21
