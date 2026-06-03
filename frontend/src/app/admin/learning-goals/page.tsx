'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface LearningGoal {
  id: string;
  title: string;
  description: string;
  ageRangeMin: number;
  ageRangeMax: number;
}

interface FormState {
  title: string;
  description: string;
  ageRangeMin: string;
  ageRangeMax: string;
}

const empty: FormState = { title: '', description: '', ageRangeMin: '1', ageRangeMax: '18' };

export default function AdminLearningGoalsPage(): React.ReactElement {
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);

  function load(): Promise<void> {
    return api
      .get<LearningGoal[]>('/admin/learning-goals')
      .then(setGoals)
      .catch(() => {});
  }

  useEffect(() => {
    void api.get<LearningGoal[]>('/admin/learning-goals').then(setGoals);
  }, []);

  function startCreate(): void {
    setEditing('new');
    setForm(empty);
    setError(null);
  }

  function startEdit(g: LearningGoal): void {
    setEditing(g.id);
    setForm({
      title: g.title,
      description: g.description,
      ageRangeMin: String(g.ageRangeMin),
      ageRangeMax: String(g.ageRangeMax),
    });
    setError(null);
  }

  async function handleSave(): Promise<void> {
    setError(null);
    const body = {
      title: form.title,
      description: form.description,
      ageRangeMin: Number(form.ageRangeMin),
      ageRangeMax: Number(form.ageRangeMax),
    };
    try {
      if (editing === 'new') {
        await api.post('/admin/learning-goals', body);
      } else if (editing) {
        await api.put(`/admin/learning-goals/${editing}`, body);
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm('Удалить эту цель обучения?')) return;
    try {
      await api.delete(`/admin/learning-goals/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Цели обучения
        </h1>
        <button
          onClick={startCreate}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
        >
          + Добавить
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {editing && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {editing === 'new' ? 'Новая цель' : 'Редактировать'}
          </h2>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Название"
            className={inputCls}
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Описание"
            rows={3}
            className={inputCls}
          />
          <div className="flex gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Возраст от</label>
              <input
                type="number"
                min={1}
                max={18}
                value={form.ageRangeMin}
                onChange={(e) => setForm((f) => ({ ...f, ageRangeMin: e.target.value }))}
                className={`${inputCls} w-24`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Возраст до</label>
              <input
                type="number"
                min={1}
                max={18}
                value={form.ageRangeMax}
                onChange={(e) => setForm((f) => ({ ...f, ageRangeMax: e.target.value }))}
                className={`${inputCls} w-24`}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void handleSave()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Сохранить
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-700">
            <th className="pb-2 pr-4">Название</th>
            <th className="pb-2 pr-4">Возраст</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {goals.map((g) => (
            <tr key={g.id} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="py-2 pr-4">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{g.title}</p>
                <p className="text-xs text-zinc-500">{g.description}</p>
              </td>
              <td className="py-2 pr-4 text-zinc-500">
                {g.ageRangeMin}–{g.ageRangeMax} лет
              </td>
              <td className="py-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(g)}
                    className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => void handleDelete(g.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const inputCls =
  'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 w-full';
