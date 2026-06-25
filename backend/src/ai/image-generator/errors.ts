export class ImageContentPolicyError extends Error {
  constructor(
    readonly pageNumber: number,
    readonly prompt: string,
    cause?: unknown,
  ) {
    super(
      `DALL-E refused the prompt for page ${pageNumber} (content policy). Prompt: ${prompt.slice(0, 120)}...`,
    );
    this.name = 'ImageContentPolicyError';
    if (cause !== undefined) this.cause = cause;
  }
}

export class ImageGenerationError extends Error {
  constructor(
    readonly reason: 'refused' | 'unknown',
    cause?: unknown,
  ) {
    super(`Image generation failed (${reason})`);
    this.name = 'ImageGenerationError';
    if (cause !== undefined) this.cause = cause;
  }

  get refused(): boolean {
    return this.reason === 'refused';
  }
}
