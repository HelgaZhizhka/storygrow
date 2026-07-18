import { buildTitleSystem, isConcreteTitle } from './title.prompt';

describe('buildTitleSystem — per band cap', () => {
  it('states 40 characters maximum for 3-4', () => {
    expect(buildTitleSystem('3-4')).toContain('40 characters maximum');
  });

  it('states 60 characters maximum for 5-6 (unchanged)', () => {
    expect(buildTitleSystem('5-6')).toContain('60 characters maximum');
  });
});

describe('isConcreteTitle — per band length gate', () => {
  it('accepts a concrete title at exactly the 3-4 cap (40 chars)', () => {
    const title = 'А'.repeat(40);
    expect(isConcreteTitle(title, 'Смелость', '3-4')).toBe(true);
  });

  it('rejects a title over the 3-4 cap (41 chars) that would pass for 5-6', () => {
    const title = 'А'.repeat(41);
    expect(isConcreteTitle(title, 'Смелость', '3-4')).toBe(false);
    expect(isConcreteTitle(title, 'Смелость', '5-6')).toBe(true);
  });

  it('still rejects a title naming the learning value, regardless of band', () => {
    expect(isConcreteTitle('Катя и её смелость', 'Смелость', '3-4')).toBe(false);
  });
});
