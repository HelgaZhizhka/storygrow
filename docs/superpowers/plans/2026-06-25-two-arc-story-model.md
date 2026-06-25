# Two-Arc Story Model + Earned-Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix banal story text by giving flaw-type learning goals a consequence-driven narrative arc, their own Gold Exemplars, and a judge criterion that penalizes unearned morals.

**Architecture:** Each `LearningGoal` is classified `virtue` or `flaw` (new DB enum). The story-generator prompt injects an arc-specific beat sheet and an arc-matched exemplar; flaw stories require a "Расплата" (consequence) beat and an earned resolution. A 7th judge criterion `earnedResolution` measures it. Stakes stay emotional/social — ADR-0004 (Safe Conflict) is preserved.

**Tech Stack:** NestJS, Prisma (PostgreSQL), Vercel AI SDK (`generateObject` + Zod), Jest, pnpm workspaces.

## Global Constraints

- Package manager: `pnpm` only (never npm/yarn). Backend commands: `pnpm --filter backend <script>`.
- TypeScript strict, no `any` (use `unknown` + Zod or explicit types). No `@ts-ignore`, no `console.log` in committed code (use the `logger` service).
- No magic prompt fragments — prompt constants live in `backend/src/ai/prompts/` as exported constants (CLAUDE.md rule 11).
- Files ≤ 400 lines; functions ≤ 30 lines and ≤ 3 params (use an object-parameter).
- Prisma migrations ONLY via the wrapper: `pnpm --filter backend prisma:migrate` (never raw `prisma migrate dev` — it drops the pgvector HNSW index).
- All LLM calls go through `generateObject` with a Zod schema (already true for the touched services).
- Conventional Commits for every commit: `type(area): subject`. NO `Co-Authored-By` trailer.
- Stakes/consequence in stories are EMOTIONAL/SOCIAL only — never physical danger (ADR-0004).
- Arc-type values are the string literals `'virtue'` and `'flaw'` everywhere (Prisma enum `LearningGoalArcType { virtue flaw }`, TS union `'virtue' | 'flaw'`).
- Flaw goal set (exactly these 6 titles): `Честность`, `Ответственность`, `Управление гневом`, `Бережное отношение к вещам`, `Терпение`, `Делиться с другими`. All other 14 goals are `virtue`.

---

### Task 1: `LearningGoal.arcType` — schema, migration, seed

**Files:**
- Modify: `backend/prisma/schema.prisma:155-164` (LearningGoal model + new enum)
- Modify: `backend/src/scripts/seed-learning-goals.ts`
- Create (generated): `backend/prisma/migrations/<timestamp>_add_learning_goal_arc_type/migration.sql`

**Interfaces:**
- Produces: Prisma enum `LearningGoalArcType` with members `virtue`, `flaw`; `LearningGoal.arcType: LearningGoalArcType` (default `virtue`). Generated Prisma client exports the type `$Enums.LearningGoalArcType`.

- [ ] **Step 1: Add the enum + field to the Prisma schema**

In `backend/prisma/schema.prisma`, add the enum near the other enums and the field to `LearningGoal`:

```prisma
enum LearningGoalArcType {
  virtue
  flaw
}

model LearningGoal {
  id            String              @id @default(cuid())
  title         String
  description   String
  arcType       LearningGoalArcType @default(virtue)
  ageRangeMin   Int                 @default(1)
  ageRangeMax   Int                 @default(18)
  createdAt     DateTime            @default(now())
  books         Book[]
  templates     Template[]
}
```

- [ ] **Step 2: Generate the migration via the wrapper**

Run: `pnpm --filter backend prisma:migrate --name add_learning_goal_arc_type`
Expected: a new folder `backend/prisma/migrations/<timestamp>_add_learning_goal_arc_type/` with `migration.sql` creating the enum type and adding the column with default `'virtue'`. The wrapper drops/recreates the HNSW index around the migration — that is expected.

- [ ] **Step 3: Append the flaw-goal backfill to the generated migration SQL**

The seed guard skips when goals already exist, so existing rows must be backfilled in the migration itself. Append to the generated `migration.sql`:

```sql
UPDATE "LearningGoal"
SET "arcType" = 'flaw'
WHERE "title" IN (
  'Честность',
  'Ответственность',
  'Управление гневом',
  'Бережное отношение к вещам',
  'Терпение',
  'Делиться с другими'
);
```

