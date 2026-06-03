import { substitutePlaceholders, resolveGender } from './substitute-placeholders';

describe('substitutePlaceholders', () => {
  it('replaces childName placeholder', () => {
    expect(
      substitutePlaceholders('Привет, {{childName}}!', {
        childName: 'Маша',
        childAge: 5,
        isFeminine: true,
      }),
    ).toBe('Привет, Маша!');
  });

  it('replaces childAge placeholder', () => {
    expect(
      substitutePlaceholders('Мне {{childAge}} лет.', {
        childName: 'Ваня',
        childAge: 7,
        isFeminine: false,
      }),
    ).toBe('Мне 7 лет.');
  });

  it('replaces multiple occurrences of the same placeholder', () => {
    const result = substitutePlaceholders('{{childName}} и {{childName}} пошли в лес.', {
      childName: 'Петя',
      childAge: 6,
      isFeminine: false,
    });
    expect(result).toBe('Петя и Петя пошли в лес.');
  });

  it('uses male form for masculine gender', () => {
    expect(
      substitutePlaceholders('{{childName}} {{вышел|вышла}}.', {
        childName: 'Ваня',
        childAge: 5,
        isFeminine: false,
      }),
    ).toBe('Ваня вышел.');
  });

  it('uses female form for feminine gender', () => {
    expect(
      substitutePlaceholders('{{childName}} {{вышел|вышла}}.', {
        childName: 'Маша',
        childAge: 5,
        isFeminine: true,
      }),
    ).toBe('Маша вышла.');
  });

  it('handles empty male variant for suffix-only patterns', () => {
    expect(
      substitutePlaceholders('{{childName}} сидел{{|а}}.', {
        childName: 'Маша',
        childAge: 5,
        isFeminine: true,
      }),
    ).toBe('Маша сидела.');
  });

  it('returns string unchanged when no placeholders present', () => {
    expect(
      substitutePlaceholders('Просто текст', { childName: 'Ира', childAge: 8, isFeminine: true }),
    ).toBe('Просто текст');
  });
});

describe('resolveGender', () => {
  it('returns true for female values', () => {
    expect(resolveGender('female')).toBe(true);
    expect(resolveGender('girl')).toBe(true);
    expect(resolveGender('f')).toBe(true);
    expect(resolveGender('ж')).toBe(true);
  });

  it('returns false for male values', () => {
    expect(resolveGender('male')).toBe(false);
    expect(resolveGender('boy')).toBe(false);
    expect(resolveGender('m')).toBe(false);
  });

  it('returns false for null or undefined', () => {
    expect(resolveGender(null)).toBe(false);
    expect(resolveGender(undefined)).toBe(false);
  });
});
