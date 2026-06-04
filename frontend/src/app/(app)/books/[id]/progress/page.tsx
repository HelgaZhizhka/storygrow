'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ProgressEvent {
  type: 'generating' | 'progress' | 'ready' | 'failed';
  progress?: number;
  message?: string;
}

interface LogEntry {
  message: string;
  progress?: number;
}

interface BookStatus {
  status: 'pending' | 'generating' | 'ready' | 'failed' | 'images_failed' | 'generation_failed';
}

const TERMINAL_FAILED = new Set(['failed', 'generation_failed', 'images_failed']);

export default function BookProgressPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [log, setLog] = useState<LogEntry[]>([{ message: 'Подключаемся…' }]);
  const [failed, setFailed] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${API_URL}/books/${id}/progress`);
    esRef.current = es;

    es.onmessage = (ev: MessageEvent<string>) => {
      const event = JSON.parse(ev.data) as ProgressEvent;

      setLog((prev) => [
        ...prev,
        { message: event.message ?? event.type, progress: event.progress },
      ]);

      if (event.type === 'ready') {
        es.close();
        router.replace(`/books/${id}`);
      } else if (event.type === 'failed') {
        es.close();
        setFailed(true);
      }
    };

    es.onerror = () => {
      es.close();
      // SSE dropped — check actual book status before showing error
      api
        .get<BookStatus>(`/books/${id}`)
        .then((book) => {
          if (book.status === 'ready') {
            router.replace(`/books/${id}`);
          } else if (TERMINAL_FAILED.has(book.status)) {
            setFailed(true);
          }
          // still 'generating' or 'pending' — leave spinner, SSE will reconnect
        })
        .catch(() => {
          setFailed(true);
        });
    };

    return () => {
      es.close();
    };
  }, [id, router]);

  const latest = log[log.length - 1];

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Генерация книги
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        Ваша книга создаётся — это займёт 1–2 минуты.
      </p>

      {latest?.progress !== undefined && (
        <div className="mb-6">
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>{latest.message}</span>
            <span>{latest.progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all duration-500 dark:bg-zinc-50"
              style={{ width: `${latest.progress}%` }}
            />
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {log.map((entry, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400" />
            {entry.message}
          </li>
        ))}
      </ul>

      {failed && (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="mb-3 text-sm font-medium text-red-700 dark:text-red-400">
            Не удалось сгенерировать книгу.
          </p>
          <button
            onClick={() => router.replace(`/books/${id}`)}
            className="rounded-lg border border-red-200 px-4 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900"
          >
            Вернуться к книге
          </button>
        </div>
      )}
    </main>
  );
}
