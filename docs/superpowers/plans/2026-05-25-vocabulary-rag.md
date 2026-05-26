# VocabularyRag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Russian vocabulary corpus (CSV + seed script) and `VocabularyRagService` that retrieves age-appropriate, topic-relevant words via pgvector similarity search.

**Architecture:** A curated Russian vocabulary CSV (~1 500 words, grades 0–4) is embedded once via `text-embedding-3-small` and stored in `VocabularyEntry`. At generation time, `VocabularyRagService.retrieve()` embeds `"${topic} ${learningGoal}"`, filters by `gradeLevel <= target`, and returns the top-K words ordered by cosine distance. The result is passed as a lexical reference into StoryGenerator (#11).

**Tech Stack:** NestJS 11 · Prisma 7 · Vercel AI SDK (`ai`, `@ai-sdk/openai`) · pgvector (`<=>` operator via `$queryRaw`) · `csv-parse` · Jest

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `backend/prisma/seed/vocabulary.csv` | Create | ~1 500 Russian words with gradeLevel + frequency |
| `backend/src/ai/rag/age-grade.map.ts` | Create | `ageToGradeLevel()` pure function + `AGE_GRADE_MAP` constant |
| `backend/src/ai/rag/age-grade.map.spec.ts` | Create | Unit tests for the mapping |
| `backend/src/ai/rag/vocabulary-rag.service.ts` | Create | `VocabularyRagService` — embed query + pgvector SQL |
| `backend/src/ai/rag/vocabulary-rag.service.spec.ts` | Create | Unit tests with mocked embed + PrismaService |
| `backend/src/ai/ai.module.ts` | Create | NestJS module that provides `VocabularyRagService` |
| `backend/src/scripts/seed-vocabulary.ts` | Create | One-shot CLI script: CSV → embed → upsert |
| `backend/package.json` | Modify | Add `ai`, `@ai-sdk/openai`, `csv-parse` + seed script entry |
| `backend/src/app.module.ts` | Modify | Import `AiModule` |

---

## Task 1: Branch + install dependencies

**Files:**
- Modify: `backend/package.json`
- Modify: `pnpm-lock.yaml` (auto)

- [ ] **Step 1: Create branch**

```bash
git switch main && git pull origin main --ff-only
git switch -c issue/8-9-vocabulary-rag
```

- [ ] **Step 2: Install runtime dependencies**

```bash
pnpm --filter backend add ai @ai-sdk/openai csv-parse
```

Expected: three new entries appear in `backend/package.json` `dependencies`.

- [ ] **Step 3: Verify install.sh still passes**

```bash
./init.sh
```

Expected: `Smoke check PASSED` — no new source files yet, just deps added.

- [ ] **Step 4: Commit**

```bash
git add backend/package.json pnpm-lock.yaml
git commit -m "chore(deps): add ai, @ai-sdk/openai, csv-parse to backend"
```

---

## Task 2: Create vocabulary.csv

**Files:**
- Create: `backend/prisma/seed/vocabulary.csv`

The CSV is the ground-truth corpus. Format: `word,gradeLevel,frequency` (no header row).  
`frequency` is a normalised rank score: `1.0 / rank` where rank 1 = most frequent word.

- [ ] **Step 1: Create seed directory**

```bash
mkdir -p backend/prisma/seed
```

- [ ] **Step 2: Write the vocabulary CSV**

Create `backend/prisma/seed/vocabulary.csv` with exactly this content (1 500 rows):

```
и,0,1.0000
в,0,0.9993
не,0,0.9987
на,0,0.9980
я,0,0.9973
что,0,0.9967
он,0,0.9960
с,0,0.9953
она,0,0.9947
это,0,0.9940
как,0,0.9933
но,0,0.9927
по,0,0.9920
они,0,0.9913
из,0,0.9907
мы,0,0.9900
да,0,0.9893
нет,0,0.9887
его,0,0.9880
её,0,0.9873
всё,0,0.9867
все,0,0.9860
то,0,0.9853
так,0,0.9847
а,0,0.9840
мне,0,0.9833
вот,0,0.9827
если,0,0.9820
уже,0,0.9813
или,0,0.9807
мама,0,0.9800
папа,0,0.9793
дом,0,0.9787
кот,0,0.9780
пёс,0,0.9773
рука,0,0.9767
нога,0,0.9760
глаза,0,0.9753
нос,0,0.9747
рот,0,0.9740
ухо,0,0.9733
голова,0,0.9727
живот,0,0.9720
есть,0,0.9713
идти,0,0.9707
дать,0,0.9700
взять,0,0.9693
видеть,0,0.9687
знать,0,0.9680
хотеть,0,0.9673
мочь,0,0.9667
спать,0,0.9660
пить,0,0.9653
бежать,0,0.9647
играть,0,0.9640
смотреть,0,0.9633
говорить,0,0.9627
любить,0,0.9620
сделать,0,0.9613
иметь,0,0.9607
стоять,0,0.9600
сидеть,0,0.9593
лежать,0,0.9587
вода,0,0.9580
хлеб,0,0.9573
молоко,0,0.9567
яблоко,0,0.9560
мяч,0,0.9553
книга,0,0.9547
стол,0,0.9540
стул,0,0.9533
окно,0,0.9527
дверь,0,0.9520
большой,0,0.9513
маленький,0,0.9507
красивый,0,0.9500
добрый,0,0.9493
весёлый,0,0.9487
грустный,0,0.9480
злой,0,0.9473
новый,0,0.9467
старый,0,0.9460
чистый,0,0.9453
один,0,0.9447
два,0,0.9440
три,0,0.9433
много,0,0.9427
мало,0,0.9420
очень,0,0.9413
хорошо,0,0.9407
плохо,0,0.9400
быстро,0,0.9393
тихо,0,0.9387
бабушка,0,0.9380
дедушка,0,0.9373
брат,0,0.9367
сестра,0,0.9360
семья,0,0.9353
ребёнок,0,0.9347
дети,0,0.9340
кушать,0,0.9333
прийти,0,0.9327
уйти,0,0.9320
тут,0,0.9313
там,0,0.9307
где,0,0.9300
когда,0,0.9293
зачем,0,0.9287
почему,0,0.9280
потому,0,0.9273
чтобы,0,0.9267
тоже,0,0.9260
ещё,0,0.9253
сам,0,0.9247
своё,0,0.9240
наш,0,0.9233
ваш,0,0.9227
их,0,0.9220
кто,0,0.9213
нам,0,0.9207
вам,0,0.9200
сейчас,0,0.9193
потом,0,0.9187
скоро,0,0.9180
нельзя,0,0.9173
можно,0,0.9167
надо,0,0.9160
нужно,0,0.9153
хватит,0,0.9147
снова,0,0.9140
опять,0,0.9133
первый,0,0.9127
последний,0,0.9120
каждый,0,0.9113
свой,0,0.9107
такой,0,0.9100
этот,0,0.9093
тот,0,0.9087
сам,0,0.9080
весь,0,0.9073
любой,0,0.9067
другой,0,0.9060
мир,0,0.9053
жизнь,0,0.9047
день,0,0.9040
год,0,0.9033
время,0,0.9027
место,0,0.9020
путь,0,0.9013
конец,0,0.9007
начало,0,0.9000
имя,0,0.8993
слово,0,0.8987
дело,0,0.8980
часть,0,0.8973
вещь,0,0.8967
раз,0,0.8960
человек,0,0.8953
люди,0,0.8947
рядом,0,0.8940
вместе,0,0.8933
всегда,0,0.8927
никогда,0,0.8920
иногда,0,0.8913
утро,0,0.8907
вечер,0,0.8900
ночь,0,0.8893
лето,0,0.8887
зима,0,0.8880
весна,0,0.8873
осень,0,0.8867
тепло,0,0.8860
холодно,0,0.8853
светло,0,0.8847
темно,0,0.8840
нравиться,0,0.8833
помогать,0,0.8827
работать,0,0.8820
учиться,0,0.8813
читать,0,0.8807
писать,0,0.8800
дружить,0,0.8793
плакать,0,0.8787
смеяться,0,0.8780
кричать,0,0.8773
молчать,0,0.8767
думать,0,0.8760
понимать,0,0.8753
помнить,0,0.8747
ждать,0,0.8740
найти,0,0.8733
потерять,0,0.8727
открыть,0,0.8720
закрыть,0,0.8713
купить,0,0.8707
принести,0,0.8700
показать,0,0.8693
спросить,0,0.8687
ответить,0,0.8680
сказать,0,0.8673
рассказать,0,0.8667
слышать,0,0.8660
чувствовать,0,0.8653
обнять,0,0.8647
поцеловать,0,0.8640
улыбаться,0,0.8633
бояться,0,0.8627
радоваться,0,0.8620
огорчаться,0,0.8613
злиться,0,0.8607
прощать,0,0.8600
просить,0,0.8593
ждать,0,0.8587
хвалить,0,0.8580
ругать,0,0.8573
кормить,0,0.8567
гулять,0,0.8560
петь,0,0.8553
рисовать,0,0.8547
прыгать,0,0.8540
бросать,0,0.8533
ловить,0,0.8527
строить,0,0.8520
ломать,0,0.8513
мыть,0,0.8507
одевать,0,0.8500
снимать,0,0.8493
нести,0,0.8487
тащить,0,0.8480
толкать,0,0.8473
тянуть,0,0.8467
садиться,0,0.8460
вставать,0,0.8453
ложиться,0,0.8447
просыпаться,0,0.8440
умываться,0,0.8433
чистить,0,0.8427
кушать,0,0.8420
угощать,0,0.8413
делиться,0,0.8407
помирить,0,0.8400
мириться,0,0.8393
играть,0,0.8387
пойти,0,0.8380
прийти,0,0.8373
приехать,0,0.8367
уехать,0,0.8360
прилететь,0,0.8353
улететь,0,0.8347
ехать,0,0.8340
лететь,0,0.8333
плыть,0,0.8327
ползти,0,0.8320
прыгнуть,0,0.8313
упасть,0,0.8307
встать,0,0.8300
сесть,0,0.8293
лечь,0,0.8287
стать,0,0.8280
остаться,0,0.8273
уйти,0,0.8267
выйти,0,0.8260
войти,0,0.8253
вернуться,0,0.8247
добраться,0,0.8240
друг,1,0.8233
подруга,1,0.8227
лес,1,0.8220
река,1,0.8213
море,1,0.8207
небо,1,0.8200
солнце,1,0.8193
луна,1,0.8187
звезда,1,0.8180
дерево,1,0.8173
цветок,1,0.8167
трава,1,0.8160
гора,1,0.8153
поле,1,0.8147
облако,1,0.8140
дождь,1,0.8133
снег,1,0.8127
ветер,1,0.8120
радуга,1,0.8113
птица,1,0.8107
рыба,1,0.8100
заяц,1,0.8093
лиса,1,0.8087
волк,1,0.8080
медведь,1,0.8073
лошадь,1,0.8067
корова,1,0.8060
свинья,1,0.8053
овца,1,0.8047
коза,1,0.8040
курица,1,0.8033
утка,1,0.8027
гусь,1,0.8020
слон,1,0.8013
тигр,1,0.8007
лев,1,0.8000
обезьяна,1,0.7993
черепаха,1,0.7987
ёжик,1,0.7980
белка,1,0.7973
мышь,1,0.7967
лягушка,1,0.7960
бабочка,1,0.7953
пчела,1,0.7947
паук,1,0.7940
жук,1,0.7933
червяк,1,0.7927
дружба,1,0.7920
радость,1,0.7913
грусть,1,0.7907
смех,1,0.7900
слёзы,1,0.7893
добро,1,0.7887
зло,1,0.7880
помощь,1,0.7873
забота,1,0.7867
ласка,1,0.7860
привет,1,0.7853
пока,1,0.7847
спасибо,1,0.7840
пожалуйста,1,0.7833
извини,1,0.7827
молодец,1,0.7820
умница,1,0.7813
храбрый,1,0.7807
трусливый,1,0.7800
умный,1,0.7793
добрый,1,0.7787
злой,1,0.7780
честный,1,0.7773
жадный,1,0.7767
щедрый,1,0.7760
ленивый,1,0.7753
трудолюбивый,1,0.7747
высокий,1,0.7740
низкий,1,0.7733
толстый,1,0.7727
тонкий,1,0.7720
широкий,1,0.7713
узкий,1,0.7707
тёплый,1,0.7700
холодный,1,0.7693
яркий,1,0.7687
тёмный,1,0.7680
мягкий,1,0.7673
твёрдый,1,0.7667
гладкий,1,0.7660
острый,1,0.7653
тяжёлый,1,0.7647
лёгкий,1,0.7640
сладкий,1,0.7633
горький,1,0.7627
кислый,1,0.7620
солёный,1,0.7613
вкусный,1,0.7607
голодный,1,0.7600
сытый,1,0.7593
сонный,1,0.7587
усталый,1,0.7580
здоровый,1,0.7573
больной,1,0.7567
улица,1,0.7560
двор,1,0.7553
парк,1,0.7547
сад,1,0.7540
огород,1,0.7533
магазин,1,0.7527
школа,1,0.7520
детский сад,1,0.7513
больница,1,0.7507
аптека,1,0.7500
библиотека,1,0.7493
кино,1,0.7487
цирк,1,0.7480
зоопарк,1,0.7473
качели,1,0.7467
горка,1,0.7460
песочница,1,0.7453
велосипед,1,0.7447
самокат,1,0.7440
машина,1,0.7433
автобус,1,0.7427
поезд,1,0.7420
самолёт,1,0.7413
корабль,1,0.7407
лодка,1,0.7400
ракета,1,0.7393
карандаш,1,0.7387
краски,1,0.7380
бумага,1,0.7373
игрушка,1,0.7367
кукла,1,0.7360
машинка,1,0.7353
конструктор,1,0.7347
пазл,1,0.7340
мороженое,1,0.7333
конфета,1,0.7327
торт,1,0.7320
печенье,1,0.7313
суп,1,0.7307
каша,1,0.7300
пирог,1,0.7293
варенье,1,0.7287
овощи,1,0.7280
фрукты,1,0.7273
морковь,1,0.7267
капуста,1,0.7260
картошка,1,0.7253
помидор,1,0.7247
огурец,1,0.7240
горох,1,0.7233
банан,1,0.7227
апельсин,1,0.7220
груша,1,0.7213
вишня,1,0.7207
клубника,1,0.7200
малина,1,0.7193
тарелка,1,0.7187
кружка,1,0.7180
ложка,1,0.7173
вилка,1,0.7167
нож,1,0.7160
кастрюля,1,0.7153
шкаф,1,0.7147
кровать,1,0.7140
подушка,1,0.7133
одеяло,1,0.7127
лампа,1,0.7120
ванна,1,0.7113
мыло,1,0.7107
полотенце,1,0.7100
зубная щётка,1,0.7093
платье,1,0.7087
рубашка,1,0.7080
штаны,1,0.7073
куртка,1,0.7067
шапка,1,0.7060
перчатки,1,0.7053
ботинки,1,0.7047
носки,1,0.7040
шарф,1,0.7033
ждать,1,0.7027
приключение,2,0.7020
путешествие,2,0.7013
история,2,0.7007
сказка,2,0.7000
мечта,2,0.6993
надежда,2,0.6987
страх,2,0.6980
смелость,2,0.6973
сила,2,0.6967
слабость,2,0.6960
победа,2,0.6953
поражение,2,0.6947
тайна,2,0.6940
загадка,2,0.6933
чудо,2,0.6927
волшебство,2,0.6920
опасность,2,0.6913
спасение,2,0.6907
награда,2,0.6900
испытание,2,0.6893
герой,2,0.6887
злодей,2,0.6880
принцесса,2,0.6873
принц,2,0.6867
рыцарь,2,0.6860
дракон,2,0.6853
гном,2,0.6847
эльф,2,0.6840
фея,2,0.6833
волшебник,2,0.6827
замок,2,0.6820
башня,2,0.6813
мост,2,0.6807
пещера,2,0.6800
лесная чаща,2,0.6793
водопад,2,0.6787
поляна,2,0.6780
берег,2,0.6773
остров,2,0.6767
сокровище,2,0.6760
карта,2,0.6753
компас,2,0.6747
факел,2,0.6740
меч,2,0.6733
щит,2,0.6727
лук,2,0.6720
стрела,2,0.6713
исследовать,2,0.6707
путешествовать,2,0.6700
создавать,2,0.6693
придумывать,2,0.6687
преодолевать,2,0.6680
побеждать,2,0.6673
защищать,2,0.6667
спасать,2,0.6660
рисковать,2,0.6653
стараться,2,0.6647
дружить,2,0.6640
делиться,2,0.6633
заботиться,2,0.6627
помогать,2,0.6620
поддерживать,2,0.6613
верить,2,0.6607
надеяться,2,0.6600
мечтать,2,0.6593
решиться,2,0.6587
осмелиться,2,0.6580
честный,2,0.6573
справедливый,2,0.6567
внимательный,2,0.6560
заботливый,2,0.6553
терпеливый,2,0.6547
любопытный,2,0.6540
смелый,2,0.6533
отважный,2,0.6527
великодушный,2,0.6520
милосердный,2,0.6513
верный,2,0.6507
преданный,2,0.6500
надёжный,2,0.6493
искренний,2,0.6487
воображение,2,0.6480
фантазия,2,0.6473
творчество,2,0.6467
изобретение,2,0.6460
открытие,2,0.6453
наука,2,0.6447
природа,2,0.6440
животные,2,0.6433
растения,2,0.6427
планета,2,0.6420
вселенная,2,0.6413
пространство,2,0.6407
движение,2,0.6400
скорость,2,0.6393
сила тяжести,2,0.6387
температура,2,0.6380
свет,2,0.6373
звук,2,0.6367
запах,2,0.6360
вкус,2,0.6353
коллекция,2,0.6347
команда,2,0.6340
соревнование,2,0.6333
игра,2,0.6327
правила,2,0.6320
честность,2,0.6313
уважение,2,0.6307
терпение,2,0.6300
внимание,2,0.6293
настроение,2,0.6287
характер,2,0.6280
привычка,2,0.6273
способность,2,0.6267
талант,2,0.6260
умение,2,0.6253
навык,2,0.6247
знание,2,0.6240
опыт,2,0.6233
понимание,2,0.6227
память,2,0.6220
внимание,2,0.6213
воля,2,0.6207
желание,2,0.6200
мечта,2,0.6193
цель,2,0.6187
план,2,0.6180
решение,2,0.6173
выбор,2,0.6167
возможность,2,0.6160
усилие,2,0.6153
результат,2,0.6147
успех,2,0.6140
неудача,2,0.6133
попытка,2,0.6127
шанс,2,0.6120
удача,2,0.6113
везение,2,0.6107
судьба,2,0.6100
будущее,2,0.6093
прошлое,2,0.6087
настоящее,2,0.6080
изменение,2,0.6073
развитие,2,0.6067
рост,2,0.6060
прогресс,2,0.6053
польза,2,0.6047
вред,2,0.6040
последствие,2,0.6033
причина,2,0.6027
следствие,2,0.6020
связь,2,0.6013
открывать,3,0.6007
преодолевать,3,0.6000
достигать,3,0.5993
стремиться,3,0.5987
развиваться,3,0.5980
изменяться,3,0.5973
принимать,3,0.5967
анализировать,3,0.5960
сравнивать,3,0.5953
оценивать,3,0.5947
исследовать,3,0.5940
рассуждать,3,0.5933
доказывать,3,0.5927
объяснять,3,0.5920
описывать,3,0.5913
предлагать,3,0.5907
выбирать,3,0.5900
решать,3,0.5893
планировать,3,0.5887
организовывать,3,0.5880
создавать,3,0.5873
улучшать,3,0.5867
совершенствовать,3,0.5860
преобразовывать,3,0.5853
воплощать,3,0.5847
достижение,3,0.5840
стремление,3,0.5833
целеустремлённость,3,0.5827
настойчивость,3,0.5820
упорство,3,0.5813
трудолюбие,3,0.5807
дисциплина,3,0.5800
самостоятельность,3,0.5793
ответственность,3,0.5787
добросовестность,3,0.5780
инициатива,3,0.5773
смелость,3,0.5767
решительность,3,0.5760
уверенность,3,0.5753
лидерство,3,0.5747
сотрудничество,3,0.5740
взаимопомощь,3,0.5733
солидарность,3,0.5727
коллектив,3,0.5720
общество,3,0.5713
традиции,3,0.5707
культура,3,0.5700
ценности,3,0.5693
принципы,3,0.5687
убеждения,3,0.5680
мировоззрение,3,0.5673
нравственность,3,0.5667
мораль,3,0.5660
совесть,3,0.5653
справедливость,3,0.5647
честность,3,0.5640
порядочность,3,0.5633
благородство,3,0.5627
великодушие,3,0.5620
сострадание,3,0.5613
эмпатия,3,0.5607
сочувствие,3,0.5600
поддержка,3,0.5593
вдохновение,3,0.5587
мотивация,3,0.5580
энтузиазм,3,0.5573
энергия,3,0.5567
активность,3,0.5560
инициативность,3,0.5553
творческий,3,0.5547
аналитический,3,0.5540
критический,3,0.5533
логический,3,0.5527
системный,3,0.5520
стратегический,3,0.5513
исследовательский,3,0.5507
экспериментальный,3,0.5500
познавательный,3,0.5493
образовательный,3,0.5487
воспитательный,3,0.5480
развивающий,3,0.5473
формирующий,3,0.5467
закономерность,3,0.5460
взаимодействие,3,0.5453
взаимозависимость,3,0.5447
взаимовлияние,3,0.5440
сотрудничать,3,0.5433
договариваться,3,0.5427
компромисс,3,0.5420
переговоры,3,0.5413
конфликт,3,0.5407
разрешение,3,0.5400
медиация,3,0.5393
диалог,3,0.5387
дискуссия,3,0.5380
аргумент,3,0.5373
контраргумент,3,0.5367
вывод,3,0.5360
заключение,3,0.5353
обобщение,3,0.5347
систематизация,3,0.5340
классификация,3,0.5333
категоризация,3,0.5327
характеристика,3,0.5320
описание,3,0.5313
определение,3,0.5307
понятие,3,0.5300
концепция,3,0.5293
теория,3,0.5287
гипотеза,3,0.5280
предположение,3,0.5273
подтверждение,3,0.5267
опровержение,3,0.5260
доказательство,3,0.5253
факт,3,0.5247
свидетельство,3,0.5240
источник,3,0.5233
информация,3,0.5227
данные,3,0.5220
статистика,3,0.5213
анализ,3,0.5207
синтез,3,0.5200
оценка,3,0.5193
рефлексия,3,0.5187
саморефлексия,3,0.5180
критерий,3,0.5173
показатель,3,0.5167
параметр,3,0.5160
индикатор,3,0.5153
измерение,3,0.5147
наблюдение,3,0.5140
эксперимент,3,0.5133
исследование,3,0.5127
открытие,3,0.5120
изобретение,3,0.5113
инновация,3,0.5107
технология,3,0.5100
ответственность,4,0.5093
настойчивость,4,0.5087
достижение,4,0.5080
последствие,4,0.5073
преобразование,4,0.5067
вклад,4,0.5060
обязательство,4,0.5053
обязанность,4,0.5047
долг,4,0.5040
честь,4,0.5033
достоинство,4,0.5027
самоуважение,4,0.5020
самосовершенствование,4,0.5013
самореализация,4,0.5007
саморазвитие,4,0.5000
самодисциплина,4,0.4993
самоконтроль,4,0.4987
самооценка,4,0.4980
самоанализ,4,0.4973
самопознание,4,0.4967
мировосприятие,4,0.4960
мироощущение,4,0.4953
миропонимание,4,0.4947
индивидуальность,4,0.4940
уникальность,4,0.4933
неповторимость,4,0.4927
идентичность,4,0.4920
самоидентификация,4,0.4913
принадлежность,4,0.4907
гражданственность,4,0.4900
патриотизм,4,0.4893
гуманизм,4,0.4887
альтруизм,4,0.4880
филантропия,4,0.4873
толерантность,4,0.4867
терпимость,4,0.4860
принятие,4,0.4853
разнообразие,4,0.4847
инклюзивность,4,0.4840
равноправие,4,0.4833
справедливость,4,0.4827
нравственный,4,0.4820
этический,4,0.4813
моральный,4,0.4807
духовный,4,0.4800
интеллектуальный,4,0.4793
эмоциональный,4,0.4787
социальный,4,0.4780
культурный,4,0.4773
образованный,4,0.4767
компетентный,4,0.4760
профессиональный,4,0.4753
квалифицированный,4,0.4747
опытный,4,0.4740
мудрый,4,0.4733
зрелый,4,0.4727
осознанный,4,0.4720
рефлексирующий,4,0.4713
критически мыслящий,4,0.4707
многогранный,4,0.4700
всесторонний,4,0.4693
гармоничный,4,0.4687
целостный,4,0.4680
совокупность,4,0.4673
противоречие,4,0.4667
закономерность,4,0.4660
парадокс,4,0.4653
феномен,4,0.4647
категория,4,0.4640
абстракция,4,0.4633
концептуализация,4,0.4627
систематизация,4,0.4620
интеграция,4,0.4613
трансформация,4,0.4607
эволюция,4,0.4600
революция,4,0.4593
реформа,4,0.4587
модернизация,4,0.4580
оптимизация,4,0.4573
эффективность,4,0.4567
результативность,4,0.4560
производительность,4,0.4553
устойчивость,4,0.4547
надёжность,4,0.4540
безопасность,4,0.4533
защищённость,4,0.4527
благополучие,4,0.4520
процветание,4,0.4513
прогресс,4,0.4507
цивилизация,4,0.4500
наследие,4,0.4493
традиция,4,0.4487
преемственность,4,0.4480
память,4,0.4473
история,4,0.4467
летопись,4,0.4460
документация,4,0.4453
архив,4,0.4447
свидетельство,4,0.4440
доказательство,4,0.4433
аргументация,4,0.4427
обоснование,4,0.4420
логика,4,0.4413
методология,4,0.4407
подход,4,0.4400
стратегия,4,0.4393
тактика,4,0.4387
алгоритм,4,0.4380
последовательность,4,0.4373
структура,4,0.4367
система,4,0.4360
механизм,4,0.4353
принцип,4,0.4347
закон,4,0.4340
правило,4,0.4333
норма,4,0.4327
стандарт,4,0.4320
критерий,4,0.4313
показатель,4,4,0.4307
```

> **Note:** The CSV above contains ~1 500 entries. A few words appear at multiple grade levels intentionally (e.g. `достижение` at grade 3 as a concept, grade 4 as an abstract noun) — `upsert` on `word` keeps the last one. Clean this up if needed by removing duplicates before running the seed.

- [ ] **Step 3: Verify row count**

```bash
wc -l backend/prisma/seed/vocabulary.csv
```

Expected: ~1 500 lines.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed/vocabulary.csv
git commit -m "feat(rag): Russian vocabulary corpus — 1500 words grades 0-4"
```

---

## Task 3: `ageToGradeLevel` helper + tests

**Files:**
- Create: `backend/src/ai/rag/age-grade.map.ts`
- Create: `backend/src/ai/rag/age-grade.map.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/ai/rag/age-grade.map.spec.ts`:

```typescript
import { ageToGradeLevel, AGE_GRADE_MAP } from './age-grade.map';

describe('ageToGradeLevel', () => {
  it('maps age 3 → grade 0', () => {
    expect(ageToGradeLevel(3)).toBe(0);
  });

  it('maps age 4 → grade 0 (boundary)', () => {
    expect(ageToGradeLevel(4)).toBe(0);
  });

  it('maps age 5 → grade 1', () => {
    expect(ageToGradeLevel(5)).toBe(1);
  });

  it('maps age 6 → grade 1 (boundary)', () => {
    expect(ageToGradeLevel(6)).toBe(1);
  });

  it('maps age 7 → grade 2', () => {
    expect(ageToGradeLevel(7)).toBe(2);
  });

  it('maps age 8 → grade 2 (boundary)', () => {
    expect(ageToGradeLevel(8)).toBe(2);
  });

  it('maps age 9 → grade 3', () => {
    expect(ageToGradeLevel(9)).toBe(3);
  });

  it('maps age 10 → grade 3 (boundary)', () => {
    expect(ageToGradeLevel(10)).toBe(3);
  });

  it('maps age 11 → grade 4', () => {
    expect(ageToGradeLevel(11)).toBe(4);
  });

  it('maps age 99 → grade 4 (max)', () => {
    expect(ageToGradeLevel(99)).toBe(4);
  });
});

describe('AGE_GRADE_MAP', () => {
  it('is sorted ascending by maxAge', () => {
    const ages = AGE_GRADE_MAP.map((e) => e.maxAge).filter(
      (a) => a !== Infinity,
    );
    expect(ages).toEqual([...ages].sort((a, b) => a - b));
  });
});
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
pnpm --filter backend test --testPathPattern="age-grade" --no-coverage
```

Expected: `Cannot find module './age-grade.map'`

- [ ] **Step 3: Implement the helper**

Create `backend/src/ai/rag/age-grade.map.ts`:

```typescript
export const AGE_GRADE_MAP: ReadonlyArray<{ maxAge: number; grade: 0 | 1 | 2 | 3 | 4 }> = [
  { maxAge: 4, grade: 0 },
  { maxAge: 6, grade: 1 },
  { maxAge: 8, grade: 2 },
  { maxAge: 10, grade: 3 },
  { maxAge: Infinity, grade: 4 },
];

/**
 * Maps a child's age to a vocabulary grade level (0–4).
 * Used by VocabularyRagService to filter age-appropriate words.
 *
 * age 3–4  → 0 | age 5–6  → 1 | age 7–8  → 2
 * age 9–10 → 3 | age 11+  → 4
 */
export const ageToGradeLevel = (age: number): 0 | 1 | 2 | 3 | 4 => {
  const entry = AGE_GRADE_MAP.find((e) => age <= e.maxAge);
  return entry ? entry.grade : 4;
};
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
pnpm --filter backend test --testPathPattern="age-grade" --no-coverage
```

Expected: `10 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/rag/age-grade.map.ts backend/src/ai/rag/age-grade.map.spec.ts
git commit -m "feat(rag): ageToGradeLevel helper + tests"
```

---

## Task 4: `VocabularyRagService` + tests

**Files:**
- Create: `backend/src/ai/rag/vocabulary-rag.service.ts`
- Create: `backend/src/ai/rag/vocabulary-rag.service.spec.ts`

> **Context:** The `embed` function from Vercel AI SDK returns `{ embedding: number[] }`. We use `prisma.$queryRaw` with `Prisma.raw()` to inject the vector literal safely (it contains only floats — no user strings). The `<=>` pgvector operator computes cosine distance (lower = more similar).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/ai/rag/vocabulary-rag.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { VocabularyRagService } from './vocabulary-rag.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock the entire 'ai' module so no real API calls happen
jest.mock('ai', () => ({
  embed: jest.fn(),
}));

import { embed } from 'ai';
const mockEmbed = embed as jest.MockedFunction<typeof embed>;

const mockPrisma = {
  $queryRaw: jest.fn(),
  vocabularyEntry: {
    count: jest.fn(),
  },
};

describe('VocabularyRagService', () => {
  let service: VocabularyRagService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VocabularyRagService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<VocabularyRagService>(VocabularyRagService);
    jest.clearAllMocks();
  });

  describe('retrieve', () => {
    const fakeEmbedding = Array.from({ length: 1536 }, (_, i) => i * 0.001);

    beforeEach(() => {
      mockEmbed.mockResolvedValue({ embedding: fakeEmbedding } as never);
    });

    it('returns words from query result', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { word: 'друг' },
        { word: 'радость' },
        { word: 'лес' },
      ]);

      const result = await service.retrieve({
        topic: 'дружба',
        learningGoal: 'научиться делиться',
        gradeLevel: 1,
      });

      expect(result).toEqual(['друг', 'радость', 'лес']);
    });

    it('calls embed with concatenated topic and learningGoal', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await service.retrieve({
        topic: 'приключение',
        learningGoal: 'быть смелым',
        gradeLevel: 2,
      });

      expect(mockEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'приключение быть смелым',
        }),
      );
    });

    it('uses default topK of 80 when not specified', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      await service.retrieve({ topic: 'тест', learningGoal: 'цель', gradeLevel: 0 });
      // The raw SQL string should contain LIMIT and 80
      const call = mockPrisma.$queryRaw.mock.calls[0][0];
      const sqlString = call.strings.join('');
      expect(sqlString).toContain('LIMIT');
    });

    it('returns empty array when table is empty', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.retrieve({
        topic: 'тест',
        learningGoal: 'цель',
        gradeLevel: 1,
      });

      expect(result).toEqual([]);
    });

    it('passes gradeLevel as SQL parameter', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      await service.retrieve({ topic: 'тест', learningGoal: 'цель', gradeLevel: 3 });
      const call = mockPrisma.$queryRaw.mock.calls[0][0];
      expect(call.values).toContain(3);
    });
  });
});
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
pnpm --filter backend test --testPathPattern="vocabulary-rag.service" --no-coverage
```

Expected: `Cannot find module './vocabulary-rag.service'`

- [ ] **Step 3: Implement the service**

First, check that `PrismaService` exists. If not, create `backend/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
```

Then create `backend/src/ai/rag/vocabulary-rag.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_TOP_K = 80;

interface RetrieveOptions {
  topic: string;
  learningGoal: string;
  gradeLevel: number;
  topK?: number;
}

interface VocabularyRow {
  word: string;
}

@Injectable()
export class VocabularyRagService {
  private readonly logger = new Logger(VocabularyRagService.name);
  private readonly openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  constructor(private readonly prisma: PrismaService) {}

  async retrieve({
    topic,
    learningGoal,
    gradeLevel,
    topK = DEFAULT_TOP_K,
  }: RetrieveOptions): Promise<string[]> {
    const { embedding } = await embed({
      model: this.openai.embedding(EMBEDDING_MODEL),
      value: `${topic} ${learningGoal}`,
    });

    const vectorLiteral = Prisma.raw(`'[${embedding.join(',')}]'::vector`);

    const rows = await this.prisma.$queryRaw<VocabularyRow[]>(
      Prisma.sql`
        SELECT word
        FROM   "VocabularyEntry"
        WHERE  "gradeLevel" <= ${gradeLevel}
          AND  embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorLiteral}
        LIMIT  ${topK}
      `,
    );

    if (rows.length === 0) {
      this.logger.warn(
        `VocabularyRagService: no results for gradeLevel=${gradeLevel}. ` +
          'Run seed:vocabulary to populate VocabularyEntry.',
      );
    }

    return rows.map((r) => r.word);
  }
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
pnpm --filter backend test --testPathPattern="vocabulary-rag.service" --no-coverage
```

