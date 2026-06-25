'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { genitiveName, pluralYears } from '@/lib/ru';
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
      <main className="mx-auto w-full max-w-[600px] px-7 py-10">
        <p className="text-sm text-danger">{error}</p>
        <Link href="/books" className="sg-back-link mt-4 inline-block">
          ← К списку книг
        </Link>
      </main>
    );
  }

  if (!book) {
    return (
      <main className="mx-auto w-full max-w-[600px] px-7 py-10">
        <div className="flex flex-col gap-4">
          <div className="h-8 w-48 animate-pulse rounded-md bg-surface-inset" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-surface-inset" />
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
    <main className="mx-auto w-full max-w-[600px] px-7 py-10">
      <Link href="/books" className="sg-back-link">
        ← К списку книг
      </Link>

      {/* Header */}
      <div className="mb-7 mt-4">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="sg-page-title">
            {book.title || book.storyJson?.title || `Книга для ${genitiveName(book.child.name)}`}
          </h1>
          <StatusBadge status={book.status} />
        </div>
        <p className="text-sm text-text-2">
          {book.child.name} · {book.child.age} {pluralYears(book.child.age)} ·{' '}
          {book.learningGoal.title}
        </p>
        <p className="mt-1 text-xs text-text-3">Создана {formatDate(book.createdAt)}</p>
      </div>

      {/* Quality stats */}
      {book.status === 'ready' && latestEval && (
        <div className="sg-card mb-6 flex flex-wrap gap-9 !py-5">
          <Stat label="Оценка качества" value={`${latestEval.finalScore.toFixed(1)} / 10`} />
          <Stat label="Попыток генерации" value={String(latestEval.attempt)} />
          <Stat label="Страниц" value={String(pages.length || book.imageKeys.length)} />
        </div>
      )}

      {/* Actions */}
      <div className="mb-8 flex flex-wrap gap-3">
        {book.status === 'ready' && book.pdfKey && (
          <button onClick={() => void handleDownloadPdf()} className="sg-btn sg-btn-primary">
            Скачать PDF
          </button>
        )}
        {book.status === 'pending' && (
          <button
            disabled={busy}
            onClick={() => void handleGenerate()}
            className="sg-btn sg-btn-primary"
          >
            {busy ? 'Запускаем…' : 'Запустить генерацию'}
          </button>
        )}
        {book.status === 'generating' && (
          <Link href={`/books/${id}/progress`} className="sg-btn sg-btn-ghost">
            Смотреть прогресс →
          </Link>
        )}
        {book.status === 'failed' && (
          <button
            disabled={busy}
            onClick={() => void handleGenerate()}
            className="sg-btn sg-btn-ghost text-danger"
          >
            {busy ? 'Запускаем…' : 'Повторить генерацию'}
          </button>
        )}
        {book.status === 'images_failed' && (
          <button
            disabled={busy}
            onClick={() => void handleRetryImages()}
            className="sg-btn sg-btn-ghost"
          >
            {busy ? 'Запускаем…' : 'Повторить создание изображений'}
          </button>
        )}
      </div>

      {/* Image load error */}
      {imageUrlError && (
        <div className="sg-card mb-6 border-warning-soft !py-3">
          <p className="text-sm text-text-2">
            Не удалось загрузить иллюстрации.{' '}
            <button
              onClick={() => {
                setImageUrlError(false);
                void api
                  .get<ImageUrlsResponse>(`/books/${id}/image-urls`)
                  .then((r) => setImageUrls(r.urls))
                  .catch(() => setImageUrlError(true));
              }}
              className="font-semibold text-primary underline"
            >
              Попробовать снова
            </button>
          </p>
        </div>
      )}

      {/* Story pages */}
      {pages.length > 0 && (
        <section className="mb-10">
          <h2 className="sg-section-title mb-4">Содержание книги</h2>
          <ol className="flex flex-col gap-[18px]">
            {pages.map((page) => (
              <li key={page.num} className="sg-page-row">
                {page.imageUrl ? (
                  <div className="sg-page-img">
                    <Image
                      src={page.imageUrl}
                      alt={`Иллюстрация страницы ${page.num}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className={`sg-page-img sg-cover-${(page.num - 1) % 5}`} />
                )}
                <div>
                  <span className="sg-page-n">Страница {page.num}</span>
                  <p className="sg-page-text">{page.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Discussion questions */}
      {questions.length > 0 && (
        <section className="sg-card">
          <h2 className="sg-section-title mb-4 !text-[18px]">Вопросы для обсуждения</h2>
          <ol className="flex flex-col gap-[14px]">
            {questions.map((q, i) => (
              <li key={i} className="flex items-start gap-[14px] text-sm leading-relaxed text-text">
                <span className="sg-q-num">{i + 1}</span>
                <span className="pt-0.5">{q}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Error explanation */}
      {TERMINAL_FAILED.includes(book.status) && pages.length === 0 && (
        <div className="sg-card border-danger-soft">
          <p className="text-sm text-danger">
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
    <div className="flex flex-col gap-1">
      <span className="sg-stat-l">{label}</span>
      <span className="sg-stat-v">{value}</span>
    </div>
  );
}
