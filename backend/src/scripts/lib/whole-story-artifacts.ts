/**
 * Blind-reading artefacts for the whole-story harness (STO-15), carried over
 * from the 2026-09-18 pilot (`issue/387-whole-story-pilot`, 91253c0): the
 * owner reads numbered tales with no case labels, verdicts or scores in the
 * document; the key lives in a separate file.
 */
export interface TaleForReading {
  id: string;
  title: string;
  text: string;
}

export interface BlindTale {
  number: number;
  title: string;
  text: string;
}

export const blindTales = (tales: TaleForReading[], order: string[]): BlindTale[] => {
  if (order.length !== tales.length || new Set(order).size !== tales.length)
    throw new Error('Blind mapping must contain every tale exactly once');
  return order.map((id, i) => {
    const tale = tales.find((s) => s.id === id);
    if (!tale) throw new Error(`Missing tale: ${id}`);
    return { number: i + 1, title: tale.title, text: tale.text };
  });
};

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const renderTale = (s: BlindTale): string =>
  `<article id="tale-${s.number}"><div class="label">СКАЗКА ${s.number}</div><h2>${escapeHtml(s.title)}</h2>${s.text
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('\n')}</article>`;

export const renderReading = (input: { tales: BlindTale[]; dateLabel: string }): string => {
  const { tales, dateLabel } = input;
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Сказки — чтение</title>
<style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f5f1e9;color:#292722;font:19px/1.75 Georgia,serif}
main{max-width:760px;margin:auto;padding:44px 24px}h1,h2,nav,.label,aside{font-family:system-ui,sans-serif}h1{font-size:32px;line-height:1.2}
h2{font-size:27px;line-height:1.35}p{margin:0 0 1em;white-space:pre-wrap}nav{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}
a{color:#795127}nav a{padding:6px 12px;background:#fff9ef;border-radius:8px;text-decoration:none}article{margin:60px 0;border-top:1px solid #d8cdbc;padding-top:28px}
.label{font-size:14px;letter-spacing:.06em;color:#796d5c}aside{font-size:15px;line-height:1.6;background:#fff9ef;padding:18px;border-radius:10px}
@media print{body{background:white;font-size:13pt}main{max-width:none;padding:0}nav{display:none}article{break-before:page}aside{background:white}}
</style></head><body><main>
<div class="label">STORYGROW · ЧТЕНИЕ · ${escapeHtml(dateLabel.toUpperCase())}</div>
<h1>${tales.length} ${tales.length === 1 ? 'сказка' : 'сказок'}</h1>
<p>Для взрослого чтения и обсуждения. Это экспериментальные тексты, ещё не принятые для выдачи детям. Порядок перемешан; цели и проверки скрыты. Тексты сохранены без литературной правки.</p>
<aside>Для каждого номера отметь: хочется ли дочитать; где скучно или неудобно произносить; понятен ли конец и почему он такой; что запомнилось; хочется ли прочитать ребёнку. Ответ «ни одна не подходит» тоже полезен.</aside>
<nav>${tales.map((s) => `<a href="#tale-${s.number}">${s.number}</a>`).join('')}</nav>
${tales.map(renderTale).join('\n')}
<aside>После всех: какие истории похожи друг на друга по устройству? Какая одна ближе всего к тому, что хочется дать ребёнку?</aside>
</main></body></html>`;
};
