# Внешний ревью харнесса через Codex — 2026-07-23

Независимый ревью харнесса StoryGrow, проведённый владельцем продукта через Codex (не Claude Code), по шаблону из отдельного проекта ([`vibe-engineer 0.3.1`](/Users/mac/Documents/Codex/Projects/Personal-AI-Operator/05-Projects/ai-incubator/vibe-engineer-0.3.1-review-and-usage-guide-2026-07-22.md) — путь на локальной машине владельца, вне этого репозитория).

Что было применено, что отклонено и почему — см. [`process-evolution.md` § Волна 9](process-evolution.md). Этот файл — сырой текст отчёта, для точной цитаты и будущей сверки.

---

Я прочитал отчёт по vibe-engineer 0.3.1 и проверил фактическую проводку StoryGrow.

Главный вывод: у StoryGrow уже сильный, живой harness — заметно выше среднего для solo/AI-assisted проекта. Особенно хороши инструкции, continuity и контроль scope. Но verification сейчас доказывается преимущественно текстом в `progress.md` и чекбоксами PR. Не хватает машинно-связанной цепочки:

```text
acceptance criterion
→ проверка
→ конкретный запуск
→ результат и артефакт
→ commit/PR
→ граница доказательства: local / CI / staging / production
```

Именно verification/evidence — текущий bottleneck.

## Оценка harness

| Подсистема | Оценка | Вывод |
|---|---:|---|
| Instructions | 4/5 | Сильные правила, domain language, маршрутизация к документам. Есть runtime drift и ссылки на недоступные в Codex skills. |
| State / memory | 4/5 | GitHub Issues, `progress.md`, handoff, ADR, specs и plans работают. Не хватает формальной lineage между ними. |
| Verification | 2.5/5 | Хорошие тесты и AI-eval harness, но gate неполный, evidence в основном prose и не всегда воспроизводимо. |
| Scope control | 4.5/5 | Одна issue/branch/PR, запрет побочных рефакторингов, лимит файлов, явный DoD. |
| Lifecycle | 3.5/5 | Есть startup hook, handoff и end checklist, но автоматизация в основном Claude-specific. |
| Tool safety — дополнительно | 2/5 | Локальные разрешения Claude слишком широкие. |

Итоговая зрелость: примерно **3.7/5**. Это уже полноценный custom harness, но ещё не evidence-oriented harness уровня модели из отчёта.

## Что уже сделано хорошо

### 1. Instructions

[AGENTS.md](/Users/mac/Projects/storygrow/AGENTS.md:24) хорошо описывает рабочий процесс:

- one issue → one branch → one PR;
- one issue at a time;
- запрет скрытого изменения verification rules;
- обязательное сохранение решений в durable artifacts;
- TDD и live eval для AI pipeline;
- явный behavior contract: «Done is not a mood».

[CLAUDE.md](/Users/mac/Projects/storygrow/CLAUDE.md:7) добавляет проектные инварианты, AI discipline и Definition of Done. Особенно ценно, что правила объяснены через последствия, а не просто перечислены.

Есть progressive disclosure:

- `AGENTS.md` — workflow;
- `CLAUDE.md` — ограничения;
- `CONTEXT.md` — язык домена;
- `ARCHITECTURE.md` — система;
- ADR — решения;
- specs/plans — конкретные features;
- nested [frontend/AGENTS.md](/Users/mac/Projects/storygrow/frontend/AGENTS.md:1) — локальный Next.js-контекст.

Это уже аналог Instructions + Project Atlas из `vibe-engineer`, только в более лёгкой форме.

### 2. State и continuity

Уже используются почти все полезные механизмы:

- GitHub Issues как task source of truth;
- `progress.md` как chronological session log;
- архивирование старого progress;
- [session-handoff.md](/Users/mac/Projects/storygrow/session-handoff.md:1) с решениями, assumptions, rejected paths и evidence;
- ADR для архитектурных решений;
- 13 specs и 13 implementation plans;
- baseline JSON для AI evaluation;
- session-start hook, показывающий branch, commits, progress и handoff.

Решение не создавать `feature_list.json` правильное. Переносить этот элемент из `vibe-engineer` не стоит: он дублировал бы GitHub Issues.

### 3. Scope control

Это сильнейшая часть harness:

