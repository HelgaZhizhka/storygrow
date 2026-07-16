import { summarize, formatResultsTable, formatSummary, type EvalRunResult } from './eval-aggregate';

const run = (overrides: Partial<EvalRunResult>): EvalRunResult => ({
  goal: 'Смелость',
  age: 6,
  mode: 'child',
  arcType: 'virtue',
  title: 'Алиса и горка',
  passed: true,
  registerMatch: 8,
  scores: {
    ageAppropriateVocab: 9,
    hasMoralLesson: 9,
    structureCompleteness: 9,
    safetyForChildren: 10,
    length: 9,
    earnedResolution: 8,
    registerMatch: 8,
  },
  structuralErrorCount: 0,
  avgChars: 170,
  maxChars: 210,
  durationMs: 60_000,
  error: null,
  ...overrides,
});

describe('summarize', () => {
  it('computes pass rate over successful runs and counts failures separately', () => {
    const s = summarize([
      run({}),
      run({ passed: false, registerMatch: 5, scores: { ...run({}).scores, registerMatch: 5 } }),
      run({ error: 'boom', passed: false }),
    ]);
    expect(s.completed).toBe(2);
    expect(s.failed).toBe(1);
    expect(s.passRate).toBeCloseTo(0.5);
  });

  it('computes mean and min per criterion over completed runs only', () => {
    const s = summarize([
      run({}),
      run({ scores: { ...run({}).scores, registerMatch: 6, safetyForChildren: 8 } }),
      run({ error: 'boom' }),
    ]);
    expect(s.criteria.registerMatch.mean).toBeCloseTo(7);
    expect(s.criteria.registerMatch.min).toBe(6);
    expect(s.criteria.safetyForChildren.min).toBe(8);
  });

  it('handles an all-failed batch without dividing by zero', () => {
    const s = summarize([run({ error: 'x' }), run({ error: 'y' })]);
    expect(s.completed).toBe(0);
    expect(s.passRate).toBe(0);
    expect(s.criteria.registerMatch.mean).toBe(0);
  });
});

describe('formatResultsTable', () => {
  it('renders one row per run with pass/fail markers and errors inline', () => {
    const out = formatResultsTable([run({}), run({ error: 'timeout', passed: false })]);
    expect(out).toContain('Смелость');
    expect(out).toContain('PASS');
    expect(out).toContain('ERROR: timeout');
  });
});

describe('formatSummary', () => {
  it('renders pass rate and per-criterion mean/min lines', () => {
    const out = formatSummary(summarize([run({}), run({ passed: false })]));
    expect(out).toMatch(/pass rate:\s*1\/2/i);
    expect(out).toContain('registerMatch');
    expect(out).toMatch(/mean/i);
  });
});
