'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ProgressEvent {
  type: 'generating' | 'progress' | 'ready' | 'failed' | 'images_failed';
  progress?: number;
  message?: string;
}

interface LogEntry {
  message: string;
  progress?: number;
}

interface BookStatus {
  status: 'pending' | 'generating' | 'ready' | 'failed' | 'images_failed';
}

const TERMINAL_FAILED = new Set(['failed', 'images_failed']);

// Friendly fallback copy when an event carries no message (so raw event types
// like "generating" never leak into the UI).
const TYPE_LABELS: Record<ProgressEvent['type'], string> = {
  generating: 'Придумываем историю…',
  progress: 'Работаем над книгой…',
  ready: 'Книга готова!',
  failed: 'Не удалось создать книгу',
  images_failed: 'Не удалось создать иллюстрации',
};

export default function BookProgressPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [log, setLog] = useState<LogEntry[]>([{ message: 'Подключаемся…' }]);
  const [failed, setFailed] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let settled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const cleanup = (): void => {
      esRef.current?.close();
      if (pollId) clearInterval(pollId);
    };
    // Resolve once, regardless of which signal (SSE event or status poll) wins.
    const settle = (action: () => void): void => {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    };
    const goReady = (): void => settle(() => router.replace(`/books/${id}`));
    const goFailed = (): void => settle(() => setFailed(true));

    // Poll book status. SSE over a proxy (Railway) can connect but never deliver
    // events, so polling is the reliable way to detect a terminal state.
    const checkStatus = (): Promise<void> =>
      api
        .get<BookStatus>(`/books/${id}`)
        .then((b) => {
          if (b.status === 'ready') goReady();
          else if (TERMINAL_FAILED.has(b.status)) goFailed();
        })
        .catch(() => {
          /* transient — a later poll or the SSE stream will resolve it */
        });

    void checkStatus().then(() => {
      if (settled) return;

      // EventSource cannot send Authorization headers — pass token as query param.
      const token = getAccessToken();
      const qs = token ? `?token=${encodeURIComponent(token)}` : '';
      const es = new EventSource(`${API_URL}/books/${id}/progress${qs}`);
      esRef.current = es;

      es.onmessage = (ev: MessageEvent<string>) => {
        const event = JSON.parse(ev.data) as ProgressEvent;
        setLog((prev) => [
          ...prev,
          {
            message: event.message ?? TYPE_LABELS[event.type] ?? 'Работаем…',
            progress: event.progress,
          },
        ]);
        if (event.type === 'ready') goReady();
        else if (event.type === 'failed' || event.type === 'images_failed') goFailed();
      };
      es.onerror = () => void checkStatus();

      // Fallback poll every 4s until a terminal state is reached.
      pollId = setInterval(() => void checkStatus(), 4000);
    });

    return () => {
      settled = true;
      cleanup();
    };
  }, [id, router]);

  const latest = log[log.length - 1];
  // Use the most recent entry that actually carried a numeric progress. On SSE
  // reconnect mid-generation the backend replays a bare `{ type: 'generating' }`
  // (no progress) as the first event, so reading only `latest` would snap the
  // bar back to 0% until the next real tick.
  const percent = [...log].reverse().find((e) => e.progress !== undefined)?.progress ?? 0;

  if (failed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col items-center px-6 py-16 text-center">
        <div className="mb-5 text-5xl">😔</div>
        <h1 className="sg-page-title mb-2">Что-то пошло не так</h1>
        <p className="mb-8 text-sm text-text-2">
          Книгу не удалось создать. Можно попробовать сгенерировать её заново.
        </p>
        <div className="flex gap-3">
          <Link href={`/books/${id}`} className="sg-btn sg-btn-primary">
            Вернуться к книге
          </Link>
          <Link href="/books" className="sg-btn sg-btn-ghost">
            Ко всем книгам
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-12">
      <div className="sg-card flex flex-col items-center !py-10 text-center">
        {/* Animated indicator */}
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary-soft opacity-60" />
          <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary-soft text-4xl">
            <span className="animate-bounce">📖</span>
          </span>
        </div>

        <h1 className="sg-page-title mb-2">Создаём книгу</h1>
        <p className="mb-8 text-sm text-text-2">
          Придумываем историю и рисуем иллюстрации — это займёт 1–2 минуты. Страницу можно не
          закрывать, мы всё сделаем сами.
        </p>

        {/* Progress */}
        <div className="mb-6 w-full">
          <div className="mb-1.5 flex justify-between text-xs font-medium text-text-2">
            <span>{latest?.message}</span>
            <span className="text-primary">{percent}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-inset">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Step log */}
        <ul className="flex w-full flex-col gap-2.5 text-left">
          {log.map((entry, i) => {
            const active = i === log.length - 1;
            return (
              <li
                key={i}
                className={`flex items-center gap-2.5 text-sm ${
                  active ? 'font-medium text-text' : 'text-text-3'
                }`}
              >
                {active ? (
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" />
                ) : (
                  <span className="shrink-0 text-primary">✓</span>
                )}
                {entry.message}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-6 text-center text-xs text-text-3">
        Не хотите ждать? Книга появится в{' '}
        <Link href="/books" className="font-medium text-primary underline">
          списке книг
        </Link>{' '}
        — можно вернуться позже.
      </p>
    </main>
  );
}