Re-apply with `pnpm --filter backend prisma:migrate` (it will detect the edited pending migration and apply it). If the migration was already marked applied, instead run the UPDATE once via `docker compose exec -T postgres psql -U storygrow -d storygrow -c "<the UPDATE above>"` and keep the statement in the migration file for fresh databases.

- [ ] **Step 4: Add `arcType` to the seed data so fresh seeds are correct**

In `backend/src/scripts/seed-learning-goals.ts`, give each of the 6 flaw goals `arcType: 'flaw'` and leave the other 14 to the schema default (or set `arcType: 'virtue'` explicitly for clarity). Minimal change — add the field to the 6 flaw entries, e.g.:

```ts
{
  title: 'Честность',
  description: 'Понимает, почему важно говорить правду даже когда это сложно.',
  arcType: 'flaw',
  ageRangeMin: 4,
  ageRangeMax: 10,
},
```

Do the same for `Ответственность`, `Управление гневом`, `Бережное отношение к вещам`, `Терпение`, `Делиться с другими`. The `createMany` data type now accepts `arcType` from the regenerated client.

- [ ] **Step 5: Verify the classification in the DB**

Run: `docker compose exec -T postgres psql -U storygrow -d storygrow -t -A -c "SELECT \"arcType\", count(*) FROM \"LearningGoal\" GROUP BY \"arcType\" ORDER BY 1;"`
Expected:
```
flaw|6
virtue|14
```

- [ ] **Step 6: Verify backend still compiles**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exit 0 (the regenerated Prisma client now knows `arcType`).

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/scripts/seed-learning-goals.ts backend/src/generated
git commit -m "feat(ai): add LearningGoal.arcType (virtue|flaw) with backfill + seed"
```

---

### Task 2: Flaw Gold Exemplars + arc-aware `pickExemplar`

**Files:**
- Modify: `backend/src/ai/prompts/exemplars.ts`
- Create: `backend/src/ai/prompts/exemplars.spec.ts`

**Interfaces:**
- Consumes: arc-type union `'virtue' | 'flaw'`.
- Produces: `Exemplar` interface now has `arcType: 'virtue' | 'flaw'`. `pickExemplar(goalTitle: string, arcType: 'virtue' | 'flaw'): Exemplar` — matches within the given arc, falls back to `HONESTY` for `flaw`, `COURAGE` for `virtue`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/ai/prompts/exemplars.spec.ts`:

```ts
import { pickExemplar } from './exemplars';

describe('pickExemplar', () => {
  it('routes a flaw goal to a flaw exemplar', () => {
    const ex = pickExemplar('Честность', 'flaw');
    expect(ex.arcType).toBe('flaw');
    expect(ex.text).toContain('[Расплата]');
  });

  it('routes Делиться с другими to a flaw exemplar (not KINDNESS)', () => {
    const ex = pickExemplar('Делиться с другими', 'flaw');
    expect(ex.arcType).toBe('flaw');
    expect(ex.goalTitles).toContain('Делиться с другими');
  });

  it('falls back to HONESTY for an unknown flaw goal', () => {
    const ex = pickExemplar('Неизвестная цель', 'flaw');
    expect(ex.arcType).toBe('flaw');
    expect(ex.goalTitles).toContain('Честность');
  });

  it('routes a virtue goal to a virtue exemplar', () => {
    const ex = pickExemplar('Смелость', 'virtue');
    expect(ex.arcType).toBe('virtue');
  });

  it('falls back to COURAGE for an unknown virtue goal', () => {
    const ex = pickExemplar('Неизвестная цель', 'virtue');
    expect(ex.arcType).toBe('virtue');
    expect(ex.goalTitles).toContain('Смелость');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter backend test -- exemplars.spec`
Expected: FAIL — `pickExemplar` currently takes one argument and `arcType` does not exist on `Exemplar`.

- [ ] **Step 3: Add `arcType` to the interface and tag existing exemplars**

In `backend/src/ai/prompts/exemplars.ts`, extend the interface:

```ts
export interface Exemplar {
  /** Learning-goal titles this exemplar best fits (matched case-insensitively). */
  readonly goalTitles: readonly string[];
  /** Which narrative arc this exemplar models. */
  readonly arcType: 'virtue' | 'flaw';
  /** The full gold story, formatted for few-shot injection. */
  readonly text: string;
}
```

