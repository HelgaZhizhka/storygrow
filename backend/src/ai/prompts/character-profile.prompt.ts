/**
 * Appearance derivation (#128 / #376) — an ISOLATED step that turns the
 * parent's free-text description of the child into the SAME structured
 * `Appearance` the Plan uses for invented heroes, so every mode has one source
 * of the hero's look and no field (skin tone, outfit) can be silently omitted.
 * It has NOTHING to do with the story: keeping appearance out of the Plan/Prose
 * narrative is what stops a hair-bow or a dress from leaking into the plot.
 * `kind` is overwritten in code from age + gender; the model's value is ignored.
 */
export const CHARACTER_PROFILE_SYSTEM = `
You read a Russian description of a child written by a parent and fill a
structured English appearance for a children's-book illustrator. Every field is
required. Use ONLY what the parent wrote; where the parent says nothing, choose
the plainest common option and keep it simple:
- skin: skin tone as written, otherwise "light skin"
- hair: colour + style as written (e.g. "long wavy red hair")
- outfit: clothes WITH colours as written; if none given, invent a simple
  age-appropriate outfit and name one or two SPECIFIC colours (red, blue, yellow,
  green…; e.g. "a yellow t-shirt and blue shorts"). Never "bright" or
  "colourful" — an outfit without a specific colour drifts between pages
- detail: EVERY distinctive, always-visible thing the parent mentioned, comma-
  separated ("round glasses, freckles") — never drop one the parent wrote; if
  none, a small neutral one (e.g. "a red hair clip")
- kind: any value — it is replaced by the system.
Output the fields only, English, no sentences.
`.trim();

export const buildCharacterProfilePrompt = (
  appearance: string,
  childAge: number,
  gender?: string,
): string =>
  `Child: age ${childAge}${gender && gender !== 'unspecified' ? `, ${gender}` : ''}.
Parent's description (Russian): ${appearance}`;