- работа привязана к issue;
- есть ограничения на размер изменения;
- unrelated work выносится отдельно;
- планы используют вертикальные slices;
- визуально значимые frontend-задачи требуют visual contract;
- завершение отделено от простого наличия кода.

История #280 с четырьмя review passes показывает, что harness действительно ловит реальные дефекты. Но одновременно показывает, что часть рисков обнаруживается поздно — более формальный verification plan мог бы выявлять инварианты раньше.

### 4. Verification-инфраструктура

Уже есть:

- TypeScript, ESLint, Jest, Vitest;
- 309 backend и 41 frontend tests;
- GitHub Actions;
- branch protection и Conventional Commit gate;
- Playwright smoke;
- `eval:text`;
- batch evaluation на 14 сценариях;
- три сохранённых AI baselines;
- LangFuse telemetry;
- `StoryEval`;
- обязательный live eval для AI changes;
- production verification, зафиксированная для Stripe portal.

Это хорошая основа. Проблема не в отсутствии проверок, а в том, что они пока не собраны в единую доказательную модель.

## Главные пробелы

### 1. Стандартный gate сейчас неработоспособен в Codex runtime

Сегодня `./init.sh` завершился ошибкой по всем шести пунктам. Причина — не код:

- репозиторий закрепляет pnpm `10.29.3` и Node `22.15.0`;
- текущий Codex runtime предоставляет Node `26.5.0` и pnpm `11.9.0`;
- pnpm пытается перестроить `node_modules` и прекращает работу из-за отсутствия TTY.

При прямом запуске уже установленных binaries всё прошло:

- backend: 42 suites, 309 tests;
- frontend: 4 files, 41 tests;
- TypeScript и ESLint — без ошибок.

То есть код green, а harness сообщает шесть одинаковых красных результатов. Кроме того, `pnpm --silent` в [init.sh](/Users/mac/Projects/storygrow/init.sh:18) скрывает исходную ошибку.

Нужно:

1. В начале `init.sh` проверять Node и pnpm против `.nvmrc` и `packageManager`.
2. При несовпадении завершаться одной понятной `environment_failure`.
3. Не использовать внешний `--silent`, скрывающий диагностический вывод.
4. Не позволять verifier автоматически перестраивать dependencies несовместимой версией pnpm.

Это P0: verification gate обязан сначала надёжно проверять самого себя.

> **Примечание при внедрении (2026-07-23):** проверка на этой же машине под Claude Code показала Node 26.5.0 вместо 22.15.0 из `.nvmrc` — при том что вся сессия весь день до этого прошла без единой проблемы на этой версии. Жёсткий fail против точного `.nvmrc` был бы регрессией. Реальный контракт — `engines.node: ">=22.0.0"` в package.json (диапазон, не точный пин). Итоговый фикс: preflight против `engines.node` (fail только вне диапазона) + WARN (не fail) при расхождении pnpm с `packageManager`, поскольку corepack обычно резолвит это прозрачно. См. `process-evolution.md` § Волна 9.

### 2. `init.sh` слишком узкий для Definition of Done

Сейчас он выполняет только typecheck, lint и unit tests ([строки 38–44](/Users/mac/Projects/storygrow/init.sh:38)).

Он не проверяет:

- production build backend/frontend;
- `format:check`;
- backend integration/e2e;
- Playwright;
- Prisma migration/schema validity;
- authenticated critical path;
- наличие evidence для AI changes.

CI просто вызывает тот же [init.sh](/Users/mac/Projects/storygrow/.github/workflows/ci.yml:40), поэтому эти пробелы переходят в required check.

Открытая issue #155 — `Release verification: builds + authenticated e2e` — фактически уже описывает значительную часть этого дефицита.

Оптимальная модель:

- `verify:quick` — typecheck, lint, unit, format;
- `verify:release` — quick + builds + migration checks + integration/E2E;
- `verify:ai` — quick + live eval/eval delta + LangFuse/StoryEval evidence.

Не нужно запускать дорогой release suite на каждом старте сессии.

> **Примечание при внедрении (2026-07-23):** этот пробел уже закрыт — #155 (`verify.sh`, слитый в `main` в этот же день, до этого ревью) реализует именно предложенную модель: `init.sh` = quick gate, `verify.sh` = release gate (builds, Prisma drift, authenticated e2e), запускается вручную (`workflow_dispatch`), не на каждый merge. Единственный реально отсутствовавший кусок — `format:check` — добавлен в `init.sh` этой же волной.

