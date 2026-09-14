import { validateEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://x',
  REDIS_URL: 'redis://x',
  OPENAI_API_KEY: 'sk',
  XAI_API_KEY: 'x',
};

describe('validateEnv (#373)', () => {
  it('defaults the image provider to xai and the judge retries to 1', () => {
    const env = validateEnv(base);
    expect(env.IMAGE_PROVIDER).toBe('xai');
    expect(env.IMAGE_EVAL_MAX_RETRIES).toBe(1);
  });

  it('fails loud on an unknown provider instead of silently picking another model', () => {
    expect(() => validateEnv({ ...base, IMAGE_PROVIDER: 'gemni' })).toThrow(/IMAGE_PROVIDER/);
  });

  it('requires the xAI key — it is the only image provider (#397)', () => {
    expect(() => validateEnv({ ...base, XAI_API_KEY: undefined })).toThrow(/XAI_API_KEY/);
    expect(() => validateEnv({ ...base, IMAGE_PROVIDER: 'gemini' })).toThrow(/IMAGE_PROVIDER/);
  });

  it('coerces and bounds the judge retry kill switch', () => {
    expect(validateEnv({ ...base, IMAGE_EVAL_MAX_RETRIES: '0' }).IMAGE_EVAL_MAX_RETRIES).toBe(0);
    expect(() => validateEnv({ ...base, IMAGE_EVAL_MAX_RETRIES: '9' })).toThrow(
      /IMAGE_EVAL_MAX_RETRIES/,
    );
  });

  it('lists every missing key at once and passes unknown keys through', () => {
    expect(() => validateEnv({ IMAGE_PROVIDER: 'xai' })).toThrow(
      /DATABASE_URL[\s\S]*OPENAI_API_KEY/,
    );
    expect(
      (validateEnv({ ...base, SOMETHING_ELSE: '1' }) as Record<string, unknown>).SOMETHING_ELSE,
    ).toBe('1');
  });
});
