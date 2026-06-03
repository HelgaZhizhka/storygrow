'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';

interface Child {
  id: string;
  name: string;
  age: number;
}

interface LearningGoal {
  id: string;
  title: string;
  description: string;
}

interface CreatedBook {
  id: string;
  mode: string;
}

const schema = z
  .object({
    childOption: z.enum(['existing', 'new']),
    childId: z.string().optional(),
    childName: z.string().optional(),
    childAge: z.coerce.number().int().min(1).max(18).optional(),
    childGender: z.enum(['male', 'female', 'other', '']).optional(),
    learningGoalId: z.string().min(1, 'Выберите цель обучения'),
    mode: z.enum(['fast', 'custom']),
  })
  .superRefine((val, ctx) => {
    if (val.childOption === 'existing' && !val.childId) {
      ctx.addIssue({ code: 'custom', path: ['childId'], message: 'Выберите ребёнка' });
    }
    if (val.childOption === 'new') {
      if (!val.childName || val.childName.trim().length === 0) {
        ctx.addIssue({ code: 'custom', path: ['childName'], message: 'Введите имя' });
      }
      if (!val.childAge) {
        ctx.addIssue({ code: 'custom', path: ['childAge'], message: 'Введите возраст' });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

export default function NewBookPage(): React.ReactElement {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { childOption: 'existing', mode: 'fast' },
  });

  const childOption = watch('childOption');

  useEffect(() => {
    void Promise.all([
      api.get<Child[]>('/children').then(setChildren),
      api.get<LearningGoal[]>('/learning-goals').then(setGoals),
    ]);
  }, []);

  async function onSubmit(values: FormValues): Promise<void> {
    setServerError(null);
    try {
      let childId = values.childId;

      if (values.childOption === 'new') {
        const created = await api.post<Child>('/children', {
          name: values.childName,
          age: values.childAge,
          gender: values.childGender || undefined,
        });
        childId = created.id;
      }

      const book = await api.post<CreatedBook>('/books', {
        childId,
        learningGoalId: values.learningGoalId,
        mode: values.mode,
      });

      router.replace(`/books/${book.id}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Что-то пошло не так');
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Новая книга
      </h1>

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-6">
        {/* Child section */}
        <fieldset className="flex flex-col gap-4">
          <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Ребёнок</legend>

          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="radio" value="existing" {...register('childOption')} />
              Существующий
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="radio" value="new" {...register('childOption')} />
              Новый
            </label>
          </div>

          {childOption === 'existing' && (
            <div className="flex flex-col gap-1">
              <select
                {...register('childId')}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">— выберите ребёнка —</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.age} лет)
                  </option>
                ))}
              </select>
              {errors.childId && <p className="text-xs text-red-500">{errors.childId.message}</p>}
            </div>
          )}

          {childOption === 'new' && (
            <div className="flex flex-col gap-3">
              <Field label="Имя" error={errors.childName?.message}>
                <input
                  type="text"
                  placeholder="Маша"
                  {...register('childName')}
                  className={inputCls}
                />
              </Field>
              <Field label="Возраст" error={errors.childAge?.message}>
                <input
                  type="number"
                  min={1}
                  max={18}
                  placeholder="5"
                  {...register('childAge')}
                  className={inputCls}
                />
              </Field>
              <Field label="Пол (необязательно)" error={errors.childGender?.message}>
                <select {...register('childGender')} className={inputCls}>
                  <option value="">— не указано —</option>
                  <option value="male">Мальчик</option>
                  <option value="female">Девочка</option>
                  <option value="other">Другой</option>
                </select>
              </Field>
            </div>
          )}
        </fieldset>

        {/* Learning goal */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Цель обучения
          </label>
          <select
            {...register('learningGoalId')}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">— выберите цель —</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          {errors.learningGoalId && (
            <p className="text-xs text-red-500">{errors.learningGoalId.message}</p>
          )}
        </div>

        {/* Mode */}
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Режим</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-4 has-[:checked]:border-zinc-900 dark:border-zinc-700 dark:has-[:checked]:border-zinc-300">
            <input type="radio" value="fast" {...register('mode')} className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Быстрый</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Готовая история из шаблона — результат за секунды
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-4 has-[:checked]:border-zinc-900 dark:border-zinc-700 dark:has-[:checked]:border-zinc-300">
            <input type="radio" value="custom" {...register('mode')} className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Персонализированный
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                ИИ генерирует уникальную книгу — занимает 1–2 минуты
              </span>
            </span>
          </label>
        </fieldset>

        {serverError && <p className="text-sm text-red-500">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isSubmitting ? 'Создаём…' : 'Создать книгу'}
        </button>
      </form>
    </main>
  );
}

const inputCls =
  'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 w-full';

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
