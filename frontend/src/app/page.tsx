import Link from 'next/link';
import { PublicNav } from '@/components/ui/PublicNav';
import { StartCtaButton } from '@/components/ui/StartCtaButton';

const FEATURES = [
  {
    icon: '✦',
    title: 'Настоящая персонализация',
    text: 'Имя, возраст, внешность и интересы ребёнка вплетаются в сюжет и иллюстрации — он узнаёт себя на каждой странице.',
  },
  {
    icon: '◆',
    title: 'Педагогический контроль',
    text: 'Каждая история проходит автоматическую оценку: сложность лексики под возраст, ясная мораль, безопасность содержания.',
  },
  {
    icon: '❋',
    title: 'Книга, которую хочется хранить',
    text: 'Профессиональная вёрстка A5, мягкие иллюстрации и вопросы для обсуждения. Скачивайте PDF и печатайте дома.',
  },
];

const STEPS = [
  {
    title: 'Расскажите о ребёнке',
    text: 'Имя, возраст и пара слов о внешности. Выберите цель обучения — от доброты до уборки игрушек.',
  },
  {
    title: 'Выберите стиль',
    text: 'Акварель, мультяшный или книжная иллюстрация. Ребёнок как герой или наблюдатель истории.',
  },
  {
    title: 'Получите PDF',
    text: 'ИИ напишет историю и нарисует иллюстрации. Через пару минут книга готова к чтению и печати.',
  },
];

export default function HomePage(): React.ReactElement {
  return (
    <>
      <PublicNav />

      <section className="lp-hero">
        <div>
          <span className="chip">
            <span className="sg-spark sg-spark--indigo" />
            Персональные книги с ИИ
          </span>
          <h1 className="h-display lp-hero__title">
            Книги, где ваш ребёнок — <span className="text-grad">главный герой</span>
          </h1>
          <p className="lp-hero__sub">
            StoryGrow создаёт волшебные иллюстрированные истории под имя, возраст и цель обучения
            вашего ребёнка. С педагогическим контролем качества и красивым PDF на выходе.
          </p>
          <div className="lp-hero__actions">
            <StartCtaButton className="sg-btn sg-btn-primary sg-btn-lg">
              Создать книгу
            </StartCtaButton>
            <Link href="/pricing" className="sg-btn sg-btn-ghost sg-btn-lg">
              Смотреть тарифы
            </Link>
          </div>
          <div className="lp-trust">
            <span>
              <b>4.9</b> средняя оценка качества из 5
            </span>
            <span className="lp-trust__dot" />
            <span>
              Возраст <b>5–8</b> лет
            </span>
            <span className="lp-trust__dot" />
            <span>
              PDF за <b>1–2</b> минуты
            </span>
          </div>
        </div>
        <div className="lp-hero__art">
          <div className="book-3d">
            <div className="book-3d__spine" />
            <div className="book-3d__face">
              <div className="cover-art" />
              <div className="cover-overlay">
                <span className="cover-eyebrow">Волшебная история</span>
                <h3 className="cover-title">Лучик и потерянная звезда</h3>
                <div className="rule" />
              </div>
              <div className="cover-wordmark">
                <span className="sg-spark" />
                StoryGrow
              </div>
            </div>
          </div>
          <span className="float-star s1" />
          <span className="float-star s2" />
          <span className="float-star s3" />
        </div>
      </section>

      <section className="lp-section" id="features">
        <div className="lp-section__head">
          <span className="eyebrow">Почему родители выбирают нас</span>
          <h2 className="h-display lp-h2">Технологии на службе у воображения</h2>
        </div>
        <div className="lp-features">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <div className="feature__icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section lp-section--alt" id="how">
        <div className="lp-section__head">
          <span className="eyebrow">Три шага</span>
          <h2 className="h-display lp-h2">От идеи до готовой книги</h2>
        </div>
        <div className="lp-steps">
          {STEPS.map((s, i) => (
            <div className="step" key={s.title}>
              <span className="step__n">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section__head lp-section__head--center">
          <span className="eyebrow">Как выглядят страницы</span>
          <h2 className="h-display lp-h2">Каждый разворот — маленькое волшебство</h2>
        </div>
        <div className="lp-pages">
          <div className="lp-page-card sg-cover-0" />
          <div className="lp-page-card sg-cover-1" />
          <div className="lp-page-card sg-cover-2" />
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-cta__inner">
          <h2 className="h-display">Создайте первую книгу сегодня</h2>
          <p>14 дней бесплатно. Отмена в любой момент.</p>
          <StartCtaButton className="sg-btn sg-btn-lg">Начать бесплатно</StartCtaButton>
        </div>
      </section>

      <footer className="lp-footer">
        <Link href="/" className="sg-wordmark">
          <span className="sg-spark" />
          StoryGrow
        </Link>
        <span className="muted">© 2026 StoryGrow · Волшебные книги для детей</span>
      </footer>
    </>
  );
}
