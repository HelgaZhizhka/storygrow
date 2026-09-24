import type { AgeBand } from '../../pdf/page-templates/page-templates.config';
import { WORD_RANGE_BY_BAND } from '../ai.config';

/**
 * Whole-story author prompt (ADR-0008, spec 2026-09-23 §4 stages 1–2).
 *
 * Stage 1 — the goal BRIEF — is code: the catalogue goal's title/description
 * plus one per-arc meaning sentence. No premise, no beats, no page layout.
 * Stage 2 — the AUTHOR — gets the brief, the hero, the age-band profile and
 * the safety boundary, and NO layout constraint: no page count, no character
 * caps. Only the whole-text word range is named, as a target the gates then
 * measure. Russian on purpose: the owner reviews every prompt.
 *
 * Safety wording follows ADR-0004 v2 (acts, not scary elements). v2 is still
 * Proposed; this harness is the vehicle for the owner's review of it.
 *
 * Bump WHOLE_STORY_PROMPT_VERSION on every wording change — the harness
 * fingerprints prompts so a run directory can never mix versions.
 */
export const WHOLE_STORY_PROMPT_VERSION = '2026-09-24-v2';

export type ArcType = 'virtue' | 'flaw';

export interface StoryBrief {
  readonly goalTitle: string;
  readonly wantedBehaviour: string;
  readonly arcMeaning: string;
  readonly ageBand: AgeBand;
  readonly arc: ArcType;
}

export interface HeroIdentity {
  readonly name: string;
  readonly age: number;
  readonly gender: 'female' | 'male' | 'other';
}

const ARC_MEANING: Record<ArcType, string> = {
  virtue:
    'Качество раскрывается через собственные поступки героя: он делает что-то трудное для себя, и результат заслужен его действиями, а не подарен.',
  flaw: 'Нежелательный поступок героя приводит к понятному последствию, которое слушатель может представить; герой сам исправляет его усилием. Без унижения, без ярлыка «плохой ребёнок».',
};

/** Stage 1: assembled in code for catalogue goals — no LLM call. */
export const buildStoryBrief = (input: {
  goal: { title: string; description: string; arcType?: ArcType };
  ageBand: AgeBand;
}): StoryBrief => {
  const arc: ArcType = input.ageBand === '3-4' ? 'virtue' : (input.goal.arcType ?? 'virtue');
  return {
    goalTitle: input.goal.title,
    wantedBehaviour: input.goal.description,
    arcMeaning: ARC_MEANING[arc],
    ageBand: input.ageBand,
    arc,
  };
};

const AGE_PROFILE: Record<AgeBand, string> = {
  '3-4': `Слушателю 3–4 года. Герой и один-два участника; одна трудность и одно решение. Короткие простые предложения; повтор одной и той же фразы или действия — уместный приём, а не недостаток. Мало событий, каждое — наглядное.`,
  '5-6': `Слушателю 5–6 лет. Герой и два-три участника; одна главная трудность, к которой герой подступается два-три раза по-разному. Предложения разной длины, много живого диалога; причины и следствия ясны из событий. Часть детей этого возраста уже читает сама — пусть речь персонажей нельзя перепутать, а фразы не требуют объяснений.`,
};

const SAFETY_BOUNDARY = `ГРАНИЦЫ БЕЗОПАСНОСТИ — судим по поступкам героя, а не по тому, кто есть в сцене.
Герою и любому похожему на ребёнка спутнику НЕЛЬЗЯ, чем бы ни кончилось: подходить, гладить, кормить незнакомое настоящее животное или доверять ему; уходить с незнакомцем или разговаривать с ним наедине; спички, плита, огонь; вода без взрослого; лезть на высоту (крыша, дерево, подоконник); уходить одному со двора, в лес, на улицу; бить, толкать, бросать в кого-то предметы. Герой никогда не побеждает тем, что подходит к угрозе или доверяет ей, пока она ещё угроза («волк оказался добрым» — нельзя).
Сказочный противник ДОПУСТИМ: говорящий, одетый Волк, Лиса, Медведь, Ворона в мире, где звери говорят, — может грозить, гнаться, требовать. Его побеждают смекалкой: прячутся, перехитрят, отвлекут, убегут, действуют вместе — никогда ударом. Он остаётся ни с чем, убегает или раскаивается уже после поражения. Угроза остаётся словами («Съем!», «Отдай!»): на странице никто не съеден, не ранен, не погиб; противник не уродлив (без клыков, крови, красных глаз). Страх, который оказался безобидным (шорох — это ёжик), — хороший конфликт. Никаких реалистичных бедствий (пожар в доме, кто-то тонет) и никакого страха на разлуке с родителем.`;

const AGE_SAFETY_NOTE: Record<AgeBand, string> = {
  '3-4':
    'Для 3–4 лет противник — комичный, с громкими сказочными приметами (говорит, в штанах, живёт в избушке), угроза короткая, без подробностей.',
  '5-6': '',
};

/** Stage 2 system prompt — the universal style, the arc, the band profile, the boundary. */
export const buildAuthorSystem = (ageBand: AgeBand): string => {
  const range = WORD_RANGE_BY_BAND[ageBand];
  return `Ты пишешь оригинальную русскую сказку, которую родитель читает ребёнку вслух.

СТИЛЬ — один для всех сказок: ясный естественный русский язык, конкретные события, причинность, живые диалоги, понятный ребёнку юмор, заслуженная развязка. Ни вычурных сравнений, ни взрослых острот, ни красивостей ради красивостей; но и не сухой пересказ. Сутеев — ориентир ясности, а не автор, которого нужно изображать.

ЦЕЛЬ КНИГИ должна быть существенна: она проявляется в том, что герой делает и что из этого выходит. Смысл арки задан во вводной — следуй ему, но не превращай в одинаковую пошаговую схему: у каждой цели своя история, своё желание героя, своя помеха и свой способ её одолеть. Финал — событие, которое вырастает из поступков героя. Не заканчивай определением качества, нравоучением, выводом «и понял герой, что…» или вопросом к читателю: развязку это не заменяет.

${AGE_PROFILE[ageBand]}

ОБЪЁМ — ориентир на всю сказку: примерно ${range.min}–${range.max} слов. Никаких страниц, лимитов на абзац, картинок, вопросов, заметок для родителей и комментариев о том, как написано. Пиши естественными абзацами; реплика диалога может быть отдельным абзацем.

Герой задан во вводной по имени, возрасту и полу — не переименовывай. Допустимы ожившие игрушки и явно сказочные говорящие персонажи. Сюжет оригинальный: без пересказа известной сказки и без имитации конкретного автора.

${SAFETY_BOUNDARY}
${AGE_SAFETY_NOTE[ageBand]}

Верни название и абзацы сказки — и ничего больше.`.trim();
};

const heroLine = (hero: HeroIdentity): string => {
  const who = hero.gender === 'female' ? 'девочка' : hero.gender === 'male' ? 'мальчик' : 'ребёнок';
  return `Герой: ${who} по имени ${hero.name}, ${hero.age} лет.`;
};

/** Stage 2 user prompt: the brief and the hero — nothing else. */
export const buildWholeStoryPrompt = (input: { brief: StoryBrief; hero: HeroIdentity }): string =>
  `${heroLine(input.hero)}
Цель книги: ${input.brief.goalTitle} — ${input.brief.wantedBehaviour}
Смысл арки: ${input.brief.arcMeaning}

Желание героя, помеху, события и развязку придумай сама/сам. Напиши законченную сказку.`;
