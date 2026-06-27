# Harness и SDD 

---

## 1. Что такое harness и зачем он нужен

**Harness** = набор durable-артефактов в самом репозитории, которые делают агента продуктивным от сессии к сессии и от агента к агенту.

**Проблема, которую решает:**

Без harness агент каждую сессию:
- Не знает, что было сделано вчера
- Не знает локальных правил проекта (стиль, стек, запреты)
- Не знает домена и придумывает свои термины
- Не знает, "как у нас принято" работать с задачами, ветками, коммитами

Каждая сессия начинается с долгого разогрева через чат, который не остаётся в репо. Решения теряются. Прогресс не накапливается.

**Принцип harness'а:** всё, что нужно знать агенту, лежит в файлах, которые он сам читает в начале сессии. Чат — расходник, файлы — актив.

---

## 2. Файловая структура harness'а в StoryGrow

```
storygrow/
├── CLAUDE.md                ← Hard Constraints + tech stack + где что искать
├── AGENTS.md                ← Session-start workflow + skill map + Working Rules
├── CONTEXT.md               ← Глоссарий домена (Book, Story, StoryEval, Judge…)
├── PROJECT_PLAN.md          ← Концепция, scope, 5-недельный roadmap, бюджет
├── progress.md              ← Лог сессий (newest at bottom)
├── session-handoff.md       ← Заполняется только если сессия прервалась
├── init.sh                  ← Smoke-check (tsc + lint + tests) — Definition of Done
│
└── docs/
    ├── CODE_STYLE.md        ← Адаптированный чек-лист RS School clean-code
    ├── ARCHITECTURE.md      ← Монорепо, AI-pipeline ASCII-диаграмма, Prisma sketch
    ├── adr/                 ← Architectural Decision Records (1 файл на решение)
    │   └── 0001-git-workflow.md
    ├── agents/              ← Конфиг для скиллов: где трекер, какие лейблы, где домен
    │   ├── issue-tracker.md
    │   ├── triage-labels.md
    │   └── domain.md
    └── superpowers/
        ├── specs/           ← Спеки фич (от writing-plans)
        └── plans/           ← Планы реализации (от writing-plans)
```

**Кто что читает:**

| Файл | Когда читается |
|------|----------------|
| `CLAUDE.md` | Автоматически каждую сессию (Claude Code инжектит в контекст) |
| `AGENTS.md` | Шаг 1 session-start workflow |
| `progress.md` | Шаг 2 session-start workflow |
| `session-handoff.md` | Шаг 3, только если не пустой |
| `CONTEXT.md` | Перед написанием промптов, схем, типов с доменными терминами |
| `docs/adr/*` | Перед изменением затронутой области |
| `docs/agents/*` | Скиллы — например, `gh` CLI команды для issue-tracker'а |

---

## 3. Hard Constraints — самый важный файл

`CLAUDE.md` содержит **18 запретов**, отсортированных от общих к специфичным. Это не "best practices", это контракт: нарушил — переделывай.

Примеры из нашего CLAUDE.md:

```
1.  ❌ Use `any` (use `unknown` + Zod parse)
7.  ❌ Direct push to `main` or force push (all changes via PR)
9.  ❌ Raw LLM calls without a Zod schema — all generation via generateObject
10. ❌ AI output without a StoryEval row or LangFuse trace
12. ❌ Files larger than 400 lines
17. ❌ Skip verification (./init.sh) before claiming done
18. ❌ Squash-merge PR with non-Conventional-Commits title
```

**Почему именно так:**
- Запреты, а не "рекомендуется" — агент игнорирует мягкие формулировки
- Нумерация — чтобы ссылаться в PR-комментариях ("нарушает #9")
- "Почему" в конце списка — чтобы агент понимал rationale и судил edge-cases

---

## 4. Spec-Driven Development (SDD) в нашем варианте

**SDD = решения фиксируются в файлах до того, как пишется код.**

