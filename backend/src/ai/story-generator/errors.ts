export class StoryGenerationFailedError extends Error {
  constructor(
    readonly bookId: string,
    readonly attempts: number,
  ) {
    super(`Story generation failed for book ${bookId} after ${attempts} attempts`);
    this.name = 'StoryGenerationFailedError';
  }
}
