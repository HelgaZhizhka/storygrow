import { ageToAgeBand, templatesForAge, PAGE_TEMPLATES } from './page-templates.config';

describe('ageToAgeBand', () => {
  it('maps 3 and 4 to the 3-4 band', () => {
    expect(ageToAgeBand(3)).toBe('3-4');
    expect(ageToAgeBand(4)).toBe('3-4');
  });

  it('maps 5 and 6 to the 5-6 band', () => {
    expect(ageToAgeBand(5)).toBe('5-6');
    expect(ageToAgeBand(6)).toBe('5-6');
  });
});

describe('templatesForAge — 3-4 support', () => {
  it('returns a non-empty catalogue for age 3 and age 4', () => {
    expect(templatesForAge(3)).not.toHaveLength(0);
    expect(templatesForAge(4)).not.toHaveLength(0);
  });

  it('offers exactly cover/image-top/image-bottom/final for age 3', () => {
    expect(templatesForAge(3).sort()).toEqual(
      ['cover', 'final', 'image-bottom', 'image-top'].sort(),
    );
  });

  it('does NOT offer image-left or text-focus for age 3 or 4', () => {
    expect(templatesForAge(3)).not.toContain('image-left');
    expect(templatesForAge(3)).not.toContain('text-focus');
    expect(templatesForAge(4)).not.toContain('image-left');
    expect(templatesForAge(4)).not.toContain('text-focus');
  });
});

describe('maxChars — per age band', () => {
  it('gives 3-4 a smaller cap than 5-6 for image-top text', () => {
    expect(PAGE_TEMPLATES['image-top'].maxChars['3-4'].text).toBeLessThan(
      PAGE_TEMPLATES['image-top'].maxChars['5-6'].text as number,
    );
  });

  it('keeps 5-6 caps unchanged from before this change (220/200/60)', () => {
    expect(PAGE_TEMPLATES['image-top'].maxChars['5-6']).toEqual({ text: 220 });
    expect(PAGE_TEMPLATES['image-bottom'].maxChars['5-6']).toEqual({ text: 220 });
    expect(PAGE_TEMPLATES.final.maxChars['5-6']).toEqual({ text: 200 });
    expect(PAGE_TEMPLATES.cover.maxChars['5-6']).toEqual({ title: 60 });
  });
});
