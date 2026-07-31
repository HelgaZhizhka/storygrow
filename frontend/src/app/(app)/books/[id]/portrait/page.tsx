'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Preview {
  portraitUrl: string;
  descriptor: string;
}

export default function PortraitPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [descriptor, setDescriptor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fail(err: unknown, fallback: string): void {
    setError(err instanceof Error && err.message ? err.message : fallback);
  }

  async function buildPortrait(): Promise<void> {
    if (!file || !consent) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('photo', file);
      form.append('consent', 'true');
      await api.postForm(`/books/${id}/photo`, form);
      const res = await api.post<Preview>(`/books/${id}/portrait`, {});
      setPreview(res);
      setDescriptor(res.descriptor);
    } catch (err) {
      fail(err, 'Не удалось обработать фото — попробуйте другое');
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<Preview>(`/books/${id}/portrait/regenerate`, { descriptor });
      setPreview(res);
      setDescriptor(res.descriptor);
    } catch (err) {
      fail(err, 'Не удалось перегенерировать портрет');
    } finally {
      setBusy(false);
    }
  }

  async function generate(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/books/${id}/generate`, {});
      router.replace(`/books/${id}/progress`);
    } catch (err) {
      fail(err, 'Не удалось запустить генерацию');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[600px] px-7 py-10">
      <h1 className="sg-page-title my-4 mb-2">Герой по фото</h1>
      <p className="sg-field-hint mb-6">
        Загрузите чёткое фронтальное фото ребёнка. Мы нарисуем героя, похожего на него, и покажем
        превью до создания книги. Исходное фото удаляется сразу после портрета.
      </p>

      {!preview && (
        <div className="sg-card flex flex-col gap-4">
          <div>
            <label className="sg-label">Фото ребёнка</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sg-input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>Я родитель или опекун и разрешаю обработку этого фото для создания книги.</span>
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!file || !consent || busy}
              onClick={() => void buildPortrait()}
              className="sg-btn sg-btn-primary"
            >
              {busy ? 'Создаём портрет…' : 'Создать портрет ✦'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void generate()}
              className="sg-btn sg-btn-ghost"
            >
              Без фото
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="sg-card flex flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.portraitUrl}
            alt="Портрет героя"
            className="mx-auto w-full max-w-[320px] rounded-xl"
          />
          <div>
            <label className="sg-label">Описание внешности (можно поправить)</label>
            <textarea
              className="sg-input min-h-[80px]"
              value={descriptor}
              onChange={(e) => setDescriptor(e.target.value)}
            />
            <p className="sg-field-hint mt-1">
              Если что-то не так (цвет волос, деталь) — исправьте и перегенерируйте.
            </p>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void generate()}
              className="sg-btn sg-btn-primary"
            >
              {busy ? 'Запускаем…' : 'Похоже — создать книгу ✦'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void regenerate()}
              className="sg-btn sg-btn-ghost"
            >
              Перегенерировать
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setFile(null);
              }}
              className="sg-btn sg-btn-ghost"
            >
              Сменить фото
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
