# Эволюция процесса — ретроспектива харнесса StoryGrow

Как менялась работа с агентами с момента старта проекта (2026-05-21) до сегодня (2026-06-01). Каждое правило появлялось из конкретного friction'а, а не из теории.

Это ретроспектива, а не контракт — актуальные правила живут в [`CLAUDE.md`](../CLAUDE.md) и [`AGENTS.md`](../AGENTS.md).

---

## Кратко

- **12 дней, 22 сессии, ~70% 5-недельного роадмапа закрыто** — подробности в `progress.md`.
- Харнесс вырос в 4 волны: **бутстрап → workflow → контракт поведения → аудит процесса**.
- Большинство правил появилось из наблюдаемых friction'ов, одно явно отвергнуто как cargo cult.
- Источники истины: GitHub Issues (задачи), `progress.md` (сессии), `docs/adr/` (архитектура), `~/.claude/.../memory/` (накопленный фидбек).

---

## Хронология

### Волна 1 — Бутстрап (2026-05-21)

**Цель:** сделать проект понятным для агента при холодном старте.

| Действие | Артефакт |
|---|---|
| Созданы базовые файлы харнесса | `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md`, `progress.md`, `session-handoff.md` |
| Принята гибридная схема скиллов | `superpowers:*` (процесс) + `mattpocock/skills` (issues/triage/diagnose/handoff) |
| Роадмап мигрирован → GitHub Issues | 32 issue, каждый закрывается за 1–4 часа |
| Зафиксирован технический стек | Vercel AI SDK (не LangChain), `gpt-4o-mini`, pgvector, BullMQ, LangFuse |
| Написаны контракты для агентов | `docs/agents/{issue-tracker,triage-labels,domain}.md` |

Решение зафиксировано сразу: **нет `feature_list.json`** — GitHub Issues единственный источник задач, `progress.md` — журнал сессий. Двойной источник истины отвергнут на старте.

### Волна 2 — Дисциплина workflow (2026-05-22 — 2026-05-24)

**Триггер:** первый feature PR приближался, а вопрос «как идут ветки и PR?» не имел письменного ответа.

| Дата | Изменение | Почему |
|---|---|---|
| 2026-05-22 | [ADR-0001](adr/0001-git-workflow.md) — один issue → одна ветка → один PR → squash | Предсказуемая история; автозакрытие через `Closes #N` |
| 2026-05-22 | Hard Constraint #7 (нет прямого пуша в `main`) | Аудит-трейл на уровне защиты курсовой |
| 2026-05-22 | Hard Constraint #18 (Conventional Commits в заголовке PR, проверяется CI) | Subject squash-коммита = subject PR; нужно для changelog |
| 2026-05-24 | husky + lint-staged → prettier перед коммитом | Убрать форматирование из код-ревью |
| 2026-05-24 | `./init.sh` запускается в CI на каждый PR | Локальный смок-чек становится контрактом, а не рекомендацией |
| 2026-05-24 | Правило: обновления `progress.md` бандлятся в feature PR | Один PR — одна логическая единица; журнал сессии живёт вместе с работой |

### Волна 3 — Контракт поведения агента (2026-05-23, PR #36)