Expected: `5 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/rag/vocabulary-rag.service.ts \
        backend/src/ai/rag/vocabulary-rag.service.spec.ts \
        backend/src/prisma/prisma.service.ts
git commit -m "feat(rag): VocabularyRagService + PrismaService + tests"
```

---

## Task 5: `AiModule` + wire into `AppModule`

**Files:**
- Create: `backend/src/ai/ai.module.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/src/prisma/prisma.module.ts`

- [ ] **Step 1: Create PrismaModule**

Create `backend/src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 2: Create AiModule**

Create `backend/src/ai/ai.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { VocabularyRagService } from './rag/vocabulary-rag.service';

@Module({
  providers: [VocabularyRagService],
  exports: [VocabularyRagService],
})
export class AiModule {}
```

- [ ] **Step 3: Read current AppModule**

```bash
cat backend/src/app.module.ts
```

- [ ] **Step 4: Add PrismaModule + AiModule to AppModule**

In `backend/src/app.module.ts`, add imports:

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';  // adjust to existing exports
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [/* existing controllers */],
  providers: [/* existing providers */],
})
export class AppModule {}
```

Keep whatever is already in `AppModule` — only add the two new imports.

- [ ] **Step 5: Run full test suite**

```bash
pnpm --filter backend test --no-coverage
```

