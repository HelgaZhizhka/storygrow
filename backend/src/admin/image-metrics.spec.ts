import { computeImageMetrics, type ImageEvalRowLite } from './image-metrics';
import { XAI_IMAGE_MODEL, GEMINI_IMAGE_MODEL } from '../ai/ai.config';

const row = (over: Partial<ImageEvalRowLite>): ImageEvalRowLite => ({
  bookId: 'b1',
  run: 1,
  pageNumber: 1,
  attempt: 1,
  passed: true,
  failures: [],
  model: XAI_IMAGE_MODEL,
  labels: ['hero', 'location:home'],
  ...over,
});

describe('computeImageMetrics (#379)', () => {
  it('counts pages, first-attempt pass rate, re-renders and no-verdict rows', () => {
    const rows = [
      row({ pageNumber: 1 }),
      row({ pageNumber: 2, passed: false, failures: ['sceneMatch', 'proportionsNatural'] }),
      row({ pageNumber: 2, attempt: 2, passed: false, failures: ['proportionsNatural'] }),
      row({ pageNumber: 3, failures: ['judge:blocked:PROHIBITED_CONTENT:identity-only'] }),
      row({ pageNumber: 4, failures: ['judge:unavailable'] }),
    ];
    const m = computeImageMetrics({ rows, books: [], windowDays: 7 });
    expect(m).toMatchObject({ attempts: 5, pages: 4, reRenders: 1, blocked: 1, unavailable: 1 });
    expect(m.firstAttemptPassRate).toBeCloseTo(3 / 4);
    expect(m.topFailures).toEqual([
      { criterion: 'proportionsNatural', count: 2 },
      { criterion: 'sceneMatch', count: 1 },
    ]);
  });

  it('prices page renders with their references and artefacts without, per model', () => {
    const rows = [
      row({ labels: ['hero', 'location:home'] }), // 0.04 + 2 × 0.01
      row({ pageNumber: 2, model: GEMINI_IMAGE_MODEL, labels: ['hero'] }), // 0.039
    ];
    const books = [
      { imageModel: XAI_IMAGE_MODEL, characterPortraitKey: 'p', referenceImageKeys: ['a', 'b'] },
    ];
    const m = computeImageMetrics({ rows, books, windowDays: 7 });
    expect(m.costByModel).toEqual([
      { model: XAI_IMAGE_MODEL, pages: 1, artefacts: 3, usd: 0.18 },
      { model: GEMINI_IMAGE_MODEL, pages: 1, artefacts: 0, usd: 0.04 },
    ]);
  });

  it('lists rows and books from before #379 as unknown instead of guessing a price', () => {
    const m = computeImageMetrics({
      rows: [row({ model: null })],
      books: [{ imageModel: null, characterPortraitKey: 'p', referenceImageKeys: [] }],
      windowDays: 7,
    });
    expect(m.costByModel).toEqual([
      { model: 'unknown (before #379)', pages: 1, artefacts: 1, usd: 0 },
    ]);
  });

  it('reports a null pass rate with no rows', () => {
    expect(
      computeImageMetrics({ rows: [], books: [], windowDays: 7 }).firstAttemptPassRate,
    ).toBeNull();
  });
});
