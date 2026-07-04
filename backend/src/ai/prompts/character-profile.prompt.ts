/**
 * Character-profile derivation — an ISOLATED step that turns the parent's
 * free-text child appearance into a short English visual descriptor for the
 * illustrator. It has NOTHING to do with the story: keeping appearance out of the
 * Plan/Prose narrative is what stops visual details (a hair-bow, a dress) from
 * leaking into the plot or title. The result overrides the plan's placeholder
 * characterProfile in `child` mode.
 */
export const CHARACTER_PROFILE_SYSTEM = `
You convert a Russian description of a child's appearance into a SHORT English
visual descriptor for a children's-book illustrator. Output ONLY the descriptor —
no story, no sentences, no extra words. Cover hair, eyes, clothes and any notable
accessory. Keep it under 120 characters.
Example → "5-year-old girl, red curly hair, green eyes, big red bow, blue dress".
`.trim();

export const buildCharacterProfilePrompt = (
  appearance: string,
  childAge: number,
  gender?: string,
): string =>
  `Child: age ${childAge}${gender && gender !== 'unspecified' ? `, ${gender}` : ''}.
Appearance (Russian): ${appearance}`;