### 3. Evidence существует, но почти не имеет identity и lineage

PR template требует только поставить галочку ([pull_request_template.md](/Users/mac/Projects/storygrow/.github/pull_request_template.md:7)). `progress.md` обычно говорит «`./init.sh` green», но редко фиксирует:

- commit SHA, на котором это запускалось;
- dirty/clean state;
- версии Node/pnpm;
- точную команду;
- время;
- duration;
- exit code;
- классификацию failure;
- ссылку на CI run;
- artifact digest;
- proof boundary.

Из-за этого утверждение доказано для человека, но плохо проверяется следующей сессией или автоматикой.

*(Отложено — см. process-evolution.md § Волна 9, «осознанно не сделано сейчас».)*

### 4. AI evidence внутренне расходится

[AGENTS.md](/Users/mac/Projects/storygrow/AGENTS.md:34) требует live `eval:text`, а Definition of Done требует одновременно LangFuse trace и `StoryEval` row.

Но shared runner прямо сообщает: `eval:text` выполняется без DB writes и использует `bookId: "dry-run"` ([eval-run.ts](/Users/mac/Projects/storygrow/backend/src/scripts/lib/eval-run.ts:1)). Значит `eval:text` сам по себе не может доказать наличие `StoryEval` row.

Здесь смешаны два разных claim:

- **AI-quality claim:** новая версия prompt/model выдаёт приемлемый текст;
- **product-integration claim:** production pipeline записывает `StoryEval`, выполняет retries и связывает данные с книгой.

Их нужно разделить:

- `eval:text`/`eval:batch` → quality evidence и LangFuse trace;
- полноценная product generation → `StoryEval` row, retry behavior, trace и пользовательский результат.

> **Применено (2026-07-23):** `AGENTS.md` § Working Rules и § Agent Behavior Contract, `CLAUDE.md` § Definition of Done — оба места теперь явно разводят prose-quality evidence и product-integration evidence.

### 5. AI baseline недостаточно воспроизводим

Сохранённые JSON — отличный шаг, но, например, baseline фиксирует только дату и `"model": "default"` ([baseline JSON](/Users/mac/Projects/storygrow/docs/process/eval-baselines/2026-07-19-with-3-4-band.json:1)).

Не хватает:

- git SHA;
- issue/PR;
- фактических generator и evaluator model IDs;
- prompt/schema digest;
- eval-set version;
- threshold/config;
- LangFuse trace IDs;
- comparison against previous baseline;
- budget/cost;
- verdict: regression / expected variance / accepted exception.

Особенно опасно `"default"`: default меняется, после чего baseline перестаёт быть воспроизводимым.

*(Отложено — см. process-evolution.md § Волна 9.)*

### 6. Hooks работают не во всех runtimes

[`.claude/settings.json`](/Users/mac/Projects/storygrow/.claude/settings.json:1) подключает SessionStart и pre-merge gate только в Claude Code.

В Codex `AGENTS.md` читается, но эти hooks автоматически не являются частью репозитория как переносимого harness. Кроме того, skill map ссылается на несколько `superpowers:*`/`code-review:*` skills, которых в текущем Codex runtime нет.

Следует разделить:

- portable core: scripts, schemas, CI, repository artifacts;
- thin adapters: Claude hooks, Codex skills/config, другие runtime-specific entrypoints.

*(Отложено — см. process-evolution.md § Волна 9.)*

### 7. Permission boundary слишком широкая

Локальный `.claude/settings.local.json` разрешает, среди прочего:

- `Bash(git *)`;
- `Bash(pnpm *)`;
- `Bash(node *)`;
- `Bash(gh pr *)`;
- чтение всего `/Users/mac/**`.

Это позволяет выполнять гораздо больше, чем нужно обычной feature-задаче. Файл не находится в Git, поэтому policy ещё и не переносится между машинами.

Минимальное улучшение:

- read-only Git/GitHub команды разрешать шире;
- commit/push/merge/deploy оставлять отдельными approval boundaries;
- убрать глобальный `Read(/Users/mac/**)`;
- вместо `node *`/`pnpm *` разрешать конкретные project scripts;
- destructive и production-команды всегда подтверждать отдельно.

*(Отложено — низкий риск, локальный файл вне git.)*

### 8. Startup selection устарел относительно реального backlog

