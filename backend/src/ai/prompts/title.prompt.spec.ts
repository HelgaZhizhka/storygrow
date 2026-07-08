import { isConcreteTitle } from './title.prompt';

describe('isConcreteTitle', () => {
  it('accepts a concrete, playful title', () => {
    expect(isConcreteTitle('Тёма и летучая кошка', 'Честность')).toBe(true);
    expect(isConcreteTitle('Гриша и хвостатая выдумка', 'Дружба')).toBe(true);
  });

  it('rejects a title that names the learning value (inflected)', () => {
    expect(isConcreteTitle('Тёма и его переживания с честностью', 'Честность')).toBe(false);
    expect(isConcreteTitle('Маша и дружба', 'Дружба')).toBe(false);
    expect(isConcreteTitle('Смелый Тёма и смелость', 'Смелость')).toBe(false);
  });

  it('rejects dull template titles', () => {
    expect(isConcreteTitle('История про Тёму', 'Честность')).toBe(false);
    expect(isConcreteTitle('Как Тёма учится говорить правду', 'Честность')).toBe(false);
  });

  it('rejects empty or over-long titles', () => {
    expect(isConcreteTitle('', 'Честность')).toBe(false);
    expect(isConcreteTitle('А'.repeat(61), 'Честность')).toBe(false);
  });
});
