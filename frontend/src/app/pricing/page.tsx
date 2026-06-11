'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { PublicNav } from '@/components/ui/PublicNav';

type PlanId = 'basic' | 'premium';

interface Plan {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  books: string;
  features: string[];
  featured?: boolean;
  cta: string;
}

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: '299 ₽',
    period: '/ мес',
    books: '10 книг в месяц',
    features: ['Персонализированные истории', 'PDF скачивание', 'Иллюстрации ИИ'],
    cta: 'Подключить',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '699 ₽',
    period: '/ мес',
    books: 'Безлимитные книги',
    features: [
      'Персонализированные истории',
      'PDF скачивание',
      'Иллюстрации ИИ',
      'Приоритетная генерация',
      'Ранний доступ к новинкам',
    ],
    featured: true,
    cta: 'Подключить Premium',
  },
];

export default function PricingPage(): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(plan: PlanId): Promise<void> {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    setLoading(plan);
    setError(null);

    try {
      const { url } = await api.post<{ url: string }>('/api/stripe/subscribe', { plan });
      window.location.assign(url);
    } catch {
      setError('Не удалось создать сессию оплаты. Попробуйте позже.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-[940px] px-7 pb-[120px] pt-10">
        <div className="pricing-head">
          <span className="eyebrow">Тарифы</span>
          <h1 className="sg-page-title my-[14px]">Выберите свой план</h1>
          <p className="muted max-w-[46ch]">
            Создавайте персонализированные книги с педагогическим контролем качества. 14 дней
            бесплатно.
          </p>
        </div>

        {error && <p className="mb-6 text-center text-sm text-danger">{error}</p>}

        <div className="plans">
          {PLANS.map((plan) => (
            <div key={plan.id} className={`plan${plan.featured ? ' plan--featured' : ''}`}>
              {plan.featured && <span className="plan__tag">Популярный</span>}
              <h2 className="plan__name">{plan.name}</h2>
              <div className="plan__price">
                {plan.price}
                <span>{plan.period}</span>
              </div>
              <p className="plan__books">{plan.books}</p>
              <ul className="plan__features">
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button
                onClick={() => void handleSubscribe(plan.id)}
                disabled={loading !== null}
                className={`sg-btn w-full ${plan.featured ? 'sg-btn-primary' : 'sg-btn-ghost'}`}
              >
                {loading === plan.id ? 'Загрузка…' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="muted mt-8 text-center text-sm">
          Все тарифы включают 14-дневный пробный период. Отмена в любой момент.
        </p>
      </main>
    </>
  );
}
