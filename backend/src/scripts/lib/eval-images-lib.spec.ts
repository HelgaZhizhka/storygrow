import {
  IMAGE_VARIANTS,
  sheetsFlagFor,
  storyForVariant,
  sanitizeId,
  evalBookId,
} from './eval-images-lib';
import type { Story } from '../../ai/schemas';
import {
  visualBibleFixture,
  sceneFixture,
} from '../../ai/schemas/__fixtures__/visual-bible.fixture';

const story: Story = {
  title: 'T',
  characterProfile: 'a girl',
  discussionQuestions: ['1?', '2?', '3?', '4?', '5?'],
  visualBible: visualBibleFixture(),
  pages: [
    { template: 'cover', text: null, title: 'T', illustrationPrompt: 'a', scene: sceneFixture() },
    {
      template: 'image-top',
      text: 'x',
      title: null,
      illustrationPrompt: 'b',
      scene: sceneFixture(),
    },
  ],
};

describe('eval-images-lib', () => {
  it('covers all three variants', () => {
    expect(IMAGE_VARIANTS).toEqual(['baseline', 'bible', 'bible+sheets']);
  });

  it('turns sheets on only for bible+sheets', () => {
    expect(sheetsFlagFor('baseline')).toBe('off');
    expect(sheetsFlagFor('bible')).toBe('off');
    expect(sheetsFlagFor('bible+sheets')).toBe('on');
  });

  it('strips the bible and per-page scenes for baseline', () => {
    const out = storyForVariant(story, 'baseline');
    expect(out.visualBible).toBeUndefined();
    expect(out.pages.every((p) => p.scene === undefined)).toBe(true);
  });

  it('keeps the bible for bible and bible+sheets', () => {
    expect(storyForVariant(story, 'bible').visualBible).toBeDefined();
    expect(storyForVariant(story, 'bible+sheets').pages[0].scene).toBeDefined();
  });

  it('transliterates cyrillic into a unique slug (no collisions across goals)', () => {
    expect(sanitizeId('Смелость-6-child')).toBe('smelost-6-child');
    expect(sanitizeId('Честность-6-child')).toBe('chestnost-6-child');
    // different goals must not collapse to the same age-mode slug
    expect(sanitizeId('Смелость-6-child')).not.toBe(sanitizeId('Честность-6-child'));
    expect(evalBookId('bible+sheets', 'Fear_5-6')).toBe('eval-bible-sheets-fear-5-6');
  });
});
