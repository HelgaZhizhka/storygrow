import { getBeatSheet } from './story-generator.prompt';

describe('getBeatSheet', () => {
  it('returns the 5-6 virtue sheet (6 beats, includes Внутренняя борьба)', () => {
    const sheet = getBeatSheet('5-6', 'virtue');
    expect(sheet).toContain('Внутренняя борьба');
    expect(sheet).toContain('Закрепление через действие');
  });

  it('returns the 5-6 flaw sheet (includes Расплата)', () => {
    const sheet = getBeatSheet('5-6', 'flaw');
    expect(sheet).toContain('Расплата');
  });

  it('returns a DIFFERENT, simpler 3-4 virtue sheet — no Внутренняя борьба, has a refrain step', () => {
    const sheet = getBeatSheet('3-4', 'virtue');
    expect(sheet).not.toContain('Внутренняя борьба');
    expect(sheet).toMatch(/повтор/i);
  });

  it('throws for the impossible 3-4 + flaw combination (3-4 is virtue-only)', () => {
    expect(() => getBeatSheet('3-4', 'flaw')).toThrow();
  });
});
