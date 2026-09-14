# Safety-boundary research — fairy-tale antagonists vs imitable danger (2026-09)

**Feeds:** [ADR-0004 v2 amendment](../adr/0004-safe-conflict-boundary.md#amendment-v2-2026-09-13--imitable-behaviour-not-scary-element),
phase 0b of the Suteev register refactor spec.
**Question:** ADR-0004 v1 forbids any "wild/unknown animal" as conflict. Suteev's
cast (Волк у яблони, Лиса за Зайцем, Медведь-лентяй) is therefore blocked. What
do products, regulators, child psychology and the Russian canon actually say the
risk is tied to?

**Method:** four parallel web-research passes on 2026-09-13 (primary pages
fetched where reachable; secondary sources flagged). Quotes are kept under 15
words. Unreachable primaries are listed at the end.

---

## 1. Personalised / AI children's-book products

| Product | Type | Stated content policy | What samples actually contain | Age |
|---|---|---|---|---|
| [Wonderbly](https://www.wonderbly.com/personalized-books/kids) | print, human-written | none found; tone copy only ("brave, kind and confident") | [*The Birthday Thief*](https://www.wonderbly.com/personalized-products/the-birthday-thief-book): an invisible thief steals the birthday, "a thrilling birthday adventure", resolved by persuasion. Monsters are letters. No wild-animal menace. | 0–12 tiers |
| [Hooray Heroes](https://hoorayheroes.com/) | print | none found | treasure hunts through "10 enchanting worlds"; fear-of-dark chapter (third-party claim only) | 0–12 (3rd party) |
| [Oscar Stories](https://oscarstories.com/faq/) | AI | "All stories are kid-friendly and age-appropriate"; "free from any harmful elements"; no filter list | offers *Grimm's Fairy Tales* and *Jungle Book* worlds — wolves/tigers/witches by inheritance; no sample text published | 6–8 (App Store), 4+ rating |
| [StoryBee](https://storybee.app/ai-content-filters-child-safe-reading) | AI | parent toggles: "blocking scary themes", "violence and mature themes", "Stricter settings for toddlers"; "Always review AI-generated content" | public `/stories/horror/` category holds ordinary tales (a fox's journey, a backyard chase) | 3–12 |
| [Bedtimestory.ai](https://www.bedtimestory.ai/legal/terms-of-service) | AI | "reserves the right to reject any story for any reason"; cofounder: OpenAI moderation, "not 100 percent watertight" ([IE](https://interestingengineering.com/culture/ai-can-create-bedtime-stories-for-kids-but-there-is-a-catch)) | friendly dragons, "treacherous paths" only nominally; a knight story with "no villain… no danger" | none |
| [Once Upon a Bot](https://onceuponabot.com/) | AI | none | dragons as protagonists; but the public feed also carries an adult werewolf romance — filtering effectively absent | none |
| [Storywizard.ai](https://www.storywizard.ai/families) | AI (edu) | "actively filter out profanity and inappropriate content"; terms ban "violent, hateful, inflammatory" | no samples | none |
| [Storybird](https://www.commonsensemedia.org/website-reviews/storybird) | community | CSM: "stories shouldn't include blood or guts" | — | 6+ |
| [Skazka.ai](https://skazka.ai/us/story-generator) | AI, RU | "COPPA Compliant"; "Results may contain inaccuracies"; no policy | candy kingdom, ice palace, dinosaur-jungle bridge | — |
| [HugyStories](https://hugystories.com/) (ex-Baiuni) | AI, RU, therapeutic | fears reframed: darkness → "friendly shadows, moon rabbits", thunder → "giants playing bowling" | fear is the product, always defanged | 3–7 |
| [Kids4U](https://kids4u.ru/generator-skazok) | AI, RU | "Сказки — поддержка, а не терапия" | fear-of-dark / doctor themes, «ночной хранитель» | — |

**Synthesis.** No product publishes a concrete forbidden-list. Policies are either
generic ("kid-friendly") or legal boilerplate; only StoryBee exposes "scary
themes" and "violence" as parent-side dials. Samples are uniformly soft: the
strongest villain found is Wonderbly's reformed Birthday Thief; AI products
default to friendly dragons and internal conflict. Wild animals appear only as
friends. Absence of a policy is not safety (Once Upon a Bot). The industry has
**no editorial position** on fairy-tale antagonists; it trusts base-model
moderation. That leaves the decision to pedagogy and regulation, not precedent.

---

## 2. Platform and regulatory guidelines

| Source | What it says | Axis it uses |
|---|---|---|
| [Apple Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) 1.1.2 / 1.1.3 | bans "Realistic portrayals of people or animals being killed, maimed…" and "reckless use of weapons and dangerous objects"; Kids Category 1.3 has no content-violence rule of its own | realistic vs not |
| [Apple age ratings](https://developer.apple.com/help/app-store-connect/reference/age-ratings/) | "Cartoon or Fantasy Violence" = "easily distinguished from real life"; any tick → 9+; 4+ = "no objectionable material" | cartoon vs realistic |
| [Google Play Families](https://support.google.com/googleplay/android-developer/answer/9893335) + [PEGI](https://pegi.info/what-do-the-labels-mean) | Families: no "violence, gore, or shocking content". PEGI 3: "very mild form of violence (in a comical context or a childlike setting)"; nothing "likely to frighten". PEGI 7 admits "scenes… frightening to younger children" | comic / frightening; no imitability item |
| [436-ФЗ ст. 5 п. 2](https://base.garant.ru/12181695/5633a92d35b966c2ba2f1e859e7bdd69/) | forbidden **at every rating**: information «побуждающая детей к совершению действий, представляющих угрозу их жизни и (или) здоровью» | **imitable danger** |
| [436-ФЗ ст. 7 (0+)](https://www.consultant.ru/document/cons_doc_LAW_108808/07194a696bee4a97dd25ff31550a995809e343c6/) | permits «оправданные ее жанром и (или) сюжетом эпизодические ненатуралистические изображение или описание» of violence «при условии торжества добра над злом и выражения сострадания к жертве» | genre-justified, non-naturalistic, good wins |
| [436-ФЗ ст. 8 (6+)](https://fzrf.su/zakon/o-zashchite-detej-ot-informacii-436-fz/st-8.php) | only from 6+: «несчастного случая, аварии, катастрофы либо ненасильственной смерти», and crimes shown with condemnation | accidents/death are 6+, not 0+ |
| [BBFC U](https://www.bbfc.co.uk/rating/u) | violence "very mild and justified by context (for example, comedic, animated, wholly unrealistic)"; threat "very mild and the outcome should be reassuring"; dangerous behaviour "young children may copy should be clearly disapproved of or wholly unrealistic" | **the three-way split we need** |
| [Ofcom Code s.1](https://www.ofcom.org.uk/tv-radio-and-on-demand/broadcast-standards/section-one-protecting-under-eighteens) 1.12–1.13 | violence / dangerous behaviour "easily imitable by children in a manner that is harmful" must not appear in children's programmes; guidance weighs "degrees of fantasy and reality and the identification with the character"; worked examples are household stunts (washing-machine drum, knives, matches) | imitability |
| ACMA CTS 2009 (secondary: [guide PDF](https://www.acma.gov.au/sites/default/files/2019-06/Previous-guide-to-the-Childrens-Television-Standards-2009.pdf)) | "unsafe situations which may encourage children to engage in activities dangerous to them" | imitability |
| [Common Sense Media 2–4](https://www.commonsensemedia.org/about-us/our-mission/about-our-ratings/2-4), [5–7](https://www.commonsensemedia.org/about-us/our-mission/about-our-ratings/5-7) | 2–4: "Kids are just as likely to imitate cartoon violence"; risk = "visual…, easy to mimic (hitting, punching), and presented as funny"; "separation of parents and kids… can be scary". 5–7: avoid "scary suspense, lots of peril", "grotesque images" | mode of action, not fantasy framing |
| [COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) | "not designed to protect children from viewing particular types of content" | privacy only |
| [PBS Standards](https://www.pbs.org/standards/childrens-content) | avoid behaviour "that could be easily mimicked by a child" — "razors, knives, or matches"; "gratuitous physical or psychological violence" | imitability, household hazards |

**Synthesis.** The regulators that think hardest about under-7s (BBFC, Ofcom,
ACMA, PBS, 436-ФЗ ст. 5) all name the same risk: a **concrete dangerous act a
child could copy**, shown approvingly. None of them treats a fantasy antagonist
as that risk; BBFC explicitly clears "comedic, animated, wholly unrealistic"
threat with a "reassuring" outcome. Russian 0+ permits episodic, non-naturalistic,
genre-justified conflict if good wins and the victim is pitied. Common Sense
Media adds one refinement the others miss: **hitting is imitable even in a
cartoon**, so the antagonist must be beaten by wit, not blows. Accidents and
death are a 6+ matter in Russia, so «Кошкин дом»-style disaster stays out.

---

## 3. Child psychology and pedagogy

**Bettelheim** ([*The Uses of Enchantment*](https://en.wikipedia.org/wiki/The_Uses_of_Enchantment), 1976): the wolf gives diffuse anxiety a defeatable
shape; "'Safe' stories mention neither death nor aging". Critiques: Zipes
([*Breaking the Magic Spell*](https://www.jstor.org/stable/j.ctt2jcv4c)) on the
"authoritarian tone and fallacious arguments"; Tatar ([*Off with Their Heads!*](https://press.princeton.edu/books/paperback/9780691000886/off-with-their-heads))
on tales as adult discipline; Dundes on borrowing from Heuscher. **Status:** a
framing hypothesis, not evidence. It is not a reason to keep villains; the
transfer studies below are.

**What predicts imitation** (social-learning line):
- Bandura 1965 ([summary](https://www.simplypsychology.org/bobo-doll.html)): imitation rises when the model is **rewarded or unpunished**, falls when punished.
- Bandura 1963 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/13966304/)): a cartoon cat was imitated too; effects depend on "sex of the child, and the reality cues of the model". Cartoon format alone does not immunise — the copied act was **concrete, rewarded, on an identical prop** available to the child.
- Potts, Doppler & Hernandez 1994 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/7844498/)): children shown frequent physical risk-taking "increased their self-reported risk-taking"; Potts & Henderson 1991: 33 % of preschool programmes showed "unsafe, imitable behavior without consequences".

**What suppresses transfer** (fantasy-quarantine line):
- Richert & Smith 2011, *Child Development* 82(4) ([summary](https://www.bps.org.uk/research-digest/fantasy-prone-children-struggle-apply-lessons-fantasy-stories)): ages 3½–5½ transferred fewer solutions from a fantasy-protagonist story to a real problem (0.64 vs 1.36); children "quarantine" fantasy content.
- Walker, Gopnik & Ganea 2015 ([Wiley](https://srcd.onlinelibrary.wiley.com/doi/10.1111/cdev.12287)): realistic story → 72 % generalised a causal fact; fantastical → 24 %; 5-year-olds quarantine more than 3-year-olds.
- Woolley & Cox 2007 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/17683351/)): 3-year-olds separate story characters from reality less reliably than 4–5s.
- Ganea et al. 2014 "Do cavies talk?" ([Frontiers](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00283/full)): anthropomorphic animal books make 3–5s "less likely to apply the facts to… the real animals" — the cost is conceptual, the behavioural corollary (lower transfer of a talking Wolf's world to the yard) is extrapolation, not tested.
- Cantor ([EdWeek](https://www.edweek.org/leadership/scare-tactics/1996/02)): 3–5s are frightened by **appearance**, "independent of how she behaved" — fright risk is visual grotesqueness, not moral menace.

**Russian sources:**
- Пропп: «Антагонист наносит одному из членов семьи вред… вредительством открывается завязка» ([текст](https://drevne-rus-lit.niv.ru/drevne-rus-lit/propp-morfologiya-volshebnoj-skazki/funkcii-dejstvuyuschih-lic.htm)). No вредитель, no plot.
- Выготский: сказка — «естественная эстетическая воспитательница ребенка», but the child must know «что сказка — это сказка»; scaring with «букой» leaves the child «в вечном психозе» ([текст](https://a-mov.ru/books/vygotskij-pedagogicheskaja-psihologija/099.html)). Aesthetic fear ≠ real intimidation.
- Запорожец: the child «мысленно становится на позицию героя» and «стремится к реализации целей положительного персонажа» ([текст](https://www.psychiatry.ru/stat/136)). Identification is with the hero, against the antagonist.
- Чуковский, «От двух до пяти»: «всякую, даже временную неудачу героя ребенок всегда переживает как свою»; «Тем персонажам, которые милы ребёнку, всё на свете должно удаваться» ([PDF](https://www.100bestbooks.ru/files/Chukovsky_Ot_dvyh_do_pyati.pdf)). The 1929 pedologists who banned «Тараканище» for «неправильное представление о мире животных» are the historical version of our v1 rule.
- Захаров: «В возрасте 3-5 лет страх одиночества конкретизируется страхом нападения страшных сказочных персонажей» — fed by «угроз взрослых», not by the tale alone ([PDF](https://prepod.nspu.ru/pluginfile.php/389506/mod_resource/content/1/Zakharov_A_V_-_Dnevnye_i_nochnye_strakhi_u_detey.pdf)).
- Смирнова & Соколова 2014, criteria for 3–5: «определенность положительных и отрицательных персонажей», «общий позитивный эмоциональный настрой», heroes are «дети или детеныши сказочных животных» ([PDF](https://psyjournals.ru/journals/chp/archive/2014_n4/chp_2014_n4_73417.pdf)). Villains expected; unresolved dread not.
- Осорина, Зинкевич-Евстигнеева: deliberate self-scaring (страшилки) is a school-age practice (6–7+); preschoolers get fear pre-packaged and resolved by adults.

**Synthesis — the imitation predictors.** Supported by evidence: a preschooler
copies a **concrete, physically performable act** when the model is **similar**
(same age/sex — a personalised hero is maximally similar), the setting is
**realistic with accessible props**, and the act is **rewarded or unpunished**.
Transfer from fantasy framing is markedly lower and grows lower from 3 to 5.
The child identifies with the hero, and the antagonist is a slot in the plot. A
talking Wolf who is outwitted therefore scores near zero on every predictor:
fantastical agent, dissimilar model, punished outcome, no replicable act. The
one caveat that survives (Bandura 1963, CSM 2–4): a **blow** by the hero is
imitable even in a cartoon, so wit must win, not sticks. And at 3–4 the fantasy
markers must be loud (talks, wears clothes) because the quarantine is weaker.

---

## 4. The Russian canon (Сутеев, Чуковский, Маршак, folk tales)

Full catalogue with publisher age labels and reading-list placements: the
research pass found 21 works; the pattern is consistent.

- **Wolves, foxes and bears are the 2–4 curriculum.** The «От рождения до школы»
  list ([2–3 / 3–4](https://nsportal.ru/detskiy-sad/razvitie-rechi/2015/05/06/spisok-istochnikov-hudozhestvennoy-literatury-po-programme-ot))
  recommends «Козлятки и волк», «Маша и медведь», «Три медведя» at 2–3 and
  «Колобок», «Волк и козлята», «Кот, петух и лиса», «Лиса и Заяц», «Муха-Цокотуха»,
  «Краденое солнце», «Сказка о глупом мышонке» at 3–4; «Под грибом» and
  «Тараканище» at 4–5. A thematic variant files «Волк и семеро козлят» and
  «Маша и медведь» under **«Азбука безопасности»** — the wolf is the safety
  lesson, not the hazard.
- **Publisher labels:** «Мешок яблок», «Палочка-выручалочка», «Кот-рыболов»,
  «Дядя Миша» ship in a «Для детей до 3-х лет» AST omnibus ([Лабиринт](https://www.labirint.ru/books/478091/));
  «Волк и семеро козлят» 0+ ([Лабиринт](https://www.labirint.ru/books/725473/)).
  The one 6+ found is a 2014 «Маша и медведь» edition — an outlier.
- **The antagonist is always beaten by wit, never approached.** Заяц hides under
  the mushroom; Маша rides home in the короб; the hedgehog's «выручалочка —
  умная голова»; Волк у яблони is left with nothing. Where a blow appears
  (Ёж's stick, Медведь vs Крокодил, Комар vs Паук) it is dealt by an animal
  adult, never by a child.
- **No human child is ever rewarded for going toward danger.** «Бармалей»:
  disobedience → capture → rescue from outside; the reward is for **mercy**
  (the children ask to spare him). Маша and the girl in «Три медведя» got lost,
  did not seek it, and are rewarded for **cunning or flight**. «Кошкин дом»: the
  fire is a consequence of pride.
- **Animal-children pay directly for imitating danger.** Цыплёнок's «Я тоже!»
  ends in the water and a rescue; the глупый мышонок is taken by the cat;
  Петух is carried off three times. Structure: disobedience → real loss →
  external rescue. This is the canon's way of doing a safety lesson — through a
  **companion who is not the reader's avatar**.
- **Чуковский on why it is safe:** children «отождествляют себя… участником
  этой борьбы за добро»; the mother retelling «Колобок» made every encounter
  end «торжеством Колобка». Modern Russian advice ([Лайфхакер](https://lifehacker.ru/scary-stories-for-kids/)): scary tales are «репетиция страхов реальной жизни»; a happy ending and adapted versions under 6–7.

---

## 5. What this means for StoryGrow (carried into ADR-0004 v2)

1. The risk axis is **imitable real-world action by the hero**, not the presence
   of a scary element. This is the unanimous position of BBFC, Ofcom, PBS,
   436-ФЗ ст. 5 п. 2, and of the transfer literature.
2. A **fairy-tale antagonist** (talking, clothed, in a story-animal world) who
   threatens, chases or grabs and is **outwitted / driven off / left with
   nothing** is within 0+ (436-ФЗ ст. 7), within BBFC U, and is the 2–4
   kindergarten curriculum.
3. Keep every v1 hard ban that is a **concrete act**: approaching an unknown
   real animal, going with a stranger, fire, water, heights, going off alone.
   For the personalised hero they hold regardless of outcome, because model
   similarity is maximal.
4. Add three bans v1 lacked: **no blow by the hero** (imitable even in cartoon),
   **no on-page harm or grotesque appearance** (Cantor; CSM), **no realistic
   disaster** (fire in the house, drowning) — those are 6+ in 436-ФЗ.
5. Age-band nuance: at 3–4 the fantasy markers must be explicit and the threat
   comic, because the fantasy quarantine is weaker than at 5–6.
6. The canon's companion-pays-for-disobedience pattern («Цыплёнок и Утёнок») is
   pedagogically sound but is **not** enabled in v2 — it is listed as a future
   relaxation for the owner to decide on.

## Unreachable primaries (secondary sources used)

Ofcom Broadcasting Code page (403; text via vlex mirror), ACMA CTS 2009 PDFs
(timeouts), PBS 2007 Producer Guidelines PDF (no text extraction), IARC
questionnaire (behind the developer console), Storybird guidelines (JS-only),
StoryBee Google Play listing (not fetched).
