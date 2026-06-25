import { genitiveName } from './ru';

describe('genitiveName', () => {
  it.each([
    ['Маша', 'Маши'],
    ['Саша', 'Саши'],
    ['Тёма', 'Тёмы'],
    ['Лиза', 'Лизы'],
    ['Аня', 'Ани'],
    ['Катя', 'Кати'],
    ['Мария', 'Марии'],
    ['Андрей', 'Андрея'],
    ['Игорь', 'Игоря'],
    ['Иван', 'Ивана'],
    ['Артём', 'Артёма'],
  ])('declines %s → %s', (name, expected) => {
    expect(genitiveName(name)).toBe(expected);
  });

  it('leaves indeclinable/foreign names unchanged', () => {
    expect(genitiveName('Лео')).toBe('Лео');
    expect(genitiveName('Майю')).toBe('Майю');
  });

  it('handles empty/short input gracefully', () => {
    expect(genitiveName('')).toBe('');
    expect(genitiveName('Я')).toBe('Я');
  });
});
