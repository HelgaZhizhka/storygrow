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

describe('pickExemplar — 3-4 band', () => {
  it('routes a 3-4 virtue goal to a 3-4 exemplar, never a 5-6 one', () => {
    const ex = pickExemplar('Смелость', 'virtue', '3-4');
    expect(ex.ageBand).toBe('3-4');
  });

  it('falls back to the fear/trying-something-new 3-4 exemplar for an unmatched goal', () => {
    const ex = pickExemplar('Неизвестная цель', 'virtue', '3-4');
    expect(ex.ageBand).toBe('3-4');
    expect(ex.text).toContain('Катя');
  });

  it('routes Доброта to the 3-4 kindness exemplar', () => {
    const ex = pickExemplar('Доброта', 'virtue', '3-4');
    expect(ex.ageBand).toBe('3-4');
    expect(ex.text).toContain('Мишка');
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
