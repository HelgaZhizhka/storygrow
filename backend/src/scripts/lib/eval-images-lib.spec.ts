import { sanitizeId, evalBookId } from './eval-images-lib';

describe('eval-images-lib', () => {
  it('transliterates cyrillic into a unique slug (no collisions across goals)', () => {
    expect(sanitizeId('Смелость-6-child')).toBe('smelost-6-child');
    expect(sanitizeId('Честность-6-child')).toBe('chestnost-6-child');
    // different goals must not collapse to the same age-mode slug
    expect(sanitizeId('Смелость-6-child')).not.toBe(sanitizeId('Честность-6-child'));
    expect(evalBookId('bible+sheets', 'Fear_5-6')).toBe('eval-bible-sheets-fear-5-6');
  });
});
