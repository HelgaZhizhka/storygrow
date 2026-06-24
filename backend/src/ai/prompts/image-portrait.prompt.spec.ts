import { buildPortraitPrompt, buildPagePrompt } from './image-portrait.prompt';

describe('image-portrait prompts', () => {
  it('portrait prompt includes the profile and the style suffix', () => {
    const p = buildPortraitPrompt('a girl with red curls', 'watercolor');
    expect(p).toContain('a girl with red curls');
    expect(p.toLowerCase()).toContain('watercolour');
    expect(p.toLowerCase()).toContain('portrait');
    expect(p).not.toContain('background.,');
    expect(p).toContain('background,');
  });

  it('page prompt wraps with a keep-character instruction and the style suffix', () => {
    const p = buildPagePrompt('playing with a fox in a park', 'cartoon');
    expect(p.toLowerCase()).toContain('same');
    expect(p).toContain('playing with a fox in a park');
    expect(p.toLowerCase()).toContain('cartoon');
  });
});
