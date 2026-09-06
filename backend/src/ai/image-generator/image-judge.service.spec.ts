const mockGenerateObject = jest.fn();
jest.mock('ai', () => ({
  generateObject: (...args: unknown[]): unknown => mockGenerateObject(...args),
}));
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => (id: string) => ({ id }),
}));
jest.mock('@langfuse/tracing', () => ({
  startActiveObservation: async <T>(
    _name: string,
    fn: (span: { update: jest.Mock }) => Promise<T>,
  ): Promise<T> => fn({ update: jest.fn() }),
}));
jest.mock('../telemetry', () => ({ createTelemetry: jest.fn(() => ({ isEnabled: false })) }));

import type { ConfigService } from '@nestjs/config';
import { ImageJudgeService, type JudgePageInput } from './image-judge.service';
import type { ImageEvalRow, ImageEvalSink } from './image-eval.sink';

const config = (env: Record<string, string>): ConfigService =>
  ({ get: (k: string) => env[k] }) as unknown as ConfigService;

const sink = (): ImageEvalSink & { rows: ImageEvalRow[] } => {
  const rows: ImageEvalRow[] = [];
  return {
    rows,
    record: (row: ImageEvalRow): Promise<void> => {
      rows.push(row);
      return Promise.resolve();
    },
  };
};

const png = (w: number, h: number): Uint8Array => {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};

const input = (over: Partial<JudgePageInput> = {}): JudgePageInput => ({
  bookId: 'b1',
  pageNumber: 2,
  attempt: 1,
  image: png(1536, 1024),
  imageSize: '1536x1024',
  context: {
    action: 'the child climbs the ladder',
    heroDescriptor: 'girl, red hair',
    cast: [{ id: 'brother', name: 'братик', descriptor: 'toddler' }],
    location: 'a slide',
  },
  references: [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])],
  labels: ['hero', 'cast:brother', 'location'],
  ...over,
});

const verdictObject = (over: Record<string, unknown> = {}) => ({
  heroMatch: true,
  heroOnce: true,
  sceneMatch: true,
  castConsistency: true,
  locationConsistency: true,
  adultScaleNatural: null,
  ageSafe: true,
  artefacts: [],
  reasoning: 'fine',
  ...over,
});

describe('ImageJudgeService', () => {
  beforeEach(() => mockGenerateObject.mockReset());

  it('is on by default, reads the flag and retries from config', () => {
    const defaults = new ImageJudgeService(config({}), sink());
    expect(defaults.enabled).toBe(true);
    expect(defaults.maxRetries).toBe(1);
    const off = new ImageJudgeService(
      config({ IMAGE_EVAL: 'off', IMAGE_EVAL_MAX_RETRIES: '2' }),
      sink(),
    );
    expect(off.enabled).toBe(false);
    expect(off.maxRetries).toBe(2);
  });

  it('fails on preflight without calling the model and records the row', async () => {
    const s = sink();
    const verdict = await new ImageJudgeService(config({}), s).judge(
      input({ image: png(1024, 1024) }),
    );
    expect(verdict).toEqual({ passed: false, failures: ['preflight:aspect'] });
    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({ pageNumber: 2, attempt: 1, passed: false, scores: {} });
  });

  it('sends the page first, then each captioned reference (never the cascade prev)', async () => {
    mockGenerateObject.mockResolvedValue({ object: verdictObject() });
    await new ImageJudgeService(config({}), sink()).judge(
      input({
        labels: ['prev', 'hero', 'cast:brother'],
        references: [new Uint8Array([9]), new Uint8Array([1]), new Uint8Array([2])],
      }),
    );
    const [firstCall] = mockGenerateObject.mock.calls as unknown[][];
    const call = firstCall[0] as {
      messages: Array<{ content: Array<{ type: string; text?: string; image?: Uint8Array }> }>;
    };
    const content = call.messages[0].content;
    expect(content[0].type).toBe('text');
    expect(content[0].text).toContain('the child climbs the ladder');
    expect(content[1]).toMatchObject({ type: 'image' });
    const captions = content.filter((c) => c.type === 'text').map((c) => c.text);
    expect(captions.some((t) => t?.includes('HERO portrait'))).toBe(true);
    expect(captions.some((t) => t?.includes('"братик"'))).toBe(true);
    expect(content.filter((c) => c.type === 'image')).toHaveLength(3);
  });

  it('turns the judge object into a verdict and persists scores + reasoning', async () => {
    mockGenerateObject.mockResolvedValue({
      object: verdictObject({ sceneMatch: false, artefacts: ['textInImage'] }),
    });
    const s = sink();
    const verdict = await new ImageJudgeService(config({}), s).judge(input({ attempt: 2 }));
    expect(verdict).toEqual({ passed: false, failures: ['sceneMatch', 'artefact:textInImage'] });
    expect(s.rows[0]).toMatchObject({ attempt: 2, passed: false, reasoning: 'fine' });
  });

  it('never fails a book when the judge itself errors', async () => {
    mockGenerateObject.mockRejectedValue(new Error('503'));
    const verdict = await new ImageJudgeService(config({}), sink()).judge(input());
    expect(verdict).toEqual({ passed: true, failures: ['judge:unavailable'] });
  });
});