Add `arcType: 'virtue'` to `COURAGE`, `KINDNESS`, `INDEPENDENCE`. Remove `'Делиться с другими'` from `KINDNESS.goalTitles` so it reads `['Доброта', 'Сочувствие', 'Забота о младших']`.

- [ ] **Step 4: Add the three flaw exemplars**

Add these three constants before `const EXEMPLARS`:

```ts
const HONESTY: Exemplar = {
  goalTitles: ['Честность'],
  arcType: 'flaw',
  text: `Название: «Гриша и хвостатая выдумка»  (тип конфликта: обман / доверие)
[Завязка] Гриша обожал рассказывать истории — да такие, что у всех глаза становились по блюдцу. То он видел рыбу размером с автобус, то говорящего голубя, то радугу прямо у себя в кармане. Друзья слушали, ахали… а Гриша придумывал всё новые небылицы.
[Проступок] Однажды он закричал на весь двор: «Бегите смотреть — на горке настоящий лев!» Ребята побросали игрушки и примчались со всех ног. А там — только рыжий кот Тимофей жмурился на солнышке. Гриша хохотал, а друзья почему-то совсем не смеялись.
[Расплата] На другой день Гриша нашёл во дворе щенка — крошечного, дрожащего, по-настоящему. «Скорее, тут щенок, ему нужна помощь!» — звал он. Но никто даже не обернулся. «Опять выдумываешь», — махнули рукой друзья и пошли дальше.
[Осознание] Гриша остался один рядом с дрожащим комочком. Внутри стало горячо и стыдно, а к горлу подкатил комок. Он понял: его словам больше не верят. И впервые на свете очень-очень захотел, чтобы поверили.
[Исправление] Тогда Гриша не стал кричать. Он осторожно взял щенка на руки, отнёс к ребятам и тихо сказал: «Я больше не шучу. Посмотрите сами». Друзья заглянули — а там и правда тёплый, живой щенок.
[Заслуженный финал] Вместе они напоили щенка и нашли его хозяйку. «Спасибо, что не бросил его», — сказала девочка. И друзья снова заулыбались Грише: теперь они знали — если он сказал, значит, так и есть. Доверие вернулось не сразу, но Гриша берёг его, как хрупкое стёклышко.
[Финал] Говорить правду важно, потому что тогда тебе верят, когда это нужнее всего.
Вопросы: 1. Какие истории придумывал Гриша? 2. Почему друзья не прибежали на зов про щенка? 3. Что Гриша почувствовал, оставшись один? 4. Как он вернул доверие друзей? 5. А почему важно, чтобы тебе верили?`,
};

const IMPULSE: Exemplar = {
  goalTitles: ['Управление гневом', 'Бережное отношение к вещам', 'Ответственность'],
  arcType: 'flaw',
  text: `Название: «Тошка и буря в стакане»  (тип конфликта: гнев / последствие)
[Завязка] Тошка был добрым и весёлым — но уж очень вспыльчивым. Если что-то шло не так, он краснел, пыхтел и взрывался, как чайник: топал ногами и махал руками. «Сейчас как разозлюсь!» — и буря готова.
[Проступок] Однажды башня из кубиков, которую он строил целое утро, возьми да и рассыпься. Тошка вскипел вмиг — и со всей силы пнул… но не башню, а любимый папин кораблик на полке. Хрясь! — тонкая мачта переломилась пополам.
[Расплата] Буря тут же стихла. Тошка смотрел на сломанный кораблик, и сердце ухнуло вниз. Это был папин самый дорогой кораблик, который они вместе красили прошлым летом. Никаким топотом и криком его теперь было не починить.
[Осознание] Тошка сел на пол и шмыгнул носом. Злость прошла, а грустно и стыдно осталось. Он понял: пока он бушевал, гнев сломал то, что он любил больше всего. И от этого было куда обиднее, чем от рассыпавшейся башни.
[Исправление] Тошка глубоко-глубоко вдохнул, как учила мама — «как воздушный шарик», — и злость потихоньку выпустил. Потом взял клей, нашёл ниточку для мачты и стал чинить кораблик, деталька за деталькой. Получалось не идеально, но он очень старался.
[Заслуженный финал] Вечером Тошка сам показал кораблик папе и всё рассказал. Папа обнял его: «Спасибо, что починил и не спрятал». Теперь, когда внутри поднималась буря, Тошка вспоминал шарик — и выдыхал её, прежде чем она что-нибудь сломает.
[Финал] Когда злишься — сначала выдохни, чтобы гнев не сломал то, что тебе дорого.
Вопросы: 1. На что был похож Тошка, когда злился? 2. Что он сломал в порыве гнева? 3. Что он почувствовал, когда буря стихла? 4. Как Тошка успокаивал злость? 5. А что помогает тебе, когда ты сердишься?`,
};

const WANTING: Exemplar = {
  goalTitles: ['Делиться с другими', 'Терпение'],
  arcType: 'flaw',
  text: `Название: «Лиза и гора конфет»  (тип конфликта: жадность / последствие)
