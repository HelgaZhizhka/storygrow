import { pickReferences } from './pick-references';
import { sceneFixture } from '../schemas/__fixtures__/visual-bible.fixture';

const bytes = (n: number): Uint8Array => new Uint8Array([n]);

describe('pickReferences', () => {
  it('places the hero portrait first when the hero is on the page', () => {
    const { images, labels } = pickReferences({
      scene: sceneFixture({ heroOnPage: true, castIds: [] }),
      sources: { heroPortrait: bytes(1) },
      budget: 3,
    });
    expect(labels).toEqual(['hero']);
    expect(images).toEqual([bytes(1)]);
  });

  it('omits the hero when the hero is not on the page', () => {
    const { labels } = pickReferences({
      scene: sceneFixture({ heroOnPage: false, castIds: ['brother'] }),
      sources: { heroPortrait: bytes(1), castSheets: { brother: bytes(2) } },
      budget: 3,
    });
    expect(labels).toEqual(['cast:brother']);
  });

  it('orders hero → cast → location and respects the budget of 3', () => {
    const { labels } = pickReferences({
      scene: sceneFixture({ heroOnPage: true, castIds: ['a', 'b'] }),
      sources: {
        heroPortrait: bytes(1),
        castSheets: { a: bytes(2), b: bytes(3) },
        locationSheet: bytes(4),
      },
      budget: 3,
    });
    // hero + 2 cast fills the budget; location is dropped (cast outranks it)
    expect(labels).toEqual(['hero', 'cast:a', 'cast:b']);
  });

  it('includes the location when budget allows', () => {
    const { labels } = pickReferences({
      scene: sceneFixture({ heroOnPage: true, castIds: ['a'] }),
      sources: { heroPortrait: bytes(1), castSheets: { a: bytes(2) }, locationSheet: bytes(4) },
      budget: 3,
    });
    expect(labels).toEqual(['hero', 'cast:a', 'location']);
  });

  it('skips a cast member with no sheet (PR1: only the portrait exists)', () => {
    const { labels } = pickReferences({
      scene: sceneFixture({ heroOnPage: true, castIds: ['a', 'b'] }),
      sources: { heroPortrait: bytes(1) },
      budget: 3,
    });
    expect(labels).toEqual(['hero']);
  });

  it('places the previous page right after the hero (cascade priority)', () => {
    const { labels } = pickReferences({
      scene: sceneFixture({ heroOnPage: true, castIds: ['a'] }),
      sources: { heroPortrait: bytes(1), previousPage: bytes(9), castSheets: { a: bytes(2) } },
      budget: 3,
    });
    expect(labels).toEqual(['hero', 'prev', 'cast:a']);
  });

  it('drops the location before the previous page under a tight budget', () => {
    const { labels } = pickReferences({
      scene: sceneFixture({ heroOnPage: true, castIds: ['a'] }),
      sources: {
        heroPortrait: bytes(1),
        previousPage: bytes(9),
        castSheets: { a: bytes(2) },
        locationSheet: bytes(4),
      },
      budget: 3,
    });
    expect(labels).toEqual(['hero', 'prev', 'cast:a']); // location dropped
  });
});
