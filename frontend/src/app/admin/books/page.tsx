'use client';

import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';

interface AdminBook {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  child: { name: string; age: number };
  learningGoal: { title: string };
  evals: { finalScore: number; passed: boolean; attempt: number }[];
}

const STATUS_OPTIONS = ['', 'pending', 'generating', 'ready', 'failed', 'images_failed'];

export default function AdminBooksPage(): React.ReactElement {
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  function load(): Promise<void> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return api
      .get<AdminBook[]>(`/admin/books?${params.toString()}`)
      .then((result) => {
        setError(null);
        setBooks(result);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err : new ApiError(0, 'Unknown error'));
      });
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-red-600 dark:text-red-400">
          {error.status === 403 ? 'Доступ запрещён.' : 'Не удалось загрузить книги.'}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Books</h1>
        <a
          href="/admin/metrics"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          → Metrics
        </a>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s || 'All statuses'}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          onClick={() => void load()}
          className="rounded bg-zinc-900 px-3 py-1 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Filter
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              {['Title', 'Child', 'Goal', 'Status', 'Score', 'Attempts', 'Created'].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {books.map((b) => {
              const latestEval = b.evals[0];
              return (
                <tr
                  key={b.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <td className="max-w-xs truncate px-3 py-2">
                    <a
                      href={`/books/${b.id}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {b.title || '(untitled)'}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                    {b.child.name} ({b.child.age}y)
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 text-zinc-700 dark:text-zinc-300">
                    {b.learningGoal.title}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                    {latestEval ? (
                      <span className={latestEval.passed ? 'text-green-600' : 'text-red-500'}>
                        {latestEval.finalScore.toFixed(1)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                    {latestEval ? latestEval.attempt : '—'}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {new Date(b.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                </tr>
              );
            })}
            {books.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zinc-400">
                  No books found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const cls: Record<string, string> = {
    ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    images_failed: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    generating: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    pending: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? 'bg-zinc-100 text-zinc-600'}`}
    >
      {status}
    </span>
  );
}
