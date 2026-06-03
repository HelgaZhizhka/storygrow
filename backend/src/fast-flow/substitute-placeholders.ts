export interface SubstitutionContext {
  childName: string;
  childAge: number;
  isFeminine: boolean;
}

const FEMININE_GENDER_VALUES = new Set(['female', 'girl', 'f', 'ж', 'женский', 'девочка']);

export function resolveGender(gender: string | null | undefined): boolean {
  if (!gender) return false;
  return FEMININE_GENDER_VALUES.has(gender.toLowerCase().trim());
}

export function substitutePlaceholders(text: string, ctx: SubstitutionContext): string {
  return text
    .replace(/\{\{childName\}\}/g, ctx.childName)
    .replace(/\{\{childAge\}\}/g, String(ctx.childAge))
    .replace(/\{\{([^|{}]*)\|([^|{}]*)\}\}/g, (_match, male: string, female: string) =>
      ctx.isFeminine ? female.trim() : male.trim(),
    );
}
