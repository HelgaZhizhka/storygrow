export const AGE_GRADE_MAP: ReadonlyArray<{ maxAge: number; grade: 0 | 1 | 2 | 3 | 4 }> = [
  { maxAge: 4, grade: 0 },
  { maxAge: 6, grade: 1 },
  { maxAge: 8, grade: 2 },
  { maxAge: 10, grade: 3 },
  { maxAge: Infinity, grade: 4 },
];

/**
 * Maps a child's age to a vocabulary grade level (0–4).
 * Used by VocabularyRagService to filter age-appropriate words.
 *
 * age 3–4  → 0 | age 5–6  → 1 | age 7–8  → 2
 * age 9–10 → 3 | age 11+  → 4
 */
export const ageToGradeLevel = (age: number): 0 | 1 | 2 | 3 | 4 => {
  const entry = AGE_GRADE_MAP.find((e) => age <= e.maxAge);
  return entry ? entry.grade : 4;
};
