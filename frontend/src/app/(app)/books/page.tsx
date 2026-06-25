'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { clearTokens, getAccessToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { genitiveName, pluralYears } from '@/lib/ru';
import type { BookStatus } from '@/lib/types';
import { StatusBadge } from '@/components/ui/StatusBadge';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Book {
  id: string;
  title: string;
  status: BookStatus;
  createdAt: string;
  coverUrl: string | null;
  child: { name: string; age: number };
  learningGoal: { title: string };
}

interface Quota {
  plan: string;
  used: number;
  limit: number | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
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
    <main className="mx-auto w-full max-w-[940px] px-7 py-10">
      <div className="mb-8 flex items-start justify-between gap-5">
        <div>
          <h1 className="sg-page-title">Мои книги</h1>
          {quotaLabel && <p className="mt-2 text-sm text-text-3">{quotaLabel}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/books/new" className="sg-btn sg-btn-primary">
            + Новая книга
          </Link>
          <button onClick={() => void handleLogout()} className="sg-btn sg-btn-ghost">
            Выйти
          </button>
        </div>
      </div>

      {atLimit && (
        <div className="sg-card mb-6 border-warning-soft !py-3 text-sm text-text-2">
          Лимит книг для тарифа «{quota.plan}» исчерпан.{' '}
          <Link href="/pricing" className="font-semibold text-primary underline">
            Обновить тариф
          </Link>
        </div>
      )}

      {books.length === 0 ? (
        <div className="sg-card flex flex-col items-center gap-4 !py-16 text-center">
          <div className="text-4xl">📚</div>
          <div>
            <p className="mb-1 font-semibold text-text">Пока нет ни одной книги</p>
            <p className="text-sm text-text-2">
              Создайте первую персонализированную историю для вашего ребёнка
            </p>
          </div>
          <Link href="/books/new" className="sg-btn sg-btn-primary">
            Создать книгу
          </Link>
        </div>
      ) : (
        <div className="sg-book-grid">
          {books.map((book, i) => (
            <Link key={book.id} href={`/books/${book.id}`} className="sg-book-card">
              <div className={`sg-book-cover sg-cover-${i % 5}`}>
                {book.coverUrl && (
                  <Image
                    src={book.coverUrl}
                    alt={book.title || `Книга для ${genitiveName(book.child.name)}`}
                    fill
                    unoptimized
                    sizes="220px"
                    className="object-cover"
                  />
                )}
                <span className="sg-book-cover-badge">
                  <StatusBadge status={book.status} />
                </span>
              </div>
              <div className="sg-book-body">
                <h3 className="sg-book-title">
                  {book.title || `Книга для ${genitiveName(book.child.name)}`}
                </h3>
                <div className="sg-book-meta">
                  {book.child.name} · {book.child.age} {pluralYears(book.child.age)} ·{' '}
                  {book.learningGoal.title}
                </div>
                <div className="sg-book-date">{formatDate(book.createdAt)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
