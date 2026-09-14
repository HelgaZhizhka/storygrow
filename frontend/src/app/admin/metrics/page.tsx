'use client';

import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';

interface Metrics {
  windowDays: number;
  totalBooks: number;
  readyBooks: number;
  passedFirstAttempt: number;
  passRate: number;
  meanFinalScore: number | null;
  meanCriterionScores: Record<string, number>;
  recentEvalCount: number;
}

interface ImageMetrics {
  windowDays: number;
  attempts: number;
  pages: number;
  firstAttemptPassRate: number | null;
  reRenders: number;
  blocked: number;
  unavailable: number;
  topFailures: Array<{ criterion: string; count: number }>;
  costByModel: Array<{ model: string; pages: number; artefacts: number; usd: number }>;
}

const CRITERION_LABELS: Record<string, string> = {
  ageAppropriateVocab: 'Vocabulary',
  hasMoralLesson: 'Moral lesson',
  structureCompleteness: 'Narrative structure',
  safetyForChildren: 'Safety',
  length: 'Length',
  earnedResolution: 'Earned resolution',
  registerMatch: 'Register match',
};

export default function AdminMetricsPage(): React.ReactElement {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [images, setImages] = useState<ImageMetrics | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    const fail = (err: unknown): void => {
      setError(err instanceof ApiError ? err : new ApiError(0, 'Unknown error'));
    };
    api.get<Metrics>('/admin/metrics').then(setMetrics).catch(fail);
    api.get<ImageMetrics>('/admin/metrics/images').then(setImages).catch(fail);
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-red-600 dark:text-red-400">
          {error.status === 403 ? 'Доступ запрещён.' : 'Не удалось загрузить метрики.'}
        </p>
      </main>
    );
  }

  if (!metrics) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-zinc-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Metrics</h1>
        <a href="/admin/books" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Books
        </a>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total books" value={metrics.totalBooks} />
        <StatCard label="Ready books" value={metrics.readyBooks} />
        <StatCard label="Pass rate" value={`${(metrics.passRate * 100).toFixed(1)}%`} />
        <StatCard label="Passed 1st attempt" value={metrics.passedFirstAttempt} />
      </div>

      <div className="mb-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
        <h2 className="mb-1 text-base font-medium text-zinc-900 dark:text-zinc-50">
          Last {metrics.windowDays} days — {metrics.recentEvalCount} evaluations
        </h2>
        {metrics.meanFinalScore !== null ? (
          <p className="mb-4 text-sm text-zinc-500">
            Mean final score:{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {metrics.meanFinalScore.toFixed(2)} / 10
            </span>
          </p>
        ) : (
          <p className="mb-4 text-sm text-zinc-400">No passed evaluations yet</p>
        )}

        <div className="flex flex-col gap-3">
          {Object.entries(metrics.meanCriterionScores).map(([key, score]) => (
            <div key={key}>
              <div className="mb-1 flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                <span>{CRITERION_LABELS[key] ?? key}</span>
                <span>{score.toFixed(2)} / 10</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(score * 10, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {images && <ImagesSection images={images} />}
    </main>
  );
}

// Image pipeline (#379): outcomes of the vision judge and cost per provider,
// derived from ImageEval rows — a bad page is diagnosable without LangFuse.
function ImagesSection({ images }: { images: ImageMetrics }): React.ReactElement {
  const passRate =
    images.firstAttemptPassRate === null
      ? '—'
      : `${(images.firstAttemptPassRate * 100).toFixed(0)}%`;
  return (
    <div className="mb-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
      <h2 className="mb-4 text-base font-medium text-zinc-900 dark:text-zinc-50">
        Images, last {images.windowDays} days — {images.pages} pages, {images.attempts} renders
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Passed 1st attempt" value={passRate} />
        <StatCard label="Re-renders" value={images.reRenders} />
        <StatCard label="Judge blocked" value={images.blocked} />
        <StatCard label="Judge unavailable" value={images.unavailable} />
      </div>
      {images.topFailures.length > 0 && (
        <ul className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          {images.topFailures.map((f) => (
            <li key={f.criterion} className="flex justify-between">
              <span>{f.criterion}</span>
              <span>{f.count}</span>
            </li>
          ))}
        </ul>
      )}
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-zinc-500">
          <tr>
            <th className="py-1">Model</th>
            <th className="py-1 text-right">Pages</th>
            <th className="py-1 text-right">Portraits + sheets</th>
            <th className="py-1 text-right">USD</th>
          </tr>
        </thead>
        <tbody>
          {images.costByModel.map((c) => (
            <tr key={c.model} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-1">{c.model}</td>
              <td className="py-1 text-right">{c.pages}</td>
              <td className="py-1 text-right">{c.artefacts}</td>
              <td className="py-1 text-right">${c.usd.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-zinc-400">
        Cost from the per-image prices in ai.config; the vision judge is not included.
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }): React.ReactElement {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}
