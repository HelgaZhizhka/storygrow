/**
 * Russian Snowball (Porter) stemmer — self-contained, no external dependency.
 * Used by vocabulary-compliance to match inflected story words against
 * base-form corpus entries (e.g. "делится"/"поделилась" → "дел").
 *
 * Algorithm: http://snowball.tartarus.org/algorithms/russian/stemmer.html
 */

const VOWELS = new Set(['а', 'е', 'и', 'о', 'у', 'ы', 'э', 'ю', 'я']);

const PERFECTIVE_GERUND_PRECEDED = ['вшись', 'вши', 'в'];
const PERFECTIVE_GERUND = ['ившись', 'ывшись', 'ивши', 'ывши', 'ив', 'ыв'];
const ADJECTIVE = [
  'ыми',
  'ими',
  'его',
  'ого',
  'ему',
  'ому',
  'ее',
  'ие',
  'ые',
  'ое',
  'ей',
  'ий',
  'ый',
  'ой',
  'ем',
  'им',
  'ым',
  'ом',
  'их',
  'ых',
  'ую',
  'юю',
  'ая',
  'яя',
  'ою',
  'ею',
];
const PARTICIPLE_PRECEDED = ['ющ', 'ем', 'нн', 'вш', 'щ'];
const PARTICIPLE = ['ивш', 'ывш', 'ующ'];
const REFLEXIVE = ['ся', 'сь'];
const VERB_PRECEDED = [
  'ете',
  'йте',
  'ешь',
  'нно',
  'ла',
  'на',
  'ли',
  'ем',
  'ло',
  'но',
  'ет',
  'ют',
  'ны',
  'ть',
  'й',
  'л',
  'н',
];
const VERB = [
  'ейте',
  'уйте',
  'ила',
  'ыла',
  'ена',
  'ите',
  'или',
  'ыли',
  'ило',
  'ыло',
  'ено',
  'ует',
  'уют',
  'ены',
  'ить',
  'ыть',
  'ишь',
  'ила',
  'ыла',
  'ей',
  'уй',
  'ил',
  'ыл',
  'им',
  'ым',
  'ен',
  'ят',
  'ит',
  'ыт',
  'ую',
  'ю',
];
const NOUN = [
  'иями',
  'ями',
  'ами',
  'ией',
  'иям',
  'ием',
  'иях',
  'ев',
  'ов',
  'ие',
  'ье',
  'еи',
  'ии',
  'ей',
  'ой',
  'ий',
  'ям',
  'ем',
  'ам',
  'ом',
  'ах',
  'ях',
  'ию',
  'ью',
  'ия',
  'ья',
  'я',
  'а',
  'е',
  'и',
  'й',
  'о',
  'у',
  'ы',
  'ь',
  'ю',
];
const SUPERLATIVE = ['ейше', 'ейш'];
const DERIVATIONAL = ['ость', 'ост'];

const byLengthDesc = (a: string, b: string): number => b.length - a.length;

const rvStart = (word: string): number => {
  for (let i = 0; i < word.length; i++) {
    if (VOWELS.has(word[i])) return i + 1;
  }
  return word.length;
};

const r2Start = (word: string): number => {
  const r1 = regionAfter(word, 0);
  return regionAfter(word, r1);
};

const regionAfter = (word: string, from: number): number => {
  let i = from;
  while (i < word.length && !VOWELS.has(word[i])) i++;
  while (i < word.length && VOWELS.has(word[i])) i++;
  return i < word.length ? i + 1 : word.length;
};

const findEnding = (word: string, rv: number, endings: readonly string[]): string | null => {
  const sorted = [...endings].sort(byLengthDesc);
  for (const e of sorted) {
    const at = word.length - e.length;
    if (at >= rv && word.endsWith(e)) return e;
  }
  return null;
};

const findPrecededEnding = (
  word: string,
  rv: number,
  endings: readonly string[],
): string | null => {
  const sorted = [...endings].sort(byLengthDesc);
  for (const e of sorted) {
    const at = word.length - e.length;
    if (at > rv && word.endsWith(e) && (word[at - 1] === 'а' || word[at - 1] === 'я')) {
      return e;
    }
  }
  return null;
};

const stripStep1 = (word: string, rv: number): string => {
  const gerund =
    findPrecededEnding(word, rv, PERFECTIVE_GERUND_PRECEDED) ??
    findEnding(word, rv, PERFECTIVE_GERUND);
  if (gerund) return word.slice(0, -gerund.length);

  let base = word;
  const reflexive = findEnding(base, rv, REFLEXIVE);
  if (reflexive) base = base.slice(0, -reflexive.length);

  const adjective = findEnding(base, rv, ADJECTIVE);
  if (adjective) {
    base = base.slice(0, -adjective.length);
    const participle =
      findPrecededEnding(base, rv, PARTICIPLE_PRECEDED) ?? findEnding(base, rv, PARTICIPLE);
    return participle ? base.slice(0, -participle.length) : base;
  }

  const verb = findPrecededEnding(base, rv, VERB_PRECEDED) ?? findEnding(base, rv, VERB);
  if (verb) return base.slice(0, -verb.length);

  const noun = findEnding(base, rv, NOUN);
  return noun ? base.slice(0, -noun.length) : base;
};

const stripStep4 = (word: string, rv: number): string => {
  if (word.endsWith('нн') && word.length - 2 >= rv) return word.slice(0, -1);
  const superlative = findEnding(word, rv, SUPERLATIVE);
  if (superlative) {
    const base = word.slice(0, -superlative.length);
    return base.endsWith('нн') ? base.slice(0, -1) : base;
  }
  if (word.endsWith('ь') && word.length - 1 >= rv) return word.slice(0, -1);
  return word;
};

export const stemRussian = (input: string): string => {
  const word = input.toLowerCase().replace(/ё/g, 'е');
  if (word.length < 3) return word;

  const rv = rvStart(word);
  const r2 = r2Start(word);

  let result = stripStep1(word, rv);
  if (result.endsWith('и') && result.length - 1 >= rv) result = result.slice(0, -1);

  const derivational = findEnding(result, r2, DERIVATIONAL);
  if (derivational) result = result.slice(0, -derivational.length);

  return stripStep4(result, rv);
};