Startup workflow требует выбирать issue из «current week's milestone». Но проект уже вышел за пяти-недельный roadmap, а важные открытые issues #155 и #157 не имеют milestone.

Лучше выбирать:

```text
ready-for-agent
→ priority
→ explicit dependencies/blockers
→ milestone, если он действительно активен
```

> **Применено (2026-07-23):** `AGENTS.md` § Session Start Workflow.

## Что стоит перенести из vibe-engineer

Не весь `.vibe`, а четыре идеи.

### 1. Verification Delta light

В каждом feature plan должна быть небольшая таблица:

| Claim / AC | Layer | Проверка | Blocking | Evidence |
|---|---|---|---|---|
| Пользователь открывает portal | integration | controller/service test | yes | CI |
| Portal реально работает | production | manual authenticated flow | yes | URL + timestamp |
| AI register не ухудшился | AI eval | batch subset | yes | baseline JSON |
| UI соответствует mockup | visual | screenshot review | yes | artifact path |

Это заставит спроектировать доказательства до реализации.

### 2. Lightweight Evidence Packet

Не нужна сложная Artifact v2 система. Достаточно одного JSON на feature/release:

```json
{
  "schemaVersion": 1,
  "issue": 273,
  "pr": 285,
  "gitSha": "d0342e9",
  "dirty": false,
  "proofBoundary": ["local", "ci", "production"],
  "environment": {
    "node": "22.15.0",
    "pnpm": "10.29.3"
  },
  "checks": [
    {
      "id": "unit",
      "status": "pass",
      "blocking": true,
      "exitCode": 0,
      "durationMs": 8400
    }
  ],
  "liveEvidence": {
    "langfuseTraceIds": [],
    "storyEvalIds": [],
    "screenshots": [],
    "notes": "Stripe Portal cancellation verified in production"
  }
}
```

Хранить только компактный JSON. Логи, видео и screenshots — в GitHub Actions artifacts/object storage, с URL и SHA-256.

### 3. Failure classification

Минимальный набор:

- `product_failure`;
- `test_failure`;
- `environment_failure`;
- `missing_prerequisite`;
- `flake_suspected`;
- `missing_evidence`.

Сегодняшняя проблема с pnpm тогда была бы одним `environment_failure`, а не шестью ложными красными checks.

### 4. Proof boundary

Каждый вывод должен говорить, что именно доказано:

- unit test → isolated code;
- integration test → локальные компоненты;
- E2E → локальный/staging user flow;
- LangFuse → конкретный LLM call;
- production manual check → живой public boundary.

Локальный green нельзя автоматически превращать в «работает в production».

*(Все четыре идеи — отложены как отдельный будущий Evidence Packet, см. process-evolution.md § Волна 9. Не внедрялись буквально.)*

## Приоритетный план

### P0 — сделать verification правдивым

1. Исправить диагностику и version preflight в `init.sh`.
2. Разделить quick/release/AI gates.
3. Развести `eval:text` evidence и `StoryEval` evidence.
4. Добавить минимальный evidence JSON с SHA, environment, commands и proof boundary.

### P1 — закрыть реальные release gaps

1. Реализовать #155: production builds + authenticated E2E.
2. Добавить migration/schema verification.
3. Автоматически прикладывать CI evidence к PR.
4. Сделать portable startup/verification scripts и тонкие Claude/Codex adapters.
5. Сузить локальные permissions.

### P2 — улучшить traceability без бюрократии

1. Добавить frontmatter в specs/plans: issue, status, approval date, supersedes, evidence path.
2. Связать acceptance criteria с verification items.
3. Добавить в AI baselines commit, реальные model IDs, config и trace IDs.
4. Измерять harness: re-review rounds, escaped defects, flakes, environment failures, время до green.

## Что я не рекомендую

Не стоит импортировать `vibe-engineer` в существующий StoryGrow или копировать полный Artifacts v2 workflow.

Не нужны:

- второй task tracker;
- `feature_list.json`;
- digest/append-only amendment для каждого маленького изменения;
- десятки новых skills;
- `.vibe` как параллельная структура;
- автономные параллельные агенты по умолчанию.

StoryGrow уже имеет хороший минималистичный skeleton. Нужен не новый harness, а усиление его самого слабого звена: **машинно-проверяемого evidence и честной классификации того, что именно было доказано**.

Файлы я не менял; рабочее дерево осталось чистым.
