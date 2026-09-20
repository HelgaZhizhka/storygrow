import { blindStories, countWords, renderReading } from './whole-story-artifacts';

const stories = [
  { id: 'kindness-A', title: 'Один', text: '— Алиса, посмотри!\n\n<script>Привет</script>' },
  { id: 'kindness-B', title: 'Два', text: 'Тихо-тихо пришёл кот.' },
];

describe('whole-story pilot reading artefacts', () => {
  it('preserves exact text in assigned order without exposing arm identifiers', () => {
    const blind = blindStories(stories, ['kindness-B', 'kindness-A']);
    expect(blind.map((s) => s.text)).toEqual([stories[1].text, stories[0].text]);
    expect(blind.map((s) => s.number)).toEqual([1, 2]);
    expect(JSON.stringify(blind)).not.toContain('kindness-');
    expect(renderReading(blind)).not.toContain('kindness-');
  });

  it('rejects incomplete or duplicated mapping instead of silently losing a story', () => {
    expect(() => blindStories(stories, ['kindness-A'])).toThrow();
    expect(() => blindStories(stories, ['kindness-A', 'kindness-A'])).toThrow();
  });

  it('escapes model-produced markup and preserves paragraph boundaries', () => {
    const html = renderReading(
      blindStories(
        stories,
        stories.map((s) => s.id),
      ),
    );
    expect(html).toContain('&lt;script&gt;Привет&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('— Алиса, посмотри!</p>');
  });

  it('counts words without counting a standalone dialogue dash', () => {
    expect(countWords('— Алиса, посмотри! Тихо-тихо пришёл кот.')).toBe(5);
  });
});
