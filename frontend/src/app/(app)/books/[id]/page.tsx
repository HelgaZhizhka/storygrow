'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface BookDetail {
  id: string;
  title: string;
  status: string;
  child: { name: string; age: number };
  learningGoal: { title: string };
  pdfKey: string | null;
}

interface PdfUrlResponse {
  url: string;
}

export default function BookPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    void api
      .get<BookDetail>(`/books/${id}`)
      .then(setBook)
      .catch(() => setError('Книга не найдена'));
  }, [id]);

  async function handleGenerate(): Promise<void> {
    setGenerating(true);
    try {
      await api.post(`/books/${id}/generate`, {});
      router.replace(`/books/${id}/progress`);
    } catch {
      setGenerating(false);
    }
  }

  async function handleDownloadPdf(): Promise<void> {
    try {
      const { url } = await api.get<PdfUrlResponse>(`/books/${id}/pdf-url`);
      window.open(url, '_blank');
    } catch {
      // silently ignore — user can retry
    }
  }

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

      <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Статус: <span className="font-medium text-zinc-900 dark:text-zinc-50">{book.status}</span>
        </p>

        {book.status === 'ready' && book.pdfKey && (
          <button
            onClick={() => void handleDownloadPdf()}
            className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Скачать PDF
          </button>
        )}

        {book.status === 'pending' && (
          <button
            disabled={generating}
            onClick={() => void handleGenerate()}
            className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {generating ? 'Запускаем…' : 'Запустить генерацию'}
          </button>
        )}

        {book.status === 'generating' && (
          <Link
            href={`/books/${id}/progress`}
            className="self-start text-sm text-zinc-500 underline hover:text-zinc-700"
          >
            Смотреть прогресс →
          </Link>
        )}

        {book.status === 'failed' && (
          <button
            disabled={generating}
            onClick={() => void handleGenerate()}
            className="self-start rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
          >
            {generating ? 'Запускаем…' : 'Повторить генерацию'}
          </button>
        )}
      </div>
    </main>
  );
}