[Завязка] Лизе подарили целую гору разноцветных конфет — блестящих, шуршащих, самых вкусных на свете. «Это всё моё-моё-моё!» — решила Лиза и спрятала их поглубже в карман, подальше от друзей. Делиться? Вот ещё!
[Проступок] На площадке ребята звали её играть в «магазин». «У меня конфеты, мне и так весело», — фыркнула Лиза и уселась в сторонке грызть их одна. Одну, потом вторую, потом пятую… а друзья тем временем смеялись и бегали без неё.
[Расплата] Скоро конфеты приелись, во рту стало приторно, а играть одной оказалось ужасно скучно. Лиза подняла глаза — а её лучшая подружка уже угощает других печеньем, и все вместе хохочут. И никто-никто не зовёт Лизу.
[Осознание] Лизе стало пусто и одиноко, будто она сама себя посадила за высокий забор. Карман был полон конфет, а внутри — совсем невесело. Она поняла: жадничая, она осталась без самого вкусного — без друзей.
[Исправление] Тогда Лиза набрала полную горсть конфет, подошла к ребятам и, чуть смущаясь, протянула: «Угощайтесь! Давайте вместе». Рука немножко дрожала — отдавать своё сокровище было страшновато. Но она всё равно разжала ладошку.
[Заслуженный финал] Друзья обрадовались и тут же позвали Лизу в игру. Оказалось, конфеты куда вкуснее, когда хрустишь ими вместе и болтаешь обо всём на свете. Карман Лизы стал легче, а на душе — радостно и полно.
[Финал] Делиться — это здорово: радость, поделённая с друзьями, становится только больше.
Вопросы: 1. Что подарили Лизе? 2. Почему она не пошла играть с ребятами? 3. Что Лиза почувствовала, оставшись одна? 4. Что она сделала, чтобы всё исправить? 5. А чем ты любишь делиться с друзьями?`,
};
```

- [ ] **Step 5: Update the EXEMPLARS list and `pickExemplar`**

```ts
const EXEMPLARS: readonly Exemplar[] = [COURAGE, KINDNESS, INDEPENDENCE, HONESTY, IMPULSE, WANTING];

/**
 * Pick the exemplar whose goal list contains the given title, within the
 * requested arc. Falls back to the canonical exemplar of that arc:
 * HONESTY for flaw, COURAGE for virtue.
 */
export const pickExemplar = (goalTitle: string, arcType: 'virtue' | 'flaw'): Exemplar => {
  const normalized = goalTitle.trim().toLowerCase();
  const inArc = EXEMPLARS.filter((e) => e.arcType === arcType);
  const match = inArc.find((e) => e.goalTitles.some((t) => t.toLowerCase() === normalized));
  if (match) return match;
  return arcType === 'flaw' ? HONESTY : COURAGE;
};
```

Update the file's top doc comment to mention both arcs.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter backend test -- exemplars.spec`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/ai/prompts/exemplars.ts backend/src/ai/prompts/exemplars.spec.ts
git commit -m "feat(ai): add flaw-arc gold exemplars + arc-aware pickExemplar"
```

---

### Task 3: Arc-aware story-generator prompt

**Files:**
- Modify: `backend/src/ai/prompts/story-generator.prompt.ts`
- Create: `backend/src/ai/prompts/story-generator.prompt.spec.ts`

**Interfaces:**
- Consumes: `pickExemplar(goalTitle, arcType)` from Task 2.
- Produces: `BuildStoryPromptOptions` gains `arcType: 'virtue' | 'flaw'`. Exports `BEAT_SHEETS: Record<'virtue' | 'flaw', string>`. `buildStoryUserPrompt(opts)` injects the arc-correct beat sheet + exemplar.

- [ ] **Step 1: Write the failing test**

Create `backend/src/ai/prompts/story-generator.prompt.spec.ts`:

```ts
import { buildStoryUserPrompt, BuildStoryPromptOptions } from './story-generator.prompt';

