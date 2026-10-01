import { blindTales, renderReading } from './whole-story-artifacts';

const tales = [
  { id: 'case-1-1', title: 'Один', text: '— Алиса, посмотри!\n\n<script>Привет</script>' },
  { id: 'case-2-1', title: 'Два', text: 'Тихо-тихо пришёл кот.' },
];

describe('whole-story reading artefacts', () => {
  it('preserves exact text in the blind order without exposing case identifiers', () => {
    const blind = blindTales(tales, ['case-2-1', 'case-1-1']);
    expect(blind.map((s) => s.text)).toEqual([tales[1].text, tales[0].text]);
    expect(blind.map((s) => s.number)).toEqual([1, 2]);
    expect(JSON.stringify(blind)).not.toContain('case-');
    expect(renderReading({ tales: blind, dateLabel: '24 сентября 2026' })).not.toContain('case-');
  });

  it('rejects an incomplete or duplicated mapping instead of silently losing a tale', () => {
    expect(() => blindTales(tales, ['case-1-1'])).toThrow();
    expect(() => blindTales(tales, ['case-1-1', 'case-1-1'])).toThrow();
  });

  it('escapes model-produced markup and preserves paragraph boundaries', () => {
    const html = renderReading({
      tales: blindTales(
        tales,
        tales.map((s) => s.id),
      ),
      dateLabel: '24 сентября 2026',
    });
    expect(html).toContain('&lt;script&gt;Привет&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('— Алиса, посмотри!</p>');
    expect(html).toContain('24 СЕНТЯБРЯ 2026');
  });
});
