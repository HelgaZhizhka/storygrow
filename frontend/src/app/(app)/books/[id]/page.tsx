'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface BookDetail {
  id: string;
  title: string;
  status: string;
  child: { name: string; age: number };
  learningGoal: { title: string };
  pdfKey: string | null;
}

export default function BookPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .get<BookDetail>(`/books/${id}`)
      .then(setBook)
      .catch(() => setError('Книга не найдена'));
  }, [id]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <p className="text-sm text-red-500">{error}</p>
        <Link href="/books" className="mt-4 inline-block text-sm text-zinc-500 hover:underline">
          ← К списку книг
        </Link>
      </main>
    );
  }

  if (!book) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <p className="text-sm text-zinc-400">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/books" className="mb-6 inline-block text-sm text-zinc-500 hover:underline">
        ← К списку книг
      </Link>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {book.title || `Книга для ${book.child.name}`}
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        {book.child.name} · {book.child.age} лет · {book.learningGoal.title}
      </p>

      <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Статус: <span className="font-medium text-zinc-900 dark:text-zinc-50">{book.status}</span>
        </p>
        {book.status === 'pending' && (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Книга ещё не сгенерирована. Нажмите кнопку ниже, чтобы запустить генерацию.
          </p>
        )}
      </div>
    </main>
  );
}
