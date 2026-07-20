'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { AppHeader } from '@/components/ui/AppHeader';
import { PublicNav } from '@/components/ui/PublicNav';

interface Plan {
  name: string;
  price: string;
  period: string;
  books: string;
  features: string[];
  cta: string;
}

const PLAN: Plan = {
  name: 'Premium',
  price: '20 €',
  period: '/ мес',
  books: '30 книг в месяц',
  features: [
    'Персонализированные истории',
    'PDF скачивание',
    'Иллюстрации ИИ',
    'Приоритетная генерация',
  ],
  cta: 'Подключить',
};

export default function PricingPage(): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Reachable from inside the app (AppHeader's "Тарифы" link) as well as
  // anonymously — starts false to match SSR (no localStorage there), set
  // post-mount so the nav doesn't flip and cause a hydration mismatch.
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // isAuthenticated() reads localStorage, unavailable during SSR — reading
    // it in a lazy useState initializer instead would bake the server's
    // `false` into the HTML and mismatch on hydration once the client
    // re-runs it with the real value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthed(isAuthenticated());
  }, []);

  async function handleSubscribe(): Promise<void> {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { url } = await api.post<{ url: string }>('/api/stripe/subscribe', {});
      window.location.assign(url);
    } catch {
      setError('Не удалось создать сессию оплаты. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {authed ? <AppHeader /> : <PublicNav />}
      <main className="mx-auto max-w-[940px] px-7 pb-[120px] pt-10">
        <div className="pricing-head">
          <span className="eyebrow">Тариф</span>
          <h1 className="sg-page-title my-[14px]">Один план — всё включено</h1>
          <p className="muted max-w-[46ch]">
            Создавайте персонализированные книги с педагогическим контролем качества.
          </p>
        </div>

        {error && <p className="mb-6 text-center text-sm text-danger">{error}</p>}

        <div className="plans">
          <div className="plan plan--featured">
            <h2 className="plan__name">{PLAN.name}</h2>
            <div className="plan__price">
              {PLAN.price}
              <span>{PLAN.period}</span>
            </div>
            <p className="plan__books">{PLAN.books}</p>
            <ul className="plan__features">
              {PLAN.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button
              onClick={() => void handleSubscribe()}
              disabled={loading}
              className="sg-btn w-full sg-btn-primary"
            >
              {loading ? 'Загрузка…' : PLAN.cta}
            </button>
          </div>
        </div>

        <p className="muted mt-8 text-center text-sm">Отмена в любой момент.</p>
      </main>
    </>
  );
}
