'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import type { BookStatus } from '@/lib/types';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface DbPage {
  pageNumber: number;
  text: string;
  imageUrl: string | null;
}

interface StoryPage {
  pageNumber?: number;
  title?: string;
  text: string;
  illustrationPrompt?: string;
}

interface StoryJson {
  title?: string;
  pages?: StoryPage[];
  discussionQuestions?: string[];
}

interface StoryEval {
  finalScore: number;
  attempt: number;
  passed: boolean;
}

interface BookDetail {
  id: string;
  title: string;
  status: BookStatus;
  pdfKey: string | null;
  createdAt: string;
  storyJson: StoryJson | null;
  imageKeys: string[];
  child: { name: string; age: number };
  learningGoal: { title: string };
  pages: DbPage[];
  evals: StoryEval[];
}

interface PdfUrlResponse {
  url: string;
}
interface ImageUrlsResponse {
  urls: string[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const TERMINAL_FAILED: BookStatus[] = ['failed', 'images_failed'];

export default function BookPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageUrlError, setImageUrlError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .get<BookDetail>(`/books/${id}`)
      .then((b) => {
        setBook(b);
        if (b.status === 'ready' && b.imageKeys.length > 0) {
          void api
            .get<ImageUrlsResponse>(`/books/${id}/image-urls`)
            .then((r) => setImageUrls(r.urls))
            .catch(() => setImageUrlError(true));
        }
      })
      .catch(() => setError('Книга не найдена'));
  }, [id]);

  async function handleGenerate(): Promise<void> {
    setBusy(true);
    try {
      await api.post(`/books/${id}/generate`, {});
      router.replace(`/books/${id}/progress`);
    } catch {
      setBusy(false);
    }
  }

  async function handleRetryImages(): Promise<void> {
    setBusy(true);
    try {
      await api.post(`/books/${id}/retry-images`, {});
      router.replace(`/books/${id}/progress`);
    } catch {
      setBusy(false);
    }
  }

  async function handleDownloadPdf(): Promise<void> {
    try {
      const { url } = await api.get<PdfUrlResponse>(`/books/${id}/pdf-url`);
      window.open(url, '_blank');
    } catch {
      /* user can retry */
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
        <div className="flex flex-col gap-4">
          <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </main>
    );
  }

  const latestEval = book.evals[0];

  // Prefer DB pages (fast-flow), fall back to storyJson pages (custom flow)
  const pages: Array<{ num: number; text: string; imageUrl: string | null }> =
    book.pages.length > 0
      ? book.pages.map((p) => ({ num: p.pageNumber, text: p.text, imageUrl: p.imageUrl }))
      : (book.storyJson?.pages ?? []).map((p, i) => ({
          num: i + 1,
          text: p.text,
          imageUrl: imageUrls[i] ?? null,
        }));

  const questions = book.storyJson?.discussionQuestions ?? [];

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link
        href="/books"
        className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        ← К списку книг
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {book.title || book.storyJson?.title || `Книга для ${book.child.name}`}
          </h1>
          <StatusBadge status={book.status} />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {book.child.name} · {book.child.age} {pluralYears(book.child.age)} ·{' '}
          {book.learningGoal.title}
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Создана {formatDate(book.createdAt)}
        </p>
      </div>

      {/* Quality stats */}
      {book.status === 'ready' && latestEval && (
        <div className="mb-6 flex flex-wrap gap-6 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <Stat label="Оценка качества" value={`${latestEval.finalScore.toFixed(1)} / 10`} />
          <Stat label="Попыток генерации" value={String(latestEval.attempt)} />
          <Stat label="Страниц" value={String(pages.length || book.imageKeys.length)} />
        </div>
      )}

      {/* Actions */}
      <div className="mb-8 flex flex-wrap gap-3">
        {book.status === 'ready' && book.pdfKey && (
          <button
            onClick={() => void handleDownloadPdf()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Скачать PDF
          </button>
        )}
        {book.status === 'pending' && (
          <button
            disabled={busy}
            onClick={() => void handleGenerate()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {busy ? 'Запускаем…' : 'Запустить генерацию'}
          </button>
        )}
        {book.status === 'generating' && (
          <Link
            href={`/books/${id}/progress`}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            Смотреть прогресс →
          </Link>
        )}
        {book.status === 'failed' && (
          <button
            disabled={busy}
            onClick={() => void handleGenerate()}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
          >
            {busy ? 'Запускаем…' : 'Повторить генерацию'}
          </button>
        )}
        {book.status === 'images_failed' && (
          <button
            disabled={busy}
            onClick={() => void handleRetryImages()}
            className="rounded-lg border border-orange-200 px-4 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-50 disabled:opacity-50"
          >
            {busy ? 'Запускаем…' : 'Повторить создание изображений'}
          </button>
        )}
      </div>

      {/* Image load error */}
      {imageUrlError && (
        <div className="mb-6 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Не удалось загрузить иллюстрации.{' '}
            <button
              onClick={() => {
                setImageUrlError(false);
                void api
                  .get<ImageUrlsResponse>(`/books/${id}/image-urls`)
                  .then((r) => setImageUrls(r.urls))
                  .catch(() => setImageUrlError(true));
              }}
              className="font-medium underline"
            >
              Попробовать снова
            </button>
          </p>
        </div>
      )}

      {/* Story pages */}
      {pages.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-base font-semibold text-zinc-800 dark:text-zinc-200">
            Содержание книги
          </h2>
          <ol className="flex flex-col gap-6">
            {pages.map((page) => (
              <li
                key={page.num}
                className="flex flex-col gap-3 rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
              >
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Страница {page.num}
                </span>
                {page.imageUrl && (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                    <Image
                      src={page.imageUrl}
                      alt={`Иллюстрация страницы ${page.num}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                )}
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {page.text}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Discussion questions */}
      {questions.length > 0 && (
        <section className="rounded-lg border border-zinc-100 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Вопросы для обсуждения
          </h2>
          <ol className="flex flex-col gap-2">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="shrink-0 font-medium text-zinc-400">{i + 1}.</span>
                {q}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Error explanation */}
      {TERMINAL_FAILED.includes(book.status) && pages.length === 0 && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-400">
            {book.status === 'images_failed'
              ? 'Текст книги создан, но при генерации изображений произошла ошибка. Попробуйте повторить.'
              : 'При создании книги произошла ошибка. Попробуйте сгенерировать снова.'}
          </p>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-zinc-400 dark:text-zinc-500">{label}</span>
      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{value}</span>
    </div>
  );
}

function pluralYears(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'год';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'года';
  return 'лет';
}
