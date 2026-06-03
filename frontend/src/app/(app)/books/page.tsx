'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clearTokens, getAccessToken } from '@/lib/auth';
import { api } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Book {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  child: { name: string; age: number };
  learningGoal: { title: string };
}

export default function BooksPage(): React.ReactElement {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    void api.get<Book[]>('/books').then(setBooks);
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

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Мои книги
        </h1>
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

      {books.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Здесь будут ваши персонализированные книги.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {books.map((book) => (
            <li key={book.id}>
              <Link
                href={`/books/${book.id}`}
                className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {book.title || `Книга для ${book.child.name}`}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {book.child.name} · {book.child.age} лет · {book.learningGoal.title}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{book.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
