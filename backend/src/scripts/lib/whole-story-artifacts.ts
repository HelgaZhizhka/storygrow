export interface PilotStory {
  id: string;
  title: string;
  text: string;
}

export interface BlindStory {
  number: number;
  title: string;
  text: string;
}

export const countWords = (text: string): number =>
  (text.match(/[А-Яа-яЁёA-Za-z0-9]+(?:[-‑][А-Яа-яЁёA-Za-z0-9]+)*/g) ?? []).length;

export const blindStories = (stories: PilotStory[], order: string[]): BlindStory[] => {
  if (order.length !== stories.length || new Set(order).size !== stories.length)
    throw new Error('Blind mapping must contain every story exactly once');
  return order.map((id, i) => {
    const story = stories.find((s) => s.id === id);
    if (!story) throw new Error(`Missing story: ${id}`);
    return { number: i + 1, title: story.title, text: story.text };
  });
};

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const renderReading = (stories: BlindStory[]): string => `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Шесть сказок — первое чтение</title>
<style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f5f1e9;color:#292722;font:19px/1.75 Georgia,serif}
main{max-width:760px;margin:auto;padding:44px 24px}h1,h2,nav,.label,aside{font-family:system-ui,sans-serif}h1{font-size:32px;line-height:1.2}
h2{font-size:27px;line-height:1.35}p{margin:0 0 1em;white-space:pre-wrap}nav{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}
a{color:#795127}nav a{padding:6px 12px;background:#fff9ef;border-radius:8px;text-decoration:none}article{margin:60px 0;border-top:1px solid #d8cdbc;padding-top:28px}
.label{font-size:14px;letter-spacing:.06em;color:#796d5c}aside{font-size:15px;line-height:1.6;background:#fff9ef;padding:18px;border-radius:10px}
@media print{body{background:white;font-size:13pt}main{max-width:none;padding:0}nav{display:none}article{break-before:page}aside{background:white}}
</style></head><body><main>
<div class="label">STORYGROW · ПЕРВОЕ ЧТЕНИЕ · 18 СЕНТЯБРЯ 2026</div>
<h1>Шесть сказок</h1>
<p>Для взрослого чтения и обсуждения. Это экспериментальные тексты, ещё не принятые для выдачи детям. Варианты перемешаны; способ написания скрыт. Тексты сохранены без литературной правки.</p>
<aside>Можно читать в несколько подходов. Для каждого номера отметь: хочется ли дочитать; где скучно или неудобно произносить; понятен ли конец; что запомнилось; хочется ли прочитать ребёнку. Ответ «ни одна не подходит» тоже полезен.</aside>
<nav>${stories.map((s) => `<a href="#story-${s.number}">${s.number}</a>`).join('')}</nav>
${stories
  .map(
    (s) =>
      `<article id="story-${s.number}"><div class="label">СКАЗКА ${s.number}</div><h2>${escapeHtml(s.title)}</h2>${s.text
        .split(/\n\s*\n/)
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('\n')}</article>`,
  )
  .join('\n')}
<aside>После всех шести: какие истории похожи друг на друга? Какие два номера хочется обсудить в первую очередь?</aside>
</main></body></html>`;
