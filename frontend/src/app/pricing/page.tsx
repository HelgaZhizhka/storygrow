'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

interface Plan {
  id: 'basic' | 'premium';
  name: string;
  price: string;
  books: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: '299 ₽ / мес',
    books: '10 книг в месяц',
    features: ['Персонализированные истории', 'PDF скачивание', 'Иллюстрации DALL-E'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '699 ₽ / мес',
    books: 'Безлимитные книги',
    features: [
      'Персонализированные истории',
      'PDF скачивание',
      'Иллюстрации DALL-E',
      'Приоритетная генерация',
      'Ранний доступ к новым функциям',
    ],
  },
];

export default function PricingPage(): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState<'basic' | 'premium' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(plan: 'basic' | 'premium'): Promise<void> {
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
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="mb-4 text-center text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Тарифы
      </h1>
      <p className="mb-12 text-center text-lg text-zinc-500 dark:text-zinc-400">
        Создавайте персонализированные детские книги с педагогическим контролем качества
      </p>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="flex flex-col rounded-2xl border border-zinc-200 p-8 dark:border-zinc-700"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {plan.name}
              </h2>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                {plan.price}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{plan.books}</p>
            </div>

            <ul className="mb-8 flex-1 space-y-2">
              {plan.features.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300"
                >
                  <span className="text-green-500">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => void handleSubscribe(plan.id)}
              disabled={loading !== null}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading === plan.id ? 'Загрузка…' : 'Подключить'}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-zinc-400">
        Все тарифы включают 14-дневный пробный период. Отмена в любой момент.
      </p>
    </main>
  );
}
