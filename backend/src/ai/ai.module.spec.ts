/**
 * Compiles the REAL AiModule (#373) — the guard that would have caught #364,
 * where the image judge was declared optional, failed to resolve through DI and
 * was silently null in production. Infrastructure (Prisma, S3) is replaced; the
 * AI SDK clients are constructed for real but never called.
 */
jest.mock('../generated/prisma/client', () => ({ PrismaClient: class {} }));

import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai.module';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { ImageGeneratorService } from './image-generator/image-generator.service';
import { ImageJudgeService } from './image-generator/image-judge.service';
import { validateEnv } from '../config/env.schema';

const env = {
  DATABASE_URL: 'postgresql://test',
  REDIS_URL: 'redis://test',
  OPENAI_API_KEY: 'sk-test',
  GOOGLE_GENERATIVE_AI_API_KEY: 'g-test',
  XAI_API_KEY: 'x-test',
  IMAGE_EVAL_MAX_RETRIES: '0',
};

describe('AiModule (DI wiring)', () => {
  it('compiles with the judge resolved as a required dependency of the image generator', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => validateEnv(env)],
        }),
        AiModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(S3Service)
      .useValue({})
      .compile();

    const judge = module.get(ImageJudgeService);
    expect(judge).toBeInstanceOf(ImageJudgeService);
    expect(judge.maxRetries).toBe(0);
    expect(module.get(ImageGeneratorService)).toBeInstanceOf(ImageGeneratorService);
  });

  it('refuses to start on an unknown IMAGE_PROVIDER instead of picking another model', async () => {
    const boot = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ ...env, IMAGE_PROVIDER: 'nano-banana' })],
        }),
        AiModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(S3Service)
      .useValue({})
      .compile();
    await expect(boot).rejects.toThrow(/IMAGE_PROVIDER/);
  });
});
