/**
 * SUTEEV_STYLE — the voice-device catalogue (Suteev register refactor, #404 phase 1).
 *
 * The register used to be described to the model with adjectives ("warm, folk
 * rhythm, gentle humour"). The model cannot act on adjectives: it does not know
 * that "folk rhythm" means verb-first openings, inversion, refrain, nicknames
 * and onomatopoeia. This file makes the register CONCRETE — a list of named
 * devices, each with a one-line cue and 1–2 microquotes — and is the SINGLE
 * source consumed by both the Prose prompt (as instructions) and the Judge
 * prompt (as a checklist). One catalogue, two consumers: what we ask the writer
 * to do is exactly what the judge counts.
 *
 * The microquotes are ≤100-char illustrative citations of V. Suteev, used only
 * to show a device (the project's accepted approach — see the spec
 * `docs/superpowers/specs/2026-09-13-suteev-register-refactor-design.md`,
 * Appendix А). Our exemplars and generated text are our own.
 *
 * Structured as an object (not a bare string) so it can become `profile.voice`
 * when the StyleProfile seam lands with the story engines (spec §8, phase 4).
 */

export interface VoiceDevice {
  /** Stable id — the judge counts devices by this key; never reword loosely. */
  key: string;
  /** Short Russian name of the device, shown to both writer and judge. */
  label: string;
  /** One-line instruction for the Prose writer. */
  cue: string;
  /** 1–2 microquotes (≤100 chars) illustrating the device. */
  examples: readonly string[];
}

/** Voice devices for ages 5–6 — the flagship band. The judge counts these. */
export const SUTEEV_DEVICES_5_6: readonly VoiceDevice[] = [
  {
    key: 'opening',
    label: 'Зачин глаголом',
    cue: 'Начинай с действия, глагол — раньше героя; никаких «Жил-был день».',
    examples: ['Вылупился из яйца Утёнок.', 'Как-то раз застал Муравья сильный дождь.'],
  },
  {
    key: 'inversion',
    label: 'Инверсия глагол–подлежащее',
    cue: 'В обычных фразах ставь глагол перед подлежащим — народный ритм.',
    examples: ['Набрал Заяц полный мешок яблок.', 'Пошёл Кот дальше, а Лиса вприпрыжку за ним.'],
  },
  {
    key: 'refrain',
    label: 'Удвоение и рефрен',
    cue: 'Удваивай глагол и повторяй одну строку-рефрен между сценами.',
    examples: ['Ходил, ходил Заяц и устал.', 'А дождь всё сильнее и сильнее…'],
  },
  {
    key: 'dialogue',
    label: 'Живой диалог с разными глаголами речи',
    cue: 'Пусть диалог несёт историю; меняй глаголы речи — спросил, пищит, крикнул, проворчал, — не только «сказал».',
    examples: ['— Ты куда, Заяц? — А вон, за реку! — крикнул Заяц.'],
  },
  {
    key: 'nickname',
    label: 'Прозвища и обращения',
    cue: 'Зови персонажей прозвищем или обращением, а не только по роли.',
    examples: ['Куда идёшь, Колючая Голова?', 'Как дела, Косой?'],
  },
  {
    key: 'sound',
    label: 'Звукоподражание и словесная игра',
    cue: 'Вставляй звуки и словесную игру там, где они естественны.',
    examples: ['Карр! Карр! Безобразие!', 'Буль-буль-буль…'],
  },
  {
    key: 'bodyFeeling',
    label: 'Чувство через тело',
    cue: 'Показывай чувство телом и действием, никогда «он почувствовал / испугался».',
    examples: ['Заяц от удивления рот разинул.', 'Ёжик только лапками развёл.'],
  },
  {
    key: 'list',
    label: 'Перечень конкретных вещей',
    cue: 'Радость и изобилие давай конкретным перечнем существительных.',
    examples: ['Грибы и орехи, свёкла и капуста, мёд и репа.'],
  },
];

/**
 * Voice devices for ages 3–4. Simpler, repetition-driven: reply + action only,
 * NO internal monologue and NO similes. Repetition is the TARGET here, not a
 * defect — the echo-refrain is the whole shape of a Suteev toddler tale.
 */
export const SUTEEV_DEVICES_3_4: readonly VoiceDevice[] = [
  {
    key: 'echo',
    label: 'Эхо-рефрен',
    cue: 'Строй на повторе «реплика + „Я тоже“», повторённом несколько раз и сломанном в конце.',
    examples: ['— Я тоже, — сказал Цыплёнок.'],
  },
  {
    key: 'shortPhrase',
    label: 'Короткая фраза 4–8 слов',
    cue: 'Только реплика и действие, 4–8 слов; никаких мыслей и «Дать? Не дать?».',
    examples: ['Побежал Цыплёнок. И Утёнок за ним.'],
  },
  {
    key: 'sound',
    label: 'Звукоподражание',
    cue: 'Простые звуки как часть действия.',
    examples: ['Плюх! — и оба в воде.'],
  },
  {
    key: 'refrain',
    label: 'Рефрен-строка',
    cue: 'Одна строка возвращается между сценами.',
    examples: ['А червячок всё дальше и дальше.'],
  },
];

export interface VoiceStyle {
  readonly devices: readonly VoiceDevice[];
  /** How many devices the judge should see for a top score. */
  readonly minDevicesForHigh: number;
}

export const SUTEEV_STYLE_5_6: VoiceStyle = {
  devices: SUTEEV_DEVICES_5_6,
  minDevicesForHigh: 4,
};

export const SUTEEV_STYLE_3_4: VoiceStyle = {
  devices: SUTEEV_DEVICES_3_4,
  minDevicesForHigh: 2,
};

export const voiceStyleForBand = (ageBand: '3-4' | '5-6'): VoiceStyle =>
  ageBand === '3-4' ? SUTEEV_STYLE_3_4 : SUTEEV_STYLE_5_6;

/** The device catalogue as writer instructions — bullets with cue + example. */
export const renderVoiceForProse = (style: VoiceStyle): string =>
  style.devices
    .map(
      (d) => `  • ${d.label}: ${d.cue}\n    напр.: ${d.examples.map((e) => `«${e}»`).join(' · ')}`,
    )
    .join('\n');

/** The same devices as a numbered checklist the judge counts. */
export const renderVoiceChecklist = (style: VoiceStyle): string =>
  style.devices.map((d, i) => `     ${i + 1}. ${d.label} — напр. «${d.examples[0]}»`).join('\n');
