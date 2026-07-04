/**
 * Companion derivation — an ISOLATED step that turns the child's named pets/toys
 * (the `belongings` seeds) into short English visual descriptors for the
 * illustrator. Recurring companions otherwise have NO visual anchor: the
 * reference portrait fixes only the hero, so a named pet drifts across pages
 * (cat → plush) and a name like «Мира» can render as a person. The Prose phase
 * uses these descriptors so every illustrationPrompt names a companion by
 * species + fixed look, never by bare name. Mirrors the characterProfile
 * derivation (#216).
 */
export const COMPANIONS_SYSTEM = `
You convert a child's named pets and toys into SHORT English visual descriptors
for a children's-book illustrator, so each stays visually consistent across
pages. Keep the given name, add the species/kind and a simple fixed look.
Output one descriptor per companion, ≤ 80 characters each. No story, no sentences.
Examples:
  "кошка Мира" → "Mira, a small grey tabby cat"
  "плюшевый мишка Тёпа" → "Tyopa, a soft brown teddy bear"
`.trim();

export const buildCompanionsPrompt = (belongings: string[]): string =>
  `Named pets/toys the child owns (Russian):\n${belongings.map((b) => `- ${b}`).join('\n')}`;
