import { ImageJudgeSchema, imageVerdict, type ImageJudgeResult } from './image-judge.schema';

const clean: ImageJudgeResult = {
  heroMatch: true,
  heroOnce: true,
  sceneMatch: true,
  castConsistency: null,
  locationConsistency: true,
  adultScaleNatural: null,
  ageSafe: true,
  artefacts: [],
  reasoning: 'ok',
};

describe('imageVerdict', () => {
  it('passes when every applicable gate is true and there are no artefacts', () => {
    expect(imageVerdict(clean)).toEqual({ passed: true, failures: [] });
  });

  it('skips null gates (not applicable) rather than failing them', () => {
    expect(imageVerdict({ ...clean, heroMatch: null, heroOnce: null }).passed).toBe(true);
  });

  it('fails on any false gate and names it', () => {
    const v = imageVerdict({ ...clean, sceneMatch: false, adultScaleNatural: false });
    expect(v.passed).toBe(false);
    expect(v.failures).toEqual(['sceneMatch', 'adultScaleNatural']);
  });

  it('fails on artefacts with a prefixed label', () => {
    const v = imageVerdict({ ...clean, artefacts: ['textInImage', 'wrongSurface'] });
    expect(v.failures).toEqual(['artefact:textInImage', 'artefact:wrongSurface']);
  });

  it('schema rejects an unknown artefact class', () => {
    expect(ImageJudgeSchema.safeParse({ ...clean, artefacts: ['blurry'] }).success).toBe(false);
  });
});
