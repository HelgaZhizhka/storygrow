# Suteev — owner's notes on what makes a good StoryGrow story

**Purpose:** capture the OWNER'S (HelgaZhizhka) own judgments from the
2026-09-13/15 conversation about the Suteev register refactor — the part that
did not fully land in the committed spec. The spec
(`docs/superpowers/specs/2026-09-13-suteev-register-refactor-design.md`, on
branch `claude/suteev-fairy-tale-analysis-h80xc7`) holds the analysis and the
8-phase plan; this file holds HER wording and decisions.

**Honesty note (read this):** the owner communicated in short Russian messages.
Most of the *per-tale* analysis and the catalogue of devices was MINE, produced
and shown to her; she reacted, prioritized and decided. Below, everything under
"Owner, verbatim" is her exact wording (Russian, as typed, including typos).
Everything else is my inference from what she chose to emphasize or approve —
labelled as such. I have NOT invented opinions for her. Where she did not say
something, I say so.

---

## 1. What the owner actually said (verbatim)

Her exact messages this conversation, in order. Typos are hers; kept on purpose
so the wording is not "cleaned up".

**Opening ask (the seed of everything):**
> «Вот прочитай эту сказку Сутеева, проанализируй ее текст. И посмотри тексты
> которые мы генерим сейчас . Что ты можешь сказать?»

