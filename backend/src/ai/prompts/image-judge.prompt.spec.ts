import { buildImageJudgeTask, referenceCaption } from './image-judge.prompt';

const ctx = {
  action: 'the child climbs the ladder',
  heroDescriptor: '6-year-old girl, light skin, curly brown hair, wearing a yellow t-shirt',
  cast: [{ id: 'friend', name: 'Катя', descriptor: 'girl with braids' }],
  location: 'a garden with a wooden bench',
};

describe('buildImageJudgeTask (#369)', () => {
  it('points at the portrait instead of describing the child when a portrait is passed', () => {
    const out = buildImageJudgeTask(ctx, true);
    expect(out).toContain('the child shown in the HERO portrait reference');
    expect(out).not.toContain('6-year-old girl');
  });

  it('describes the child in text only when no portrait is passed', () => {
    const out = buildImageJudgeTask(ctx, false);
    expect(out).toContain('Hero expected on the page: 6-year-old girl');
  });

  it('says the hero is not expected when the descriptor is absent, regardless of references', () => {
    expect(buildImageJudgeTask({ ...ctx, heroDescriptor: null }, true)).toContain('NOT expected');
  });

  it('lists cast and location', () => {
    const out = buildImageJudgeTask(ctx, true);
    expect(out).toContain('Катя — girl with braids');
    expect(out).toContain('Location: a garden with a wooden bench');
  });

  it('captions references by label', () => {
    expect(referenceCaption('hero')).toContain('HERO portrait');
    expect(referenceCaption('cast:friend', 'Катя')).toContain('"Катя"');
    expect(referenceCaption('location')).toContain('LOCATION');
  });
});
