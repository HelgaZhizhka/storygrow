export {
  StorySchema,
  DISCUSSION_QUESTIONS_COUNT,
  ILLUSTRATION_PROMPTS_MIN,
  ILLUSTRATION_PROMPTS_MAX,
} from './story.schema';
export type { Story } from './story.schema';

export { JudgeScoreSchema, JudgeSchema, computeFinalScore } from './judge.schema';
export type { JudgeScores, JudgeResult } from './judge.schema';