The tale she sent was **«Мешок яблок»** (link:
https://deti-online.com/skazki/skazki-suteeva/meshok-yablok/). This is the ONE
tale she personally put forward. Then:
> «Поищи и почитай на том же сайте есть и другие сказки Сутеева. Проанализируй.
> Напиши анализ, что необходимо сделать , чтобы gold examples и промпты для
> генерации текста работали именно так, чтобы сказки были максимально похожими
> в его стиле но при этом уникальными. Предложи план рефактора … Чтобы в идеале
> было так, что пользователь выбрал цель, загрузил фото персонажа, и ему сам
> Сутеев написал историю»

**Her requirements on exemplars and prompts:**
> «1 - нам нужно переписать примеры на каждую цель и ты это написал в плане, это
> обязательно. каждый золотой пример согласовать со мной
> 2 необходимо переписать промпты все, и все эти пропмты также согласовать со
> мной, по поводу Safety-критерий судьи - возможно стоит его также переписать,
> может быть медведь или волк в целом в сказке это нормально, тут по
> безопасности ребенка нужно продумать именно то что не безопасно, тут нужно
> поресерчить, что уже используют в таких похожий приложениях, ведь на рынке уже
> давно есть такие приложения, может быть запустить отдельную независимую сессию
> для такого ресерча»

**On whose flaw it is (child hero vs companion):**
> «3. по поводу что порок - главный герой ребенок, то там мне понраивлась идея
> поставить изначально - другой персонаж, по умолчанию, но и оставить выбор -
> главный персонаж ребенок кстати, если будт главный персонаж у таких. скахок с
> пороком кто то другой, то сам ребенок там будет?»
>
> «в остально с планом согласна»

**On future styles / scaling:**
> «еще один момент, в перспектике у меня идея развивать и другие стили,
> например, чтобы можно было выбрать сказки в стиле Пушкина, Сутеева, фантази,
> или каких то других авторов, понимаешь? уже сейчас думать об этом
> машщтабировании? или потом?»
>
> «не стихи не будем писать, Пушкин вообзе то и прозу писал,»

**On the safety boundary research result:** after reading the v2 proposal she
replied simply:
> «да»

That is the complete set of her verbatim judgments. She did NOT write per-tale
love notes for tales other than sending «Мешок яблок»; the enthusiasm for the
other tales below is MY reading, presented to her and left standing (she did not
push back), not her stated opinion.

---

## 2. What "good" means to the owner — reading her signal

She never wrote a definition of "good". But her choices reveal a consistent
standard. Inferred from what she asked for and approved (my synthesis, not her
words):

1. **"Sam Suteev napisal" — an authorial voice, not a template.** Her north-star
   sentence is «чтобы … ему сам Сутеев написал историю». "Good" = a reader
   believes a real, beloved author wrote *this* book — warm, alive, funny — not
   that a machine filled a mould.
2. **Similar in style, yet unique every time.** Her exact tension:
   «максимально похожими в его стиле но при этом уникальными». Good is BOTH at
   once. Sameness across books is a defect to her even when each book is
   individually fine.
3. **She personally chose «Мешок яблок».** Whatever is special in that tale is
   the closest thing we have to her explicit target (see §3).
4. **Safety must be real, not a blunt ban.** She rejected the idea that a wolf
   or bear is automatically unsafe: «может быть медведь или волк в целом в
   сказке это нормально … продумать именно то что не безопасно». Good ≠
   sanitized-empty; good = safe about the *right* thing (a child imitating a
   real dangerous act), free about fairy-tale menace.
5. **Her child shouldn't be the one with the flaw, by default.** She liked the
   flaw sitting on another character by default, child hero kept clean — with an
   option to flip it. A parent's felt sense of "good" includes "my kid isn't the
   liar in the book."
6. **Quality is gated by HER eye.** She twice insisted every gold example and
   every prompt be approved by her before it lands. "Good" is owner-judged, not
   metric-judged — the LLM judge is calibrated on our own exemplars and only
   proves "on-register", not "delightful".

---

## 3. The target feel — «Мешок яблок» and the tales that echo it

**«Мешок яблок» is the owner's chosen exemplar of the target feel.** She sent it
first, unprompted. What is in it (MY analysis, shown to her, not disputed):

- The moral is **never spoken**. The tale ends on the Crow's line wondering how
  a full house of gifts came out of an empty sack — the child draws the lesson.
- **Conflict comes from the world**, not the hero's head: hungry kids at home, a
  nagging Crow, a Wolf at the tree, a storm, nightfall. Zero introspective
  monologue.
- **Chain-with-mirror structure:** the Hare gives to Bear, squirrels, Hedgehog,
  Goat, Mole; then all of them return gifts in the same order. Repetition with
  variation.
- **A populated world with distinct voices:** «Карр! Безобразие!», «Ничего
  яблочки! Освежают!», «Куда идёшь, Колючая Голова?» — nicknames, real adult
  characters, a comic antagonist-commentator (the Crow).
- **Real stakes, everyday scale:** hungry children, an empty sack, a storm, a
  Wolf — resolved without any child-imitable danger.
- **Concrete-noun pleasure:** «грибы и орехи, свёкла и капуста, мёд и репа,
  морковка и картошка».

The other tales I read on the same site that carry the same feel (my grouping,
offered to her as the models to aim at, per age band):

- **«Под грибом»** — the "widening shelter" chain; already the seed of our
  existing 3-4 exemplar «Юра и лист-домик». Kindness without a single "kindness
  is…" sentence.
- **«Кто сказал „мяу“?»** — the "quest with wrong answers": one question asked
  of animal after animal, each answer funny and wrong.
- **«Цыплёнок и Утёнок»** — the toddler "echo" ("Я тоже") with the refrain
  broken at the end; the model for 3-4 register.
- **«Три котёнка», «Петух и краски», «Кораблик», «Разные колёса», «Яблоко»** —
  each a clean example of one "structure engine" (transformation, quest, mocker,
  mirror, dispute) in the same warm voice.

Full analysis and the seven structure engines: see §2 of the spec on branch
`claude/suteev-fairy-tale-analysis-h80xc7`.

---

## 4. Strategy decisions the two of us reached

All confirmed by the owner (her approvals quoted in §1).

1. **Human-authored gold cores, one per goal.** Rewrite the gold exemplars — one
   per each of the 20 learning goals — hand-written in Suteev's manner (NOT
   AI-invented variations, which compound sameness). **Every exemplar is
   owner-approved before merge**, in batches of 3-4. This was her hard
   requirement, not a suggestion.
2. **Rewrite ALL prompts (Plan, Prose, Title, Judge), each owner-approved.**
3. **Structure as data ("engines"), voice as a device catalogue.** One Suteev
   voice; multiple plot machines (chain, mirror, quest, dispute, echo, mocker,
   mistaken) → same author, always a new story. Solves her «похоже, но
   уникально».
4. **Moral leaves the child's mouth.** Final page becomes a scene; the lesson
   goes to a parent-note / discussion block, at most one folk-idiom line from a
   side character. (Where exactly to surface the parent-note is still an open
   product decision.)
5. **Flaw on a companion by default, child hero stays clean, with a UI option to
   put it on the child.** The child remains the on-page hero in one of three
   Suteev roles (witness-helper / judge / contrast); rule: **the child acts, does
   not moralize.** Directly answers her question "будет ли сам ребёнок там" —
   yes, always on the page.
