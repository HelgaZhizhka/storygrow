import { ImageGenerationError } from './errors';

describe('ImageGenerationError', () => {
  it('flags refusals', () => {
    const e = new ImageGenerationError('refused');
    expect(e.refused).toBe(true);
    expect(e).toBeInstanceOf(Error);
  });

  it('is not a refusal for unknown reason', () => {
    expect(new ImageGenerationError('unknown').refused).toBe(false);
  });
});