**Триггер:** анализ [applerom/agent1st AGENTS.md](https://github.com/applerom/agent1st/blob/main/AGENTS.md). Избирательно взяли то, что закрывает наблюдаемые проблемы; отвергли перформативное.

**Принято в [`AGENTS.md`](../AGENTS.md):**
- **Done is not a mood** — завершение требует доказательств: `./init.sh` exit 0; для AI-фич — трейс в LangFuse и строка `StoryEval`.
- **Right to disagree** — 3-шаговый формат: назвать риск, предложить меньшую альтернативу, продолжить незаблокированную работу.
- **Don't stop at the first weak signal** — пустой `grep` — это «нет результата», а не «не существует»; попробуй один альтернативный путь перед выводом.
- **Complaint-Driven Development** — блок `Friction:` прямо в текущей сессии `progress.md` (не отдельный файл).

**Принято в [`CLAUDE.md`](../CLAUDE.md):**
- Формат **`Правило → Почему → Если нарушено`** применён ко всем 6 правилам AI-Pipeline Discipline. Позволяет агенту оценивать граничные случаи, а не следовать механически.

**Принято в [`session-handoff.md`](../session-handoff.md):**
- Компактный шаблон — Objective / Status / Key decisions / Assumptions / Rejected paths / Blockers / Next steps / Evidence / Frictions.

**Явно отвергнуто:**
- **Фраза-активация «Agent1st Mode ON»** — cargo cult; поведение модели не меняется от произнесения магической строки. Поведение задаётся правилами в контексте, а не ритуалом.

### Волна 4 — Первый параллельный запуск субагентов (2026-05-25)

**Три параллельных субагента** в изолированных git worktree'ах (tooling + Prisma schema + Zod AI schemas). Ноль merge-конфликтов; rebase на свежий `main` прошёл чисто для обоих последующих PR. Подтверждено:
- `superpowers:dispatching-parallel-agents` реально работает на этом репо.
- Изоляция worktree предотвращает типичный сбой с общим `node_modules`.

Регулярная практика: очистка worktree'ев через несколько сессий (3 устаревших удалены 2026-05-26).

### Волна 5 — Subagent-driven development в полную силу (2026-05-29)

**Триггер:** issue #11 (StoryGenerator) содержал 8 подзадач; последовательно — это была бы целая сессия.

| Паттерн | Применение |
|---|---|
| Subagent-driven dev для multi-task issues | 8 задач в PR #66 отданы субагентам с общей спецификацией |
| **Code review как foreground (блокирующий) субагент** | Ревью блокирует fix-pass перед merge; асинхронный режим не подходил |
| Re-review только при наличии оснований (формализовано позже) | Избежать тредмила ревью на механических фиксах |

### Волна 6 — Аудит процесса через grilling (2026-05-31, PR #d2db768)

**Триггер:** velocity оказалась в 2–3× выше плановой (29/37 issues за 8 дней) — риск, что агентный dev шёл на автопилоте без периодического аудита.

**Итоги (7 улучшений процесса):**
- `#72` eval-corpus harness — пауза перед admin dashboard, чтобы дашборд с метриками опирался на реальные данные.
- `#74` frontend test infra — Vitest + RTL + MSW + Playwright **до** 5 входящих frontend-issue.
- **Visual contract для frontend** — для каждого UI-issue пользователь создаёт прототип в Claude Design, экспортирует PNG в `docs/design/`, агент читает через мультимодальный `Read` + структурный ASCII-wireframe в теле issue. Зафиксировано в `AGENTS.md`, строка 33.
- `#26` Fast Flow разбит на `#75/#76/#77/#78` — восстановлен инвариант «один issue → один PR».
- `#22` dev VPS объединён с `#29` prod deploy — убрать дублированную сессию деплоя.
- `#79` скрипт demo-выступления написан заранее — чтобы его требования влияли на приоритеты #25/#27/#72, а не наоборот.
- **Периодичность grilling** сохранена в auto-memory: проактивно предлагать `/grill-with-docs` раз в ~неделю.

**Friction зафиксирован в той же сессии:** «agentic dev was running on auto-pilot without a periodic audit» → создано правило в memory, чтобы следующий агент предлагал grilling без подсказки.

### Волна 7 — Политика повторного ревью (2026-06-01, в ходе fix-pass для #81)

**Триггер:** механические фиксы гоняли на повторное ревью без необходимости, съедая бюджет контекста.

**Формализовано в [`feedback_re_review_policy.md`](../../.claude/projects/-Users-mac-Projects-storygrow/memory/feedback_re_review_policy.md):**

Повторное ревью только если выполнено ≥1 условие:
1. Архитектурный сдвиг в ходе фиксов
2. Замена рекомендованного подхода на альтернативный
3. Добавлен новый критический тест
4. ≥3 связанных Critical-фикса

Иначе: применить фиксы, проверить `./init.sh`, merge.

**Friction той же сессии:** забыли запаковать обновление `progress.md` в feature PR (правило AGENTS.md). Выпущен отдельный docs PR для исправления; практика следующей сессии: добавлять запись в progress.md в первый же коммит feature-ветки.

---

## Что взято из agent1st

Сопоставление с 11 пронумерованными правилами [applerom/agent1st AGENTS.md](https://github.com/applerom/agent1st/blob/main/AGENTS.md).

### Принято полностью

| # | Правило agent1st | Где в StoryGrow | Примечания |
|---|---|---|---|
| 2 | Done Is Not a Mood | `AGENTS.md` § Agent Behavior Contract; Definition of Done в `CLAUDE.md` | Привязано к конкретным доказательствам: `./init.sh` exit 0, трейс LangFuse, строка `StoryEval` |
| 3 | Right to Disagree | `AGENTS.md` § Right to disagree | 3-шаговый формат прописан явно |
| 6 | Complaint-Driven Development | `AGENTS.md` § CDD; блок `Friction:` в `progress.md` | Инлайн в записи сессии, не отдельный файл (нет двойного источника истины) |
| 8 | Don't Stop at First Weak Signal | `AGENTS.md` § Don't stop at the first weak signal | Переформулировано с конкретным примером на `grep` |
| 11 | Continuity | Шаблон `session-handoff.md` + таблица Key Continuity Files в `AGENTS.md` | Компактный формат принят 2026-05-23 |

### Принято частично / неявно

| # | Правило agent1st | Что есть | Чего нет |
|---|---|---|---|
| 1 | Role Contract | Глобальный `~/.claude/CLAUDE.md` определяет роль «senior engineer / pair-programmer» | Нет именованного правила проекта, разделяющего «intent/constraints/acceptance» (человек) и «route/result» (агент) |
| 5 | Semantic Hygiene | `CONTEXT.md` — глоссарий домена; агентов направляют к нему перед написанием промптов/схем/типов | Нет именованного правила «использовать эти термины единообразно в коде/доках/API»; полагается на то, что агент читает `CONTEXT.md` |
| 9 | Delegation Design | Применяется на практике: параллельные субагенты (2026-05-25), foreground code-review субагент (2026-05-29), subagent-driven dev для #11 | Не формализовано в `AGENTS.md` как правило с deliverables/acceptance/shared-artifact requirements |
| 10 | Semantic Logging | `progress.md` — долгоживущий журнал сессий; ADR для архитектуры | Формат «expected vs actual» не зафиксирован; трейсы LangFuse закрывают прод-сторону, но нет правила, которое это явно говорит |

### Не принято

| # | Правило agent1st | Статус | Куда бы легло, если принять |
|---|---|---|---|
| 4 | Attention Engineering | Нет в харнессе | Легло бы в `AGENTS.md` § Context Management; частично перекрывается существующим «One issue at a time» |
| 7 | Agent Loop: Explore → Execute → Reflect | Не именовано | `superpowers:systematic-debugging` и `superpowers:test-driven-development` несут сопоставимые циклы, но проектного phase model нет |
| — | Фраза «Agent1st Mode ON» | **Явно отвергнуто** (PR #36, лог 2026-05-23) | Cargo cult — поведение модели не меняется от магической строки |

---

## Что добавили сверх agent1st

Правила и паттерны харнесса StoryGrow, которых у agent1st нет:

| Добавление | Триггер | Зафиксировано |
|---|---|---|
| Формат `Правило → Почему → Если нарушено` для AI-pipeline правил | Нужно оценивать граничные случаи AI-специфичных ограничений | `CLAUDE.md` § AI-Pipeline Discipline |
| Список Hard Constraints (18 пронумерованных запретов) | TypeScript / pnpm / AI-pipeline инварианты, нарушить которые можно только с явным решением | `CLAUDE.md` § Hard Constraints |
| `./init.sh` как универсальный смок-гейт | Одна команда, везде в Definition of Done и в CI | `init.sh` + `CLAUDE.md` |
| Обновление `progress.md` в feature PR | Не плодить отдельные docs PR, фрагментирующие историю ревью | `AGENTS.md` § Working Rules |
| Visual contract для frontend-issue'ев | У агентов нет врождённого визуального суждения | `AGENTS.md` строка 33; `docs/design/` |
| Политика повторного ревью (4 триггера) | Прекратить гонять механические фиксы на ревью | Memory: `feedback_re_review_policy.md` |
| Периодичность grilling (~раз в неделю) | Отловить дрейф автопилота до накопления | Memory: `feedback_grilling_cadence.md` |
| Branch-before-edit | Восстановление после «отредактировал прямо в main» | Memory: `feedback_branch_before_edit.md` |
| English-only для спеков/планов/ADR/корневых доков | Единый язык артефактов | Memory: `feedback_docs_language.md` |
| Параллельные субагенты в git worktree'ах | Подтверждён запуск 3× параллельно, ноль конфликтов | `superpowers:dispatching-parallel-agents` + практика worktree |

---

## Результаты на 2026-06-01

- **Velocity:** 33/37 issues закрыто за 12 дней. Исходный 5-недельный план → code-complete ориентировочно 6–8 июня.
- **Тесты:** 0 → 105 backend-тестов за 2 недели.
- **Артефакты процесса:** 22 записи в `progress.md`; 2 ADR; 5 правил в memory; 1 grilling-ретроспектива.
- **Friction-цикл закрывается:** из 4 friction'ов, зафиксированных в `progress.md`, все 4 привели к изменению правила или записи в memory в ту же или следующую сессию.

---

## Как продолжать эту ретроспективу

- Новый раздел — только когда меняется правило, не на каждую сессию.
- Формат каждой записи: **Триггер → Изменение → Где зафиксировано**.
- Если правило удаляется или ослабляется — запиши причину. Это самые трудные записи и самые полезные для будущих читателей.
