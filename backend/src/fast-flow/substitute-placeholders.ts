export interface SubstitutionContext {
  childName: string;
  childAge: number;
}

export function substitutePlaceholders(text: string, ctx: SubstitutionContext): string {
  return text
    .replace(/\{\{childName\}\}/g, ctx.childName)
    .replace(/\{\{childAge\}\}/g, String(ctx.childAge));
}