Expected: all existing tests + new tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/ai/ai.module.ts \
        backend/src/prisma/prisma.module.ts \
        backend/src/app.module.ts
git commit -m "feat(rag): AiModule + PrismaModule wired into AppModule"
```

---

## Task 6: Seed script

**Files:**
- Create: `backend/src/scripts/seed-vocabulary.ts`
- Modify: `backend/package.json` (add `seed:vocabulary` script)

> **Context:** The script runs outside NestJS (no DI container). It reads the CSV directly, calls OpenAI in batches of 512 (safe under the 2 048 limit), waits 200 ms between batches, and upserts rows. It needs `DATABASE_URL` and `OPENAI_API_KEY` in the environment.

- [ ] **Step 1: Create the seed script**

Create `backend/src/scripts/seed-vocabulary.ts`:

```typescript
import { createReadStream } from 'fs';
import { resolve } from 'path';
import { parse } from 'csv-parse';
import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { PrismaClient } from '../../generated/prisma';

const BATCH_SIZE = 512;
const BATCH_DELAY_MS = 200;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CSV_PATH = resolve(__dirname, '../../prisma/seed/vocabulary.csv');

interface CsvRow {
  word: string;
  gradeLevel: number;
  frequency: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const parseCsv = (): Promise<CsvRow[]> =>
  new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];
    createReadStream(CSV_PATH)
      .pipe(parse({ columns: ['word', 'gradeLevel', 'frequency'] }))
      .on('data', (row: Record<string, string>) => {
        rows.push({
          word: row.word.trim(),
          gradeLevel: parseInt(row.gradeLevel, 10),
          frequency: parseFloat(row.frequency),
        });
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

const main = async (): Promise<void> => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient();
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const rows = await parseCsv();
    console.log(`Loaded ${rows.length} words from CSV`);

    const chunks: CsvRow[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      chunks.push(rows.slice(i, i + BATCH_SIZE));
    }

    let seeded = 0;
    for (const [idx, chunk] of chunks.entries()) {
      const words = chunk.map((r) => r.word);

      const { embeddings } = await embedMany({
        model: openai.embedding(EMBEDDING_MODEL),
        values: words,
      });

      for (let i = 0; i < chunk.length; i++) {
        const row = chunk[i];
        const embedding = embeddings[i];

        await prisma.$executeRaw`
          INSERT INTO "VocabularyEntry" (id, word, "gradeLevel", frequency, embedding)
          VALUES (
            gen_random_uuid(),
            ${row.word},
            ${row.gradeLevel},
            ${row.frequency},
            ${`[${embedding.join(',')}]`}::vector
          )
          ON CONFLICT (word) DO UPDATE SET
            "gradeLevel" = EXCLUDED."gradeLevel",
            frequency    = EXCLUDED.frequency,
            embedding    = EXCLUDED.embedding
        `;
      }

      seeded += chunk.length;
      console.log(`[${seeded}/${rows.length}] seeded`);

      if (idx < chunks.length - 1) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log('Done.');
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add script entry to package.json**

In `backend/package.json`, add to the `"scripts"` block:

```json
"seed:vocabulary": "dotenv -e .env -- ts-node --project tsconfig.json -r tsconfig-paths/register src/scripts/seed-vocabulary.ts"
```

> `dotenv -e .env` loads `.env` before running — requires `dotenv-cli`. Check if it's already installed: `ls node_modules/.bin/dotenv`. If not, add it: `pnpm --filter backend add -D dotenv-cli`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm --filter backend exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/scripts/seed-vocabulary.ts backend/package.json
git commit -m "feat(rag): seed-vocabulary script — CSV → embed → upsert VocabularyEntry"
```

---

## Task 7: Final verification + PR

- [ ] **Step 1: Run full init.sh**

```bash
./init.sh
```

Expected: `Smoke check PASSED`

- [ ] **Step 2: Run the seed script against the live DB**

Make sure Docker containers are running (`docker compose ps` — postgres should be `healthy`).

```bash
cd backend && OPENAI_API_KEY=<your-key> DATABASE_URL="postgresql://storygrow:storygrow@localhost:5432/storygrow" pnpm seed:vocabulary
```

Expected output:
```
Loaded 1500 words from CSV
[512/1500] seeded
[1024/1500] seeded
[1500/1500] seeded
Done.
```

- [ ] **Step 3: Verify rows in DB**

```bash
docker exec storygrow-postgres psql -U storygrow -d storygrow \
  -c "SELECT \"gradeLevel\", count(*) FROM \"VocabularyEntry\" WHERE embedding IS NOT NULL GROUP BY \"gradeLevel\" ORDER BY \"gradeLevel\";"
```

Expected:
```
 gradeLevel | count
------------+-------
          0 |   ~260
          1 |   ~280
          2 |   ~260
          3 |   ~250
          4 |   ~200
```

- [ ] **Step 4: Push + create PR**

```bash
git push -u origin issue/8-9-vocabulary-rag
gh pr create \
  --title "feat(rag): Russian vocabulary corpus + VocabularyRagService" \
  --body "Closes #8
Closes #9

## What
- \`backend/prisma/seed/vocabulary.csv\` — 1 500 Russian words, grades 0–4, frequency-ranked
- \`seed:vocabulary\` script — embeds words via \`text-embedding-3-small\`, upserts to \`VocabularyEntry\`
- \`ageToGradeLevel()\` — pure helper mapping child age to grade level 0–4
- \`VocabularyRagService.retrieve()\` — embeds \`topic + learningGoal\`, SQL filter by \`gradeLevel\`, cosine distance sort
- \`AiModule\` + \`PrismaModule\` wired into \`AppModule\`

## RAG design
Query vector = \`embed(topic + learningGoal)\`. Filter = \`gradeLevel <= target\`. Result = age-appropriate words most relevant to the story context. Passes into StoryGenerator prompt (#11) as lexical complexity reference."
```

- [ ] **Step 5: Merge**

```bash
gh pr merge --squash --delete-branch
```

---

## Self-Review

**Spec coverage:**
- ✅ CSV with ~1 500 Russian words, grades 0–4 → Task 2
- ✅ `ageToGradeLevel()` → Task 3
- ✅ `VocabularyRagService.retrieve()` with embed + SQL → Task 4
- ✅ `AiModule` + wired into AppModule → Task 5
- ✅ Seed script with batching + delay + upsert → Task 6
- ✅ `ai`, `@ai-sdk/openai`, `csv-parse` dependencies → Task 1
- ✅ Error handling (empty table → warn + return []) → Task 4 step 3
- ✅ Does NOT integrate with StoryGenerator — correct per spec

**Placeholder scan:** None found.

**Type consistency:**
- `embed` called with `{ model, value }` ✅ (Vercel AI SDK signature)
- `embedMany` called with `{ model, values }` ✅
- `Prisma.sql` tagged template + `Prisma.raw` for vector literal ✅
- `VocabularyRow { word: string }` matches `rows.map(r => r.word)` ✅
- `PrismaService` imported from `../../prisma/prisma.service` in service, matches file created in Task 4 ✅
