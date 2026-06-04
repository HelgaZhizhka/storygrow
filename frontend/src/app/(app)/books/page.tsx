'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clearTokens, getAccessToken } from '@/lib/auth';
import { api } from '@/lib/api';
import type { BookStatus } from '@/lib/types';
import { StatusBadge } from '@/components/ui/StatusBadge';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Book {
  id: string;
  title: string;
  status: BookStatus;
  createdAt: string;
  child: { name: string; age: number };
  learningGoal: { title: string };
}

interface Quota {
  plan: string;
  used: number;
  limit: number | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
}

export default function BooksPage(): React.ReactElement {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    void api.get<Book[]>('/books').then(setBooks);
    void api.get<Quota>('/books/quota').then(setQuota);
  }, []);

  async function handleLogout(): Promise<void> {
    const token = getAccessToken();
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    clearTokens();
    router.replace('/login');
  }

  const quotaLabel =
    quota &&
    (quota.limit === null
      ? `${quota.plan} · безлимитно`
      : `${quota.plan} · ${quota.used} / ${quota.limit} книг`);

  const atLimit = quota && quota.limit !== null && quota.used >= quota.limit;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Мои книги
          </h1>
          {quotaLabel && (
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{quotaLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/books/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + Новая книга
          </Link>
          <button
            onClick={() => void handleLogout()}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Выйти
          </button>
        </div>
      </div>

      {atLimit && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          Лимит книг для тарифа «{quota.plan}» исчерпан.{' '}
          <Link href="/pricing" className="font-medium underline">
            Обновить тариф
          </Link>
        </div>
      )}

      {books.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-zinc-200 px-6 py-16 text-center dark:border-zinc-700">
          <div className="text-4xl">📚</div>
          <div>
            <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Пока нет ни одной книги
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              Создайте первую персонализированную историю для вашего ребёнка
            </p>
          </div>
          <Link
            href="/books/new"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Создать книгу
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {books.map((book) => (
            <li key={book.id}>
              <Link
                href={`/books/${book.id}`}
                className="group flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {book.title || `Книга для ${book.child.name}`}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {book.child.name} · {book.child.age} лет · {book.learningGoal.title}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDate(book.createdAt)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={book.status} />
                  <span className="text-zinc-300 transition-colors group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400">
                    →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