const base: BuildStoryPromptOptions = {
  childName: 'Коля',
  childAge: 5,
  topic: 'Честность',
  learningGoal: 'Понимает, почему важно говорить правду.',
  allowedWords: ['правда', 'друг', 'сказал'],
  protagonistMode: 'child',
  arcType: 'flaw',
};

describe('buildStoryUserPrompt arc routing', () => {
  it('flaw arc injects the consequence beat sheet and earned-resolution rule', () => {
    const out = buildStoryUserPrompt(base);
    expect(out).toContain('Расплата');
    expect(out).toContain('заслуженн'); // earned resolution wording
    expect(out).toContain('[Расплата]'); // the flaw exemplar is injected
  });

  it('virtue arc injects the virtue beat sheet', () => {
    const out = buildStoryUserPrompt({ ...base, topic: 'Смелость', arcType: 'virtue' });
    expect(out).toContain('Внутренняя борьба');
    expect(out).not.toContain('[Расплата]');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter backend test -- story-generator.prompt.spec`
Expected: FAIL — `arcType` is not a property of `BuildStoryPromptOptions`.

- [ ] **Step 3: Add `BEAT_SHEETS` and the structure builder**

In `backend/src/ai/prompts/story-generator.prompt.ts`, replace the static `BOOK_STRUCTURE_RULES` const with arc-aware constants. Add:

```ts
// ─── Arc beat sheets ─────────────────────────────────────────────────────────

export const BEAT_SHEETS: Record<'virtue' | 'flaw', string> = {
  virtue: `Narrative arc for THIS story — VIRTUE-ACQUISITION (the hero gains a good
quality through effort). Encode these beats across the content pages, in order:
    1. Завязка — introduce the hero and their world.
    2. Конфликт — a challenge appears that calls for the quality.
    3. Внутренняя борьба — the hero hesitates or struggles inside.
    4. Поворот — the hero gathers themselves and tries.
    5. Развязка — the hero succeeds by acting on the quality (show it).
    6. Закрепление через действие — the change is shown in what the hero now does.`,
  flaw: `Narrative arc for THIS story — FLAW-CONSEQUENCE (a flaw backfires, then is
repaired at a cost). Encode these beats across the content pages, in order:
    1. Завязка — introduce the hero and their flaw, shown in action, charmingly
       (the flaw looks harmless or even fun). Do NOT preach.
    2. Проступок — the flaw plays out (the hero lies / breaks a promise / lashes
       out / is careless / hoards / cannot wait). Still feels consequence-free.
    3. Расплата — THE FLAW COSTS THE HERO SOMETHING. The price is EMOTIONAL or
       SOCIAL, never physical danger: e.g. lied → now no one believes a truth
       that matters; lashed out → broke a thing he loved; hoarded → left alone.
    4. Осознание — the hero feels the cost; the low point; show the feeling.
    5. Исправление — the hero DOES something to make it right (effort, not a free
       pass).
    6. Заслуженный финал — it mends BECAUSE the hero tried. NO instant or
       unconditional forgiveness, NO unearned reward.`,
};

const buildBookStructureRules = (arcType: 'virtue' | 'flaw'): string => `Book structure requirements:
  • Minimum 6 pages, maximum 12 pages.
  • Page 1: 'cover' (title only — no text body on the cover).
  • Pages 2–(N-1): content pages. ${BEAT_SHEETS[arcType]}
  • Last page: 'final' — state the lesson exactly ONCE, in one short simple
    sentence, in the page's 'text' field; discussion questions go in the
    top-level 'discussionQuestions' array.${
      arcType === 'flaw'
        ? `\n  • FLAW RULE: the flaw MUST visibly cost the hero (the Расплата beat is
    mandatory), and the resolution MUST be earned by the hero's own effort —
    instant or unconditional forgiveness is forbidden.`
        : ''
    }`;
```

- [ ] **Step 4: Add `arcType` to the options and use it in `buildStoryUserPrompt`**

In `BuildStoryPromptOptions`, add:

```ts
  /** Narrative arc for this learning goal: 'virtue' (acquire a quality) or 'flaw' (a flaw backfires). */
  arcType: 'virtue' | 'flaw';
```

In `buildStoryUserPrompt`, replace the `${BOOK_STRUCTURE_RULES}` interpolation with `${buildBookStructureRules(opts.arcType)}` and change the exemplar call from `pickExemplar(topic)` to `pickExemplar(topic, opts.arcType)`. Add one line to the "Storytelling" brief:

```
  • The story must have real STAKES — the listener should feel something is at
    risk (a friend's trust, a treasured thing, not being believed) before the
    resolution. The resolution is EARNED, never given for free.
```

- [ ] **Step 5: Generalize system-prompt rule 4**

In `STORY_SYSTEM_PROMPT`, change rule 4 to:

```
4. The narrative arc MUST follow the beat sheet given in the user prompt (it
   depends on the story's arc type), encoded in the order of pages.
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter backend test -- story-generator.prompt.spec`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/ai/prompts/story-generator.prompt.ts backend/src/ai/prompts/story-generator.prompt.spec.ts
git commit -m "feat(ai): inject arc-specific beat sheet + earned-resolution rule into story prompt"
```

---

### Task 4: Thread `arcType` through the generation pipeline

**Files:**
- Modify: `backend/src/ai/story-generator/story-generator.service.ts` (`GenerateStoryInput`)
- Modify: `backend/src/ai/story-generator/story-orchestrator.service.ts` (`GenerateStoryOptions`)
- Modify: `backend/src/generation/generation.processor.ts` (select `arcType`, type, pass-through)
- Test: `backend/src/ai/story-generator/story-generator.service.spec.ts` (assert arcType reaches the prompt)

**Interfaces:**
- Consumes: `BuildStoryPromptOptions.arcType` (Task 3); `LearningGoal.arcType` from the DB (Task 1).
- Produces: `GenerateStoryInput` and `GenerateStoryOptions` both carry `arcType: 'virtue' | 'flaw'`.

- [ ] **Step 1: Write the failing test**

In `backend/src/ai/story-generator/story-generator.service.spec.ts`, add a test that the service forwards `arcType` into the user prompt. If the spec mocks the `ai` SDK's `generateObject`, assert the `prompt` it receives contains the flaw beat. Add:

```ts
it('passes arcType through to the user prompt', async () => {
  // generateObjectMock is the existing jest mock of `ai`.generateObject in this spec
  generateObjectMock.mockResolvedValue({ object: { pages: [], title: 't', characterProfile: '', discussionQuestions: [] } });
  const service = new StoryGeneratorService(configStub);
  await service.generateStory({
    childName: 'Коля', childAge: 5, topic: 'Честность',
    learningGoal: 'g', bookId: 'b', allowedWords: ['правда'],
    protagonistMode: 'child', arcType: 'flaw',
  });
  const call = generateObjectMock.mock.calls[0][0] as { prompt: string };
  expect(call.prompt).toContain('Расплата');
});
```

Match the existing spec's mock/stub names (`generateObjectMock`, `configStub`) — read the file first and reuse its setup rather than inventing new fixtures.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter backend test -- story-generator.service.spec`
Expected: FAIL — `GenerateStoryInput` has no `arcType` (tsc error) and/or the prompt lacks the beat.

- [ ] **Step 3: Add `arcType` to `GenerateStoryInput`**

In `story-generator.service.ts`, add to `GenerateStoryInput`:

```ts
  arcType: 'virtue' | 'flaw';
```

`buildStoryUserPrompt(input)` already receives the whole input, so no other change in this file.

- [ ] **Step 4: Add `arcType` to `GenerateStoryOptions` and forward it**

In `story-orchestrator.service.ts`, add `arcType: 'virtue' | 'flaw';` to `GenerateStoryOptions`. The `runLoop` already spreads `...ctx.opts` into `generateStory`, so `arcType` flows through automatically — no further change.

- [ ] **Step 5: Select and pass `arcType` in the processor**

In `generation.processor.ts`:
- Update the `learningGoal` shape in the `BookWithRelations`/local type (line ~21) to include `arcType: 'virtue' | 'flaw'` (or `$Enums.LearningGoalArcType`).
- In `fetchBook`'s select (line ~161), change `learningGoal: { select: { title: true, description: true } }` to also select `arcType: true`.
- In the `orchestrator.generate({...})` call (line ~71), add `arcType: book.learningGoal.arcType,`.

- [ ] **Step 6: Run the test + tsc to verify**

Run: `pnpm --filter backend test -- story-generator.service.spec && pnpm --filter backend exec tsc --noEmit`
Expected: test PASS, tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add backend/src/ai/story-generator/story-generator.service.ts backend/src/ai/story-generator/story-orchestrator.service.ts backend/src/generation/generation.processor.ts backend/src/ai/story-generator/story-generator.service.spec.ts
git commit -m "feat(ai): thread LearningGoal.arcType through generation pipeline"
```

---

### Task 5: 7th judge criterion `earnedResolution` + lenient dashboard aggregation

**Files:**
- Modify: `backend/src/ai/schemas/judge.schema.ts`
- Create: `backend/src/ai/schemas/judge.schema.spec.ts`
- Modify: `backend/src/ai/prompts/judge.prompt.ts`
- Modify: `backend/src/admin/admin-books.controller.ts:90-112` (lenient parse + per-key counts)

**Interfaces:**
- Consumes: nothing new.
- Produces: `JudgeScoreSchema` has 7 keys incl. `earnedResolution`. `computeFinalScore` averages all 7. Dashboard counts each criterion only over rows that contain it.

- [ ] **Step 1: Write the failing test**

Create `backend/src/ai/schemas/judge.schema.spec.ts`:

```ts
import { JudgeScoreSchema, computeFinalScore } from './judge.schema';

describe('JudgeScoreSchema', () => {
  const full = {
    ageAppropriateVocab: 8, hasMoralLesson: 8, structureCompleteness: 8,
    safetyForChildren: 10, length: 8, engagement: 7, earnedResolution: 6,
  };

  it('requires the earnedResolution criterion', () => {
    const { earnedResolution, ...withoutNew } = full;
    expect(JudgeScoreSchema.safeParse(withoutNew).success).toBe(false);
    expect(JudgeScoreSchema.safeParse(full).success).toBe(true);
  });

  it('computeFinalScore averages all seven criteria', () => {
    // (8+8+8+10+8+7+6)/7 = 7.857... → 7.86
    expect(computeFinalScore(full)).toBeCloseTo(7.86, 2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter backend test -- judge.schema.spec`
Expected: FAIL — `earnedResolution` not on the schema.

- [ ] **Step 3: Add the criterion to the schema**

In `judge.schema.ts`, add to `JudgeScoreSchema` after `engagement`:

```ts
  /**
   * The moral is EARNED, not asserted. There is a real stake/consequence in the
   * story (the hero's flaw costs them something, or success is genuinely at
   * risk), and the resolution follows from the protagonist's own action — not
   * from instant/unconditional forgiveness, luck, or a stated maxim. Penalise
   * heavily (≤4) a story where the lesson is simply announced at the end with no
   * preceding cost, or where the hero is forgiven/rewarded without effort.
   */
  earnedResolution: scoreField(),
```

`computeFinalScore` uses `Object.values` and needs no change. Update the `JudgeScoreSchema` doc comment ("six" → "seven") and the `JudgeSchema.finalScore` comment ("all six" → "all seven").

- [ ] **Step 4: Run the schema test to verify it passes**

Run: `pnpm --filter backend test -- judge.schema.spec`
Expected: PASS (2 tests).

- [ ] **Step 5: Update the judge prompt**

In `judge.prompt.ts`, change "exactly six criteria" → "exactly seven criteria", "mean of the six" → "mean of the seven", and add criterion 7:

```
7. earnedResolution — the moral is EARNED by the plot, not asserted. There must be a real stake or consequence (for a flaw story: the flaw visibly costs the hero before it is fixed), and the ending must follow from what the hero DOES. Score low (≤4) if the lesson is just stated at the end with no preceding cost, if the hero is forgiven or rewarded instantly with no effort, or if conflict resolves by luck rather than the hero's action.
```

- [ ] **Step 6: Make the dashboard aggregation tolerate 6-key historical rows**

In `admin-books.controller.ts`, `computeMeanCriterionScores` currently does `JudgeScoreSchema.safeParse` (now requires 7 keys), so old 6-key rows are dropped entirely. Change it to count each criterion only over rows that contain it, using a lenient parse:

```ts
function computeMeanCriterionScores(
  evals: { judgeScores: unknown; passed: boolean }[],
): Record<string, number> {
  const passedEvals = evals.filter((e) => e.passed);
  const lenient = JudgeScoreSchema.partial();
  const sums = Object.fromEntries(JUDGE_CRITERIA.map((k) => [k, 0]));
  const counts = Object.fromEntries(JUDGE_CRITERIA.map((k) => [k, 0]));

  for (const evalRow of passedEvals) {
    const parsed = lenient.safeParse(evalRow.judgeScores);
    if (!parsed.success) continue;
    for (const key of JUDGE_CRITERIA) {
      const v = parsed.data[key];
      if (typeof v === 'number') {
        sums[key] = (sums[key] ?? 0) + v;
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }

  return Object.fromEntries(
    JUDGE_CRITERIA.map((k) => {
      const c = counts[k] ?? 0;
      return [k, c === 0 ? 0 : Math.round(((sums[k] ?? 0) / c) * 100) / 100];
    }),
  );
}
```

- [ ] **Step 7: Run backend tests + tsc**

Run: `pnpm --filter backend test -- judge && pnpm --filter backend exec tsc --noEmit`
Expected: judge schema tests PASS, tsc exit 0.

- [ ] **Step 8: Commit**

```bash
git add backend/src/ai/schemas/judge.schema.ts backend/src/ai/schemas/judge.schema.spec.ts backend/src/ai/prompts/judge.prompt.ts backend/src/admin/admin-books.controller.ts
git commit -m "feat(ai): add earnedResolution judge criterion (7th) + lenient metrics aggregation"
```

---

### Task 6: Docs sync

**Files:**
- Modify: `docs/adr/0004-safe-conflict-boundary.md`
- Modify: `CONTEXT.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/defense/qa-prep.md` (Q2)
- Modify: `docs/defense/staged-books.md`
- Modify: `progress.md`

**Interfaces:** none (documentation).

- [ ] **Step 1: ADR-0004 clarification**

Add a short note to `docs/adr/0004-safe-conflict-boundary.md` (Consequences or a new "Clarification" subsection): real stakes/consequence are *required* for an engaging story; "consequence" here is EMOTIONAL/SOCIAL (loss of trust, a treasured thing broken, being left out) and is **not** the same as the forbidden physical danger. Safe Conflict forbids physical danger, not stakes.

- [ ] **Step 2: CONTEXT.md — arcs + criterion**

Document the two arc types (virtue-acquisition vs flaw-consequence), how goals are classified (`LearningGoal.arcType`), and the `earnedResolution` judge criterion. Place near the existing "Gold Exemplar" / judge-criteria entries.

- [ ] **Step 3: ARCHITECTURE.md — arc routing**

In the story-generation pipeline description, note that the orchestrator passes `LearningGoal.arcType` into the prompt builder, which selects an arc-specific beat sheet and a matching Gold Exemplar.

- [ ] **Step 4: qa-prep.md Q2 — 6 → 7 criteria**

Update Q2's criteria list to seven, adding `earnedResolution` ("мораль заработана сюжетом, а не объявлена; у недостатка есть расплата").

- [ ] **Step 5: staged-books.md — 6 → 7 note**

Update the re-stage warning: StoryEval now holds **7** criteria. The fallback book must be regenerated under the 7-criteria pipeline before defense.

- [ ] **Step 6: progress.md — record verified state**

Add an entry: issue #188, two-arc story model + earnedResolution, what was changed, and that a live flaw-goal regeneration verified the consequence beat.

- [ ] **Step 7: Commit**

```bash
git add docs CONTEXT.md progress.md
git commit -m "docs: two-arc story model + earnedResolution criterion (#188)"
```

---

### Task 7: Verify — `./init.sh` + live flaw-goal regeneration

**Files:** none (verification only).

- [ ] **Step 1: Full smoke check**

Run: `./init.sh`
Expected: exit 0 (tsc + lint + tests green across the workspace). If the frontend `next build` would run while a dev server is up, stop the dev server first per project rules.

- [ ] **Step 2: Live regeneration of a flaw-goal book**

With backend + frontend + docker running, generate a new book for a flaw goal (e.g. Честность, age 5) via the UI or API. Confirm:
- The story contains a visible consequence (the flaw costs the hero) and an earned resolution (no instant forgiveness).
- A `StoryEval` row is written with a `judgeScores.earnedResolution` value:
  `docker compose exec -T postgres psql -U storygrow -d storygrow -t -A -c "SELECT \"judgeScores\"->>'earnedResolution' FROM \"StoryEval\" ORDER BY \"createdAt\" DESC LIMIT 1;"`
  Expected: a non-empty integer 0–10.
- LangFuse shows the story-generator and story-evaluator traces for the new book.

- [ ] **Step 3: Open a PR**

```bash
git push -u origin issue/188-two-arc-story-model
gh pr create --title "feat(ai): two-arc story model + earned-resolution to fix banal story text" --body "Closes #188"
```