Артефакт ВСЕГДА опережает имплементацию. Если артефакта нет — мы ещё не готовы кодить.

**Уровни артефактов:**

| Уровень | Где живёт | Что фиксирует |
|---------|-----------|----------------|
| Stratgic | `PROJECT_PLAN.md` | Видение, scope, roadmap |
| Architectural | `docs/adr/NNNN-*.md` | Одно решение per файл, формат: Context → Decision → Consequences |
| Domain | `CONTEXT.md` | Глоссарий — точные термины, синонимы под `Avoid:` |
| Feature design | `docs/superpowers/specs/YYYY-MM-DD-feature-design.md` | Что строим и почему — до кода |
| Implementation plan | `docs/superpowers/plans/YYYY-MM-DD-feature-plan.md` | Чек-лист задач, последовательность |
| Tasks | GitHub Issues | Гранулированные тикеты, milestone = неделя |
| Session log | `progress.md` | Что было сделано в сессии |

**Поток одной фичи:**

```
brainstorm ──→ spec ──→ plan ──→ issues ──→ branch+code ──→ PR ──→ merge
   ↑           ↑         ↑         ↑              ↑           ↑
  чат      .md в repo  .md      gh issue       коммиты    review
```

Каждая стрелка — это вызов конкретного скилла. См. раздел 6.

---

## 5. Hybrid skills strategy: superpowers + mattpocock/skills

Мы используем две библиотеки скиллов вместе:

| Библиотека | Назначение | Стиль |
|------------|------------|-------|
| `superpowers:*` | Process — КАК работать | Дисциплинарные, rigid |
| `mattpocock/skills` | Tracker / comms / domain — С ЧЕМ работать | Адаптивные, flexible |

**Почему обе:**
- `superpowers` — это методология (TDD, debugging, verification). Скиллы заставляют не срезать углы.
- `mattpocock/skills` — это интеграция с инструментами (GitHub Issues, ADR, handoffs). Они умеют работать с конкретным трекером/доками.

Они не конкурируют — закрывают разные слои.

---

## 6. Полный список скиллов, которые мы используем

### superpowers:*

**`superpowers:using-superpowers`** — мета-скилл, грузится автоматически в начале сессии. Устанавливает правило "если 1% шанс что скилл применим — вызывай его".

**`superpowers:brainstorming`** — открытое исследование идеи до коммита на реализацию. Выход: разговор + опционально issue на GitHub.
- *У нас:* неявно использован при пивоте StyleCraft → StoryGrow.

**`superpowers:writing-plans`** — превращает brainstorm в письменную спеку/план.
- *Артефакт:* `docs/superpowers/specs/YYYY-MM-DD-feature-design.md` + `plans/...plan.md`
- *У нас:* пока не использован, будет вызван перед первой крупной фичей (например, AI-pipeline).

**`superpowers:executing-plans`** — пошаговое выполнение записанного плана с галочками.

**`superpowers:test-driven-development`** — жёсткий TDD: red → green → refactor. Без срезания углов.
- *У нас:* обязателен для AI-pipeline кода (constraint в AGENTS.md).

**`superpowers:verification-before-completion`** — финальная проверка перед "готово".
- *У нас:* кодифицировано как `./init.sh` (tsc + lint + tests).

**`superpowers:systematic-debugging`** — дисциплинированный debugging вместо guess-and-check.

**`superpowers:requesting-code-review`** — делегирует review дифа другому агенту.

### mattpocock/skills

**`grill-me`** — допрос пользователя перед стартом фичи: что неясно, что предполагается, какие риски.
- *У нас:* использован для валидации пивота на StoryGrow. Конкретно эта встреча показывает результат: 32 issue в GitHub с понятным scope.

**`grill-with-docs`** — то же, что grill-me, но **на выходе пишет в репо** (CONTEXT.md или ADR).
- *Используется когда:* решение касается домена или архитектуры.

