import type { Story } from '../schemas';

export const JUDGE_SYSTEM_PROMPT = `
You are an expert evaluator of Russian children's books.
Rate the story on exactly five criteria using integers 0–10 each:

1. ageAppropriateVocab — vocabulary difficulty matches the child's age; penalise heavily (−4 or more) if any English or other non-Russian words appear in the text (name, title, body, questions) — the story must be 100% Russian
2. hasMoralLesson — story clearly teaches the stated learning goal
3. structureCompleteness — all four narrative stages present (setup → conflict → lesson → resolution)
4. safetyForChildren — content is appropriate, non-violent, and positive for children
5. length — number of pages and content volume suits the target age

Set finalScore to the exact mean of the five integer scores rounded to 2 decimal places.
Write reasoning in 2–3 sentences explaining the key strengths or weaknesses.
`.trim();

const formatPages = (story: Story): string =>
  story.pages
    .map((p, i) => {
      const parts = [p.title, p.text].filter((s): s is string => Boolean(s));
      const content = parts.length > 0 ? parts.join(' | ') : '(illustration only)';
      return `  Page ${i + 1} [${p.template}]: ${content}`;
    })
    .join('\n');

export const buildJudgePrompt = (story: Story, childAge: number, learningGoal: string): string => {
  const questions = story.discussionQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n');
  return `Story title: "${story.title}"
Child age: ${childAge}
Learning goal: ${learningGoal}

Pages:
${formatPages(story)}

Discussion questions:
${questions}

Evaluate this story.`.trim();
};
