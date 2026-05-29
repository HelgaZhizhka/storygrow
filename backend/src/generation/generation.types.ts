export const GENERATION_QUEUE = 'generation';
export const GENERATE_BOOK_JOB = 'generateBook';

export interface GenerateBookPayload {
  bookId: string;
  userId: string;
}

export type GenerationProgress =
  | { step: 'fetching' }
  | { step: 'generating'; attempt: number }
  | { step: 'saving' }
  | { step: 'done' };