6. **Safety boundary rewritten from research (ADR-0004 v2).** Risk axis = an
   imitable real-world act by the hero, NOT the scary element. Fairy-tale
   antagonist (talking wolf/fox/bear, beaten by wit, left with nothing) is
   allowed; bans on the hero's own imitable acts stay absolute, plus three new
   bans (no blow by the hero, no on-page harm/grotesque, no realistic disaster).
   She approved this with «да». Research: `docs/process/2026-09-safety-boundary-research.md`
   and ADR-0004 v2 (both on the feature branch).
7. **Multi-style is a seam now, a feature later.** `register.ts` ships as a
   `StyleProfile {id, voice, world, title, engines, exemplarSet}` with one entry
   `suteev`; no UI/DB/second profile yet. Pushkin, when it comes, is a PROSE
   voice (her: "не стихи … Пушкин … прозу писал"); "fantasy" is a `world`, not a
   voice.
8. **Length.** 5-6 books sit at the bottom of Suteev's range (~150 words vs his
   300-750); raising page count / caps is deferred to a data-driven phase.

Delivery method she agreed to: **each phase = its own owner-reviewed PR**, live
`eval:batch` before/after, and a human read-through by her before merge (the LLM
judge proves on-register, not delightful).

---

## 5. Raw Suteev corpus — deliberately NOT committed (copyright)

The peer asked me to save the downloaded tale texts under
`docs/process/suteev-corpus/`. **I did not**, and recommend the main session
does not either. Reason: Suteev (d. 1993) is under copyright, and the project's
own rule — written into the spec and approved by the owner — is:

> «В репозиторий кладём только короткие цитаты для иллюстрации приёма. Экземпляры
> пишем свои, в его манере.»

Committing 20+ full tale texts would violate that stance. Instead, the tales
analyzed, each fetchable from deti-online.com
(`https://deti-online.com/skazki/skazki-suteeva/<slug>/`):

| Tale | slug | words | engine it best shows |
|---|---|---|---|
| Мешок яблок | `meshok-yablok` | ~760 | mirror (owner's pick) |
| Под грибом | `pod-gribom` | ~300 | chain / shelter |
| Кто сказал «мяу»? | `kto-skazal-myau` | ~500 | quest |
| Яблоко | `yabloko` | ~460 | dispute / judge |
| Цыплёнок и Утёнок | `cyplenok-i-utenok` | ~150 | echo (3-4) |
| Три котёнка | `tri-kotenka` | ~100 | transformation (3-4) |
| Петух и краски | `petuh-i-kraski` | ~90 | quest (3-4) |
| Кораблик | `korablik` | ~120 | mocker |
| Разные колёса | `raznye-kolesa` | ~400 | mirror / mocker |
| Палочка-выручалочка | `palochka-vyruchalochka` | ~760 | chain |
| Кот-рыболов | `kot-rybolov` | ~720 | mocker / greed |
| Дядя Миша | `dyadya-misha` | ~750 | chain / greed |
| Раз, два — дружно! | `raz-dva-druzhno` | ~600 | chain / teamwork |
| Бабочка | `babochka` | ~125 | mistaken |
| Мышонок и карандаш | `myshonok-i-karandash` | ~280 | mistaken |
| Капризная кошка | `kapriznaya-koshka` | ~276 | child + animal companion |
| Зайкин кораблик | `zaykin-korablik` | ~311 | chain / mocker |
| Это что за птица | `eto-chto-za-ptica` | ~453 | mirror / envy |
| Весной | `vesnoy` | ~121 | seasonal |
| Про Бегемота… прививок | `pro-begemota-kotoryy-boyalsya-privivok` | ~329 | fear (comic) |

Fetch pattern the analysis used: `curl -sSL https://deti-online.com/skazki/skazki-suteeva/<slug>/`
then strip HTML. Excluded as out-of-scope: «Терем-теремок» (folk retelling),
«Волшебный магазин», «Мы ищем кляксу» (long Baba-Yaga scenarios).

---

## 6. The single most important thing the owner is missing from the metrics

Her standard is **"would I enjoy reading this aloud to my child, and would I
believe Suteev wrote it?"** — a human, per-book judgment. The deterministic
metrics (dialogue share, name density, question tic, formula moral) and the LLM
judge both only catch *symptoms*. They are necessary, not sufficient. Every
phase must end with HER reading 4-6 stories aloud before merge. That is the
acceptance test she actually cares about.
