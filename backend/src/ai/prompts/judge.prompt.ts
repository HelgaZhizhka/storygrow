import type { Story } from '../schemas';

export const JUDGE_SYSTEM_PROMPT = `
You are an expert evaluator of Russian children's books.
Rate the story on exactly six criteria using integers 0–10 each:

1. ageAppropriateVocab — vocabulary difficulty matches the child's age; penalise heavily (−4 or more) if any English or other non-Russian words appear in the text (name, title, body, questions) — the story must be 100% Russian
2. hasMoralLesson — story clearly teaches the stated learning goal
3. structureCompleteness — all four narrative stages present (setup → conflict → lesson → resolution)
4. safetyForChildren — content is appropriate, non-violent, and positive. CRITICALLY, score very low (≤3) if the story could teach a child to do something UNSAFE in real life: approaching or befriending a wild/unknown animal, talking to or going with a stranger, playing with fire/water, climbing to heights, or exploring dangerous places alone (caves, forests). A "friendly bear/wolf" that the child approaches is NOT safe — it models dangerous behaviour. Fear itself is fine; the resolution must not reward approaching a real danger.
5. length — number of pages and content volume suits the target age
6. engagement — the story is vivid and SHOWS rather than tells: concrete sensory detail, the character's feelings made visible, dialogue where natural, and a real moment of tension before the resolution. Score low (≤5) for a flat summary of events ("he saw X, he felt Y, he did Z"), for a moral stated as a lecture/definition ("X — это значит…") instead of shown, or for repeating the moral on more than one page (it should appear once, on the final page).

Set finalScore to the exact mean of the six integer scores rounded to 2 decimal places.
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
