import { buildIllustrationPrompt } from './illustration.prompt';
import { visualBibleFixture, sceneFixture } from '../schemas/__fixtures__/visual-bible.fixture';
import { ACTION_MAX_CHARS } from '../ai.config';

const bible = visualBibleFixture({
  hero: { name: 'Алиса', descriptor: '5-year-old girl, red hair' },
  cast: [{ id: 'brother', name: 'братик', role: 'младший брат', descriptor: 'toddler boy, blond' }],
  locations: [{ id: 'slide', name: 'горка', descriptor: 'green slide with a metal ladder' }],
  props: [{ id: 'ball', descriptor: 'a red ball' }],
  atmosphere: 'sunny courtyard',
});

const baseInput = {
  bible,
  scene: sceneFixture({
    locationId: 'slide',
    castIds: ['brother'],
    propIds: ['ball'],
    heroOnPage: true,
    framing: 'wide' as const,
  }),
  action: 'Alisa helps her brother climb the ladder.',
  heroDescriptor: bible.hero.descriptor,
  artStyle: 'watercolor' as const,
  labels: [] as string[],
};

describe('buildIllustrationPrompt', () => {
  it('names the hero once and enforces exactly-one-hero', () => {
    const out = buildIllustrationPrompt(baseInput);
    expect(out).toContain('EXACTLY ONCE');
    expect(out).toContain('never draw the hero twice');
  });

  it('uses the hero descriptor when no portrait reference is passed', () => {
    const out = buildIllustrationPrompt(baseInput);
    expect(out).toContain('The hero is 5-year-old girl, red hair');
    expect(out).not.toContain('reference image 1');
  });

  it('cites reference image 1 and still reinforces the descriptor in text when the portrait is passed', () => {
    const out = buildIllustrationPrompt({ ...baseInput, labels: ['hero'] });
    expect(out).toContain('as in reference image 1');
    expect(out).not.toContain('The hero is 5-year-old');
    // descriptor reinforced in text (photo-flow named features must survive) — #348 review
    expect(out).toContain('5-year-old girl, red hair');
  });

  it('includes cast, location and props from the bible, not appearance from the action', () => {
    const out = buildIllustrationPrompt(baseInput);
    expect(out).toContain('братик — toddler boy, blond');
    expect(out).toContain('green slide with a metal ladder');
    expect(out).toContain('a red ball');
  });

  it('omits the hero lock when the hero is not on the page', () => {
    const out = buildIllustrationPrompt({
      ...baseInput,
      scene: sceneFixture({ locationId: 'slide', castIds: ['brother'], heroOnPage: false }),
    });
    expect(out).not.toContain('EXACTLY ONCE');
  });

  it('appends the style suffix and the no-text/no-extra-people negatives', () => {
    const out = buildIllustrationPrompt(baseInput);
    expect(out.toLowerCase()).toContain('watercolour');
    expect(out).toContain('No text or letters');
    expect(out).toContain('beyond those described');
  });

  it('truncates an over-long action', () => {
    const long = 'x'.repeat(ACTION_MAX_CHARS + 50);
    const out = buildIllustrationPrompt({ ...baseInput, action: long });
    expect(out).not.toContain('x'.repeat(ACTION_MAX_CHARS + 1));
  });

  it('cites the reference index matching the labels order', () => {
    const out = buildIllustrationPrompt({
      ...baseInput,
      labels: ['hero', 'cast:brother', 'location'],
    });
    expect(out).toContain('as in reference image 2'); // cast:brother is index 1 → image 2
    expect(out).toContain('as in reference image 3'); // location is index 2 → image 3
  });
});
