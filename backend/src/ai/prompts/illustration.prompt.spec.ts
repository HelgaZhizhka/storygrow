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
  action: 'Alisa helps her brother climb the ladder',
  heroDescriptor: bible.hero.descriptor,
  artStyle: 'watercolor' as const,
  labels: [] as string[],
};

describe('buildIllustrationPrompt (lean shape)', () => {
  it('opens with one identity line and the exactly-once rule, without the hero NAME', () => {
    const out = buildIllustrationPrompt(baseInput);
    expect(
      out.startsWith(
        'Keep this exact child: 5-year-old girl, red hair. The child appears exactly once.',
      ),
    ).toBe(true);
    // a name in an image prompt gets rendered as a sign/label in the picture
    expect(out).not.toContain('Алиса');
  });

  it('does not foreground props as a standalone line (it made the prop the focal subject)', () => {
    const out = buildIllustrationPrompt(baseInput);
    expect(out).not.toContain('Visible:');
    expect(out).not.toContain('a red ball');
  });

  it('never mentions reference images, even when references are passed', () => {
    const out = buildIllustrationPrompt({
      ...baseInput,
      labels: ['hero', 'cast:brother', 'location'],
    });
    expect(out).not.toMatch(/reference image/i);
  });

  it('includes cast, setting and atmosphere from the bible', () => {
    const out = buildIllustrationPrompt(baseInput);
    expect(out).toContain('Also in the scene: братик — toddler boy, blond.');
    expect(out).toContain('Setting: green slide with a metal ladder. sunny courtyard.');
  });

  it('puts the action after the setting and right before the style, as one sentence', () => {
    const out = buildIllustrationPrompt(baseInput);
    const setting = out.indexOf('Setting:');
    const action = out.indexOf('Alisa helps her brother climb the ladder.');
    const style = out.toLowerCase().indexOf('watercolour');
    expect(action).toBeGreaterThan(setting);
    expect(style).toBeGreaterThan(action);
  });

  it('omits the identity line when the hero is not on the page', () => {
    const out = buildIllustrationPrompt({
      ...baseInput,
      scene: sceneFixture({ locationId: 'slide', castIds: ['brother'], heroOnPage: false }),
    });
    expect(out).not.toContain('Keep this exact child');
    expect(out).not.toContain('appears exactly once');
  });

  it('drops the old framing phrase and negatives sentence', () => {
    const out = buildIllustrationPrompt(baseInput);
    expect(out).not.toMatch(/wide shot|medium shot|close-up/i);
    expect(out).not.toContain('No text or letters');
    expect(out).not.toContain('beyond those described');
  });

  it('adds the continuity line only for the cascade (prev) reference', () => {
    expect(buildIllustrationPrompt(baseInput)).not.toContain('previous scene');
    expect(buildIllustrationPrompt({ ...baseInput, labels: ['prev', 'hero'] })).toContain(
      'previous scene',
    );
  });

  it('truncates an over-long action', () => {
    const long = 'x'.repeat(ACTION_MAX_CHARS + 50);
    const out = buildIllustrationPrompt({ ...baseInput, action: long });
    expect(out).not.toContain('x'.repeat(ACTION_MAX_CHARS + 1));
  });
});
