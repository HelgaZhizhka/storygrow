import { getRegisterReferences, pickExemplar } from './exemplars';

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

  it('falls back to one of the 5-6 flaw exemplars for an unknown goal', () => {
    const ex = pickExemplar('Неизвестная цель', 'flaw');
    expect(ex.arcType).toBe('flaw');
    expect(
      ['Честность', 'Управление гневом', 'Делиться с другими'].some((goal) =>
        ex.goalTitles.includes(goal),
      ),
    ).toBe(true);
  });

  it('routes a virtue goal to a virtue exemplar', () => {
    const ex = pickExemplar('Смелость', 'virtue');
    expect(ex.arcType).toBe('virtue');
  });

  it('falls back to one of the 5-6 virtue exemplars for an unknown goal', () => {
    const ex = pickExemplar('Неизвестная цель', 'virtue');
    expect(ex.arcType).toBe('virtue');
    expect(
      ['Смелость', 'Доброта', 'Самостоятельность'].some((goal) => ex.goalTitles.includes(goal)),
    ).toBe(true);
  });
});

describe('pickExemplar — 3-4 band', () => {
  it('routes a 3-4 virtue goal to a 3-4 exemplar, never a 5-6 one', () => {
    const ex = pickExemplar('Смелость', 'virtue', '3-4');
    expect(ex.ageBand).toBe('3-4');
  });

  it('falls back to one of the 3-4 virtue pool for an unmatched goal', () => {
    const ex = pickExemplar('Неизвестная цель', 'virtue', '3-4');
    expect(ex.ageBand).toBe('3-4');
    expect(['Катя', 'Мишка', 'Юра'].some((hero) => ex.text.includes(hero))).toBe(true);
  });

  it('routes Доброта to one of the two 3-4 kindness-family exemplars (KINDNESS_3_4 or SHELTER_3_4)', () => {
    const ex = pickExemplar('Доброта', 'virtue', '3-4');
    expect(ex.ageBand).toBe('3-4');
    expect(['Мишка', 'Юра'].some((hero) => ex.text.includes(hero))).toBe(true);
  });

  it('reaches both KINDNESS_3_4 and SHELTER_3_4 across repeated calls (pooled-random selection)', () => {
    const heroesSeen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const ex = pickExemplar('Доброта', 'virtue', '3-4');
      if (ex.text.includes('Мишка')) heroesSeen.add('Мишка');
      if (ex.text.includes('Юра')) heroesSeen.add('Юра');
    }
    expect(heroesSeen).toEqual(new Set(['Мишка', 'Юра']));
  });

  it('omitting ageBand still returns a 5-6 exemplar (default unchanged)', () => {
    const ex = pickExemplar('Смелость', 'virtue');
    expect(ex.ageBand).toBe('5-6');
  });
});

describe('getRegisterReferences — 3-4 band', () => {
  it('returns two 3-4 virtue exemplars (no flaw counterpart exists for 3-4)', () => {
    const refs = getRegisterReferences('3-4');
    expect(refs).toHaveLength(2);
    expect(refs.every((e) => e.ageBand === '3-4')).toBe(true);
  });

  it('omitting ageBand still returns the original 5-6 pair', () => {
    const refs = getRegisterReferences();
    expect(refs.every((e) => e.ageBand === '5-6')).toBe(true);
  });
});
