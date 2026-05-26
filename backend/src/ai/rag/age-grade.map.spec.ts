import { ageToGradeLevel, AGE_GRADE_MAP } from './age-grade.map';

describe('ageToGradeLevel', () => {
  it('maps age 3 → grade 0', () => {
    expect(ageToGradeLevel(3)).toBe(0);
  });

  it('maps age 4 → grade 0 (boundary)', () => {
    expect(ageToGradeLevel(4)).toBe(0);
  });

  it('maps age 5 → grade 1', () => {
    expect(ageToGradeLevel(5)).toBe(1);
  });

  it('maps age 6 → grade 1 (boundary)', () => {
    expect(ageToGradeLevel(6)).toBe(1);
  });

  it('maps age 7 → grade 2', () => {
    expect(ageToGradeLevel(7)).toBe(2);
  });

  it('maps age 8 → grade 2 (boundary)', () => {
    expect(ageToGradeLevel(8)).toBe(2);
  });

  it('maps age 9 → grade 3', () => {
    expect(ageToGradeLevel(9)).toBe(3);
  });

  it('maps age 10 → grade 3 (boundary)', () => {
    expect(ageToGradeLevel(10)).toBe(3);
  });

  it('maps age 11 → grade 4', () => {
    expect(ageToGradeLevel(11)).toBe(4);
  });

  it('maps age 99 → grade 4 (max)', () => {
    expect(ageToGradeLevel(99)).toBe(4);
  });
});

describe('AGE_GRADE_MAP', () => {
  it('is sorted ascending by maxAge', () => {
    const ages = AGE_GRADE_MAP.map((e) => e.maxAge).filter((a) => a !== Infinity);
    expect(ages).toEqual([...ages].sort((a, b) => a - b));
  });
});
