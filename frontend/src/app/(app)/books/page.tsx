'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { genitiveName, pluralYears } from '@/lib/ru';
import type { BookStatus } from '@/lib/types';
import { StatusBadge } from '@/components/ui/StatusBadge';

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
  const [books, setBooks] = useState<Book[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void api.get<Book[]>('/books').then(setBooks);
    void api.get<Quota>('/books/quota').then(setQuota);
  }, []);

  async function handleDelete(id: string): Promise<void> {
    setDeletingId(id);
    try {
      await api.delete(`/books/${id}`);
      setBooks((prev) => prev.filter((b) => b.id !== id));
      setConfirmId(null);
      void api.get<Quota>('/books/quota').then(setQuota);
    } catch {
      /* leave the confirm open so the user can retry */
    } finally {
      setDeletingId(null);
    }
  }

  const quotaLabel =
    quota &&
    (quota.limit === null
      ? `${quota.plan} · безлимитно`
      : `${quota.plan} · ${quota.used} / ${quota.limit} книг`);

  const atLimit = quota && quota.limit !== null && quota.used >= quota.limit;

  return (
    <main className="mx-auto w-full max-w-[940px] px-7 py-10">
      <div className="mb-8">
        <h1 className="sg-page-title">Мои книги</h1>
        {quotaLabel && <p className="mt-2 text-sm text-text-3">{quotaLabel}</p>}
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
            <div key={book.id} className="sg-book-card group relative">
              <Link
                href={`/books/${book.id}`}
                aria-label={book.title || `Книга для ${genitiveName(book.child.name)}`}
                className="absolute inset-0 z-0"
              />
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

              <button
                type="button"
                aria-label="Удалить книгу"
                onClick={() => setConfirmId(book.id)}
                className="absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-base leading-none text-white opacity-0 transition hover:bg-black/60 focus-visible:opacity-100 group-hover:opacity-100"
              >
                ×
              </button>

              {confirmId === book.id && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[inherit] bg-surface-inset p-4 text-center">
                  <p className="text-sm font-medium text-text">Удалить книгу?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={deletingId === book.id}
                      onClick={() => void handleDelete(book.id)}
                      className="sg-btn sg-btn-ghost text-danger"
                    >
                      {deletingId === book.id ? 'Удаляем…' : 'Удалить'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="sg-btn sg-btn-ghost"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