**`to-issues`** — превращает спеку/план в GitHub Issues с лейблами и milestone.
- *У нас:* использован для миграции roadmap'а в 32 issue'а (#1-#32), распределённых по Week 1..5.

**`diagnose`** — быстрый bug-diagnose flow.

**`handoff`** — заполняет `session-handoff.md` если сессия прервалась mid-feature.

**`code-review:code-review`** — выполняет review дифа (не делегирует, а делает сам).

**`setup-matt-pocock-skills`** — meta-скилл, который **построил для нас harness**. Один раз запустили, он сгенерировал `docs/agents/*.md` и создал triage-лейблы на GitHub.

---

## 7. Skill Workflow Map — какой скилл когда

Это таблица из нашего `AGENTS.md`:

| Фаза | Скилл | Артефакт на выходе |
|------|-------|---------------------|
| Перед крупной фичей | `superpowers:brainstorming` или `grill-me` | Разговор; опционально issue |
| Решение про домен/архитектуру | `grill-with-docs` | Обновлённый CONTEXT.md или новый ADR |
| Превратить обсуждение в спеку | `superpowers:writing-plans` | `docs/superpowers/specs/...md` |
| Разбить спеку на задачи | `to-issues` | GitHub issues с лейблами + milestone |
| Имплементация | `superpowers:executing-plans` + `superpowers:test-driven-development` | Код + тесты |
| Расследование бага | `diagnose` или `superpowers:systematic-debugging` | Diagnosis trace, опционально ADR |
| Перед коммитом | `superpowers:verification-before-completion` | `./init.sh` exit 0 |
| Перед merge | `code-review:code-review` | Review comments |
| Сессия прервана | `handoff` | Заполненный `session-handoff.md` |
| Конец чистой сессии | (ручное) | Запись в `progress.md` |

---

## 8. Демо-сценарий: путь одной фичи

Покажу на примере **будущей** фичи "AI Story Generation Pipeline" (issue #14 в нашем трекере):

### Шаг 0 — Session start
```bash
pwd                                  # confirm /Users/.../storygrow
cat progress.md | tail -50           # что было в прошлой сессии
cat session-handoff.md               # пусто = не прерывались
gh issue list --milestone "Week 2"   # выбираю highest-priority open
git log --oneline -5
./init.sh                            # smoke-check должен быть зелёным
```

### Шаг 1 — Brainstorm
Вызываю `superpowers:brainstorming`. Обсуждаем:
- какой именно scope у "генерации"
- одна Zod-схема или несколько
- где границы между fast-flow и custom-flow

Не пишу код, не пишу спеку. Только разговор + возможно мелкие правки в `CONTEXT.md`.

### Шаг 2 — Domain check
Если всплыл новый термин (например, "RegenerationLoop") — вызываю `grill-with-docs`. Он:
- проверит, есть ли термин в `CONTEXT.md`
- если нет — добавит с определением и списком синонимов под `Avoid:`
- если меняется архитектура — создаст `docs/adr/0002-regeneration-loop.md`

### Шаг 3 — Spec
`superpowers:writing-plans` → `docs/superpowers/specs/2026-05-25-ai-generation-design.md`

В спеке: цель, неfunктиональные требования (latency, cost cap), интерфейс модуля, риски.

### Шаг 4 — Plan
Тот же скилл → `docs/superpowers/plans/2026-05-25-ai-generation-plan.md` со списком пронумерованных шагов.

### Шаг 5 — Issues (если ещё не созданы)
`to-issues` берёт план и создаёт/обновляет GitHub issues. У нас 32 уже созданы, поэтому скилл подберёт #14 и при необходимости разобьёт его на под-issue.

### Шаг 6 — Implementation
```bash
git switch -c issue/14-ai-generation
```
`superpowers:executing-plans` идёт по плану, в паре с `superpowers:test-driven-development`:
- красный тест
- минимальная имплементация → зелёный
- рефакторинг

### Шаг 7 — Verification
`superpowers:verification-before-completion` → `./init.sh` exit 0. Для AI-фич ещё проверяем:
- traces появились в LangFuse
- `StoryEval` строка записана в БД
- judge score выше threshold

### Шаг 8 — Review
`code-review:code-review` на дифе. Применяю замечания.

### Шаг 9 — Запись и PR
В той же ветке:
- Добавляю запись в `progress.md` (правило: bundle progress в feature PR, не отдельным)
- Открываю PR:
```bash
gh pr create --title "feat(ai): add story generation pipeline" --body "Closes #14"
```
- Self-merge: `gh pr merge --squash --delete-branch`

### Шаг 10 — Если прервались
Если в любой момент Шага 6-8 надо остановиться — вызываю `handoff`, заполняется `session-handoff.md`, ветка остаётся локально с WIP-коммитом.

---

## 9. Что кастомизировано и почему

Не всё взято из коробки. Решения по адаптации:

**Взято целиком из mattpocock/skills:**
- `docs/agents/domain.md` — single-context layout, наш случай
- `docs/agents/issue-tracker.md` — конвенции `gh` CLI
- `docs/agents/triage-labels.md` — 5 ролей по умолчанию

**Кастомизировано:**
- `CLAUDE.md` — 17 hard constraints из шаблона + 4 наших AI-pipeline-специфичных (#9-#11, #18)
- `AGENTS.md` — добавлен раздел **Deliberate non-files** про отсутствие `feature_list.json` (чтобы будущий агент не воссоздал то, что мы намеренно отвергли)
- `init.sh` — собственный скрипт smoke-check, потому что у нас pnpm workspace

**Намеренно НЕ взято:**
- `feature_list.json` (GitHub Issues = source of truth, дублировать = два места правды)

**Зафиксировано ADR-0001 — git workflow:**
- one issue → one branch → one PR → squash-merge
- branch protection на `main` (no force, no direct push)
- Conventional Commits на PR titles
- Bundle `progress.md` updates в feature PR, не отдельным

---

## 10. Цена и выгода

**Что стоило настройка harness'а:**
- 2 сессии (~3-4 часа): пивот идеи + scaffolding файлов + миграция roadmap'а в 32 issue
- 1 запуск `setup-matt-pocock-skills` (~5 минут)

**Что получили:**
- Любая новая сессия стартует за ~30 секунд (читает `progress.md` + `session-handoff.md`)
- Все решения зафиксированы — не приходится их пере-объяснять каждой новой сессии
- 32 issue с понятным scope и приоритетами — можно идти по списку, не возвращаясь к планированию
- Чек-лист hard constraints в каждой сессии — code review почти не нужен на типовых нарушениях
- Артефакт для защиты курса: PR-история + ADR'ы + спеки — материал для рассказа

**Что НЕ окупает себя на маленьких проектах:**
- ADR с тремя файлами — overkill для 1-недельного prototype
- 18 hard constraints — bewildering для hobby-проекта
- Skill map с 13 скиллами — нужен если планируешь много сессий

Harness масштабируется по количеству сессий, а не по размеру кода.

---

## 11. Что показать

1. **Открыть CLAUDE.md** — пройтись по hard constraints, особенно #9-#11 (AI-pipeline)
2. **Открыть AGENTS.md** — показать session-start workflow и skill map
3. **Открыть CONTEXT.md** — показать как зафиксированы термины с `Avoid:` (синонимы которые НЕ использовать)
4. **Открыть `progress.md`** — три записи показывают как лог накапливается
5. **Открыть `docs/adr/0001-git-workflow.md`** — показать формат ADR (Context → Decision → Consequences)

## 12. Ссылки

- **Superpowers (Obra):** https://github.com/obra/superpowers
- **mattpocock/skills:** https://github.com/mattpocock/skills
- **Anthropic Skills (концепция):** https://docs.claude.com/en/docs/agents-and-tools/agent-skills

