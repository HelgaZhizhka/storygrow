jest.mock('@langfuse/tracing', () => ({
  startActiveObservation: async <T>(
    _name: string,
    fn: (span: { update: jest.Mock }) => Promise<T>,
  ): Promise<T> => fn({ update: jest.fn() }),
}));
jest.mock('../telemetry', () => ({ createTelemetry: jest.fn(() => ({ isEnabled: false })) }));

import type { LanguageModel } from 'ai';
import { PageRenderer, type RenderPageOpts } from './page-renderer';
import type { ImageJudgeService } from './image-judge.service';
import type { ImageProvider } from './providers/image-provider.interface';
import type { S3Service } from '../../s3/s3.service';

const provider = (): ImageProvider & { generatePage: jest.Mock } => ({
  usesReference: true,
  modelLabel: 'test',
  generatePage: jest.fn(),
  generatePortrait: jest.fn(),
  generatePortraitFromPhoto: jest.fn(),
  generateLocationSheet: jest.fn(),
});
const uploadObject = jest.fn();
const s3 = { uploadObject } as unknown as S3Service;
const textModel = {} as LanguageModel;

const judgeStub = (
  enabled: boolean,
  maxRetries: number,
  verdicts: Array<{ passed: boolean; failures: string[] }>,
): ImageJudgeService & { judge: jest.Mock } => {
  const judge = jest.fn();
  verdicts.forEach((v) => judge.mockResolvedValueOnce(v));
  return { enabled, maxRetries, judge } as unknown as ImageJudgeService & { judge: jest.Mock };
};

const opts = (over: Partial<RenderPageOpts> = {}): RenderPageOpts => ({
  bookId: 'b1',
  pageNumber: 3,
  prompt: 'p',
  references: [],
  labels: [],
  template: 'image-top',
  variant: 'bible',
  judgeContext: { action: 'a', cast: [] },
  ...over,
});

describe('PageRenderer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders once and uploads when the judge is off', async () => {
    const p = provider();
    p.generatePage.mockResolvedValue(new Uint8Array([1]));
    const r = new PageRenderer({ provider: p, s3, textModel, judge: judgeStub(false, 1, []) });
    const out = await r.render(opts());
    expect(out).toMatchObject({ key: 'books/b1/page-3.png', attempts: 1 });
    expect(p.generatePage).toHaveBeenCalledTimes(1);
  });

  it('re-renders a failing page and keeps the passing attempt', async () => {
    const p = provider();
    p.generatePage
      .mockResolvedValueOnce(new Uint8Array([1]))
      .mockResolvedValueOnce(new Uint8Array([2]));
    const judge = judgeStub(true, 1, [
      { passed: false, failures: ['sceneMatch'] },
      { passed: true, failures: [] },
    ]);
    const out = await new PageRenderer({ provider: p, s3, textModel, judge }).render(opts());
    expect(out.attempts).toBe(2);
    expect(out.bytes).toEqual(new Uint8Array([2]));
    expect(judge.judge).toHaveBeenNthCalledWith(1, expect.objectContaining({ attempt: 1 }));
    expect(judge.judge).toHaveBeenNthCalledWith(2, expect.objectContaining({ attempt: 2 }));
  });

  it('stops at maxRetries and ships the attempt with the fewest failures (soft gate)', async () => {
    const p = provider();
    p.generatePage
      .mockResolvedValueOnce(new Uint8Array([1]))
      .mockResolvedValueOnce(new Uint8Array([2]));
    const judge = judgeStub(true, 1, [
      { passed: false, failures: ['sceneMatch'] },
      { passed: false, failures: ['sceneMatch', 'artefact:textInImage'] },
    ]);
    const out = await new PageRenderer({ provider: p, s3, textModel, judge }).render(opts());
    expect(p.generatePage).toHaveBeenCalledTimes(2);
    expect(out.bytes).toEqual(new Uint8Array([1]));
    expect(uploadObject).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'books/b1/page-3.png' }),
    );
  });

  it('does not judge a page without a judge context', async () => {
    const p = provider();
    p.generatePage.mockResolvedValue(new Uint8Array([1]));
    const judge = judgeStub(true, 1, []);
    await new PageRenderer({ provider: p, s3, textModel, judge }).render(
      opts({ judgeContext: undefined }),
    );
    expect(judge.judge).not.toHaveBeenCalled();
  });
});
