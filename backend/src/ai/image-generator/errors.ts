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
