import { substitutePlaceholders } from './substitute-placeholders';

describe('substitutePlaceholders', () => {
  it('replaces childName placeholder', () => {
    expect(
      substitutePlaceholders('Привет, {{childName}}!', { childName: 'Маша', childAge: 5 }),
    ).toBe('Привет, Маша!');
  });

  it('replaces childAge placeholder', () => {
    expect(
      substitutePlaceholders('Мне {{childAge}} лет.', { childName: 'Ваня', childAge: 7 }),
    ).toBe('Мне 7 лет.');
  });

  it('replaces multiple occurrences of the same placeholder', () => {
    const result = substitutePlaceholders('{{childName}} и {{childName}} пошли в лес.', {
      childName: 'Петя',
      childAge: 6,
    });
    expect(result).toBe('Петя и Петя пошли в лес.');
  });

  it('replaces both placeholders in the same string', () => {
    const result = substitutePlaceholders('{{childName}} ({{childAge}} лет) нашёл друга.', {
      childName: 'Лёша',
      childAge: 4,
    });
    expect(result).toBe('Лёша (4 лет) нашёл друга.');
  });

  it('returns string unchanged when no placeholders present', () => {
    expect(substitutePlaceholders('Просто текст', { childName: 'Ира', childAge: 8 })).toBe(
      'Просто текст',
    );
  });
});
