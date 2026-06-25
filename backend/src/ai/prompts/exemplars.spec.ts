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
