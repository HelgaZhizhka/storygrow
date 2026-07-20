'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getUserEmail } from '@/lib/auth';
import { pluralYears } from '@/lib/ru';

interface Quota {
  plan: string;
  used: number;
  limit: number;
}

interface Child {
  id: string;
  name: string;
  age: number;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Бесплатный',
  premium: 'Premium',
};

export default function AccountPage(): React.ReactElement {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // getUserEmail reads localStorage, unavailable during SSR — a lazy useState
    // initializer would bake the server's `null` into the HTML and mismatch on
    // hydration once the client re-runs it with the real token, so this reads
    // post-mount instead, same as the quota/children fetches below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(getUserEmail());
    void api.get<Quota>('/books/quota').then(setQuota);
    void api.get<Child[]>('/children').then(setChildren);
  }, []);

  return (
    <main className="mx-auto w-full max-w-[680px] px-7 py-10">
      <h1 className="sg-page-title mb-7">Аккаунт</h1>

      <div className="sg-card mb-5">
        <span className="sg-section-label">Профиль</span>
        <p className="mt-2 text-text">{email ?? '—'}</p>
      </div>

      <div className="sg-card mb-5">
        <span className="sg-section-label">Подписка</span>
        {quota ? (
          <>
            <p className="mt-2 text-text">
              {PLAN_LABELS[quota.plan] ?? quota.plan} · {quota.used} / {quota.limit} книг в месяц
            </p>
            <Link href="/pricing" className="sg-btn sg-btn-ghost mt-3 inline-block">
              Сменить план
            </Link>
          </>
        ) : (
          <p className="mt-2 text-text-3">Загрузка…</p>
        )}
      </div>

      <div className="sg-card">
        <span className="sg-section-label">Дети</span>
        {children.length === 0 ? (
          <p className="mt-2 text-text-3">Пока нет добавленных детей.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {children.map((child) => (
              <li key={child.id} className="text-text">
                {child.name} · {child.age} {pluralYears(child.age)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
