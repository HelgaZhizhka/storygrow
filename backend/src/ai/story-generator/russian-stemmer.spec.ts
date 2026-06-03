import { stemRussian } from './russian-stemmer';

describe('stemRussian', () => {
  it('collapses inflected forms of a noun to one stem', () => {
    const stem = stemRussian('кот');
    expect(stemRussian('котом')).toBe(stem);
    expect(stemRussian('кота')).toBe(stem);
    expect(stemRussian('коты')).toBe(stem);
  });

  it('collapses verb conjugations to one stem', () => {
    const stem = stemRussian('играть');
    expect(stemRussian('играла')).toBe(stem);
    expect(stemRussian('играл')).toBe(stem);
    expect(stemRussian('играют')).toBe(stem);
  });

  it('collapses adjective forms to one stem', () => {
    const stem = stemRussian('важный');
    expect(stemRussian('важная')).toBe(stem);
    expect(stemRussian('важно')).toBe(stem);
    expect(stemRussian('важными')).toBe(stem);
  });

  it('strips reflexive endings', () => {
    expect(stemRussian('научился')).toBe(stemRussian('научить'));
  });

  it('keeps distinct words distinct', () => {
    expect(stemRussian('один')).not.toBe(stemRussian('одиннадцать'));
    expect(stemRussian('кот')).not.toBe(stemRussian('собака'));
  });

  it('normalises ё to е', () => {
    expect(stemRussian('ёлка')).toBe(stemRussian('елка'));
  });

  it('leaves short words and non-Russian tokens unchanged', () => {
    expect(stemRussian('я')).toBe('я');
    expect(stemRussian('кит')).toBe('кит');
  });
});
