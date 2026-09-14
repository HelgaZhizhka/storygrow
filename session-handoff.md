# Session Handoff

This file is **empty when no session was interrupted**.

Fill it only if you have to stop mid-feature and want the next session to pick up where you left off.

When the feature is done, **clear this file back to the empty template** (everything below the line).

---

## Feature: Suteev register refactor — фаза 0 сделана, фаза 1 не начата

**Branch:** `claude/suteev-fairy-tale-analysis-h80xc7` (8 коммитов над `main`,
последний `ac33ef7`; GitHub Issue ещё не заведён — завести и, по желанию,
переименовать ветку в `issue/<N>-suteev-register`).
**Objective:** пользователь выбирает цель и загружает фото ребёнка, а историю
«пишет Сутеев» — узнаваемый голос, каждый раз новая сказка.

**Status:**
- Анализ 19 сказок Сутеева и 8-фазный план: `docs/superpowers/specs/2026-09-13-suteev-register-refactor-design.md`. Читать первым, целиком.
- Фаза 0b (safety-ресерч) сделана и влита: ADR-0004 v2 draft в `docs/adr/0004-safe-conflict-boundary.md` (раздел «Amendment v2», статус Proposed, промпты НЕ применены), исследование в `docs/process/2026-09-safety-boundary-research.md`. Владелец принял границу v2.
- Фаза 0 сделана: `backend/src/scripts/lib/prose-metrics.ts` (+spec), `lib/eval-cases.ts` (`core` 14 / `full` 28 / `antagonist` 5), `eval:batch --set=…` печатает метрики, `eval:metrics --dir=…` считает их офлайн. Офлайн-baseline: `docs/process/eval-baselines/2026-09-14-prose-metrics-after2-367.json`. `./init.sh` зелёный (469 тестов).
- Живой baseline на `--set=full` НЕ снят: облачная сессия без ключей.
- Ни один промпт, экземпляр и схема ещё не тронуты.

**Key decisions (владелец, 2026-09-13/14):**
- Экземпляры переписать на КАЖДУЮ из 20 целей; каждый текст согласовать с владельцем до merge (PR по 3–4 штуки).
- Все промпты (Plan, Prose, Title, Judge) переписать и каждый согласовать с владельцем.
- Safety: граница v2 принята — судим действие героя, не страшный элемент; сказочный антагонист разрешён, побеждён умом; запреты на действия героя абсолютны + три новых (не бьёт, никто не ранен/не гротескный, нет реалистичной катастрофы). Паттерн «компаньон платит за ослушание» НЕ включать.
- Flaw-дуга: порок у компаньона по умолчанию, у ребёнка только по выбору родителя в UI. Ребёнок остаётся героем на каждой странице в одной из трёх ролей (свидетель-помощник / судья / контраст); правило «ребёнок действует, а не оценивает».
- Масштабирование стилей: `register.ts` сразу как `StyleProfile {id, voice, world, title, engines, exemplarSet}` с единственной записью `suteev`; UI/БД/второй профиль не делать. Пушкин — прозаик, стихов не пишем. «Фэнтези» — ось `world`, не `voice`.
- Мораль уходит из уст ребёнка: финальная страница = сцена, урок в родительский блок (фаза 3; продуктовое решение о том, где показывать `parentNote`, ещё не принято).

**Assumptions:** live-прогон antagonist-проб при текущем правиле 7 либо теряет антагониста, либо валит safety (ожидаемо, это регрессия для v2). Доля диалога уже 51 % — проблема в однообразии реплик и отсутствии голосов, а не в количестве.

**Rejected paths:** стилевой RAG по Сутееву (авторское право, приёмов ~15, помещаются в промпт); fine-tuning; лечить тик «X? Не X?» ещё одним запретом (источник — обязательный бит «Внутренняя борьба» и экземпляры 3–4).

**Blockers:** нет ключей в облаке → живой baseline и все последующие прогоны вести с машины владельца.

**Next steps:**
1. С машины владельца: `pnpm --filter backend eval:batch --set=full --out=docs/process/eval-baselines/2026-09-14-full-before.json --stories-out=docs/process/eval-baselines/2026-09-14-full-before-stories` (~$3, ~15 мин), закоммитить.
2. Фаза 1: `backend/src/ai/prompts/register.ts` (StyleProfile + каталог приёмов с микроцитатами из Приложения А спека, отдельный `STYLE_3_4`), переписать Prose (правила 2, 4, 5, блок THE VOICE, время глаголов) и Judge `registerMatch` как чек-лист приёмов + safety-критерий 4 по ADR-0004 v2 + правило 7 Plan по v2. Каждый промпт → владельцу на ревью → live `eval:batch --set=full` → baseline after.
3. Фаза 2: `validators/prose-lint.validator.ts` на базе `prose-metrics.ts` (тик, формула урока, плотность имени, доля диалога) → в `buildRegenerationFeedback`.

**Evidence:** коммиты `8186612`…`ac33ef7`; `./init.sh` exit 0 на `ac33ef7`; офлайн-метрики after2: диалог 51 %, имя 0.56/предл., формула урока 10/14, тик 4/14, стоп-слово в названии 6/14, рефрен 1/14.

**Frictions:** облачная сессия без `.env` (нет живых прогонов, prisma generate требует фиктивный `DATABASE_URL`); ресерч-сессия шла на машине владельца и ветка стала видна только после push; JS `\b` не видит кириллицу (учтено в regex метрик).
