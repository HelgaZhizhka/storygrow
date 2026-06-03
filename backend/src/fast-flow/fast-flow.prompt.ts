export const FAST_FLOW_SYSTEM_PROMPT = `
You are a professional author of children's books in Russian.
Generate a warm, age-appropriate, educational children's story in JSON.

Hard rules:
1. Write ENTIRELY in Russian — every word must be in Russian.
2. The protagonist's name MUST match the child's name exactly as given.
3. Use correct grammatical gender (masculine or feminine) throughout — verbs,
   adjectives, and pronouns must agree with the child's gender.
4. Narrative arc across content pages: setup → conflict/challenge → lesson → resolution.
5. First page MUST use the "cover" template (title only, no body text field).
6. Last page MUST use the "final" template (moral summary + discussion questions).
7. All middle pages use templates from: "image-top", "image-bottom", "image-left".
8. All illustrationPrompt fields MUST be in English.
`.trim();

export interface FastFlowPromptOptions {
  childName: string;
  childAge: number;
  isFeminine: boolean;
  learningGoal: string;
}

export const buildFastFlowPrompt = ({
  childName,
  childAge,
  isFeminine,
  learningGoal,
}: FastFlowPromptOptions): string => {
  const genderNote = isFeminine
    ? 'girl — use feminine forms for all verbs and adjectives referring to her'
    : 'boy — use masculine forms for all verbs and adjectives referring to him';

  return `
Create a personalized Russian children's book:

  Child's name: ${childName} (${genderNote})
  Age: ${childAge} years old
  Learning goal: "${learningGoal}"

Book structure — exactly 6 pages:
  Page 1  — template "cover":  title only (≤60 chars). No body text.
  Page 2  — template "image-top":    150–250 chars. Setup: introduce ${childName} and the world.
  Page 3  — template "image-bottom": 150–250 chars. Conflict: a challenge arises.
  Page 4  — template "image-left":   150–250 chars. Struggle: ${childName} faces the challenge.
  Page 5  — template "image-top":    150–250 chars. Lesson: ${childName} learns and grows.
  Page 6  — template "final": moral summary ≤280 chars + exactly 5 open-ended discussion questions.

Language: simple, warm vocabulary suitable for a ${childAge}-year-old child.
${childName} must appear by name on every content page (pages 2–6).

For each illustrationPrompt (ENGLISH only, ≤200 chars):
  Style: "flat children's book illustration, soft pastel colors, warm lighting, no text"
  Describe: what ${childName} is doing, the setting, visible emotions and mood.
`.trim();
};
