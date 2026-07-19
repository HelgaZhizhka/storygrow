'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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

interface FastBookResult {
  bookId: string;
  pdfKey: string;
}

interface CustomBookResult {
  id: string;
}

const ART_STYLES = [
  { id: 'watercolor', label: 'Акварель' },
  { id: 'cartoon', label: 'Мультяшный' },
  { id: 'storybook', label: 'Книжная' },
  { id: 'pixel', label: 'Пиксель' },
  { id: 'realistic', label: 'Реалистичный' },
] as const;

const schema = z.object({
  childName: z.string().min(1, 'Введите имя'),
  childAge: z.coerce
    .number({ message: 'Введите возраст' })
    .int()
    .min(3, { message: 'Доступно 3–6 лет' })
    .max(6, { message: 'Доступно 3–6 лет' }),
  childGender: z.enum(['male', 'female', 'other', '']).optional(),
  childAppearance: z
    .string()
    .max(1500, 'Слишком длинное описание — максимум 1500 символов')
    .optional(),
  learningGoalId: z.string().min(1, 'Выберите цель обучения'),
  mode: z.enum(['fast', 'custom']),
  protagonistMode: z.enum(['child', 'observer']),
  artStyle: z.enum(['watercolor', 'cartoon', 'storybook', 'pixel', 'realistic']),
  interests: z.string().optional(),
  motifs: z.string().optional(),
  favoriteWords: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// Personalization seeds (#197): comma-separated free text → capped string list.
// Matches the backend cap (≤6 items, ≤60 chars each); empty entries dropped.
const toSeedList = (raw?: string): string[] =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((s) => s.slice(0, 60));

const SEED_FIELDS = [
  { name: 'interests', label: 'Интересы', placeholder: 'динозавры, космос, рисование' },
  { name: 'motifs', label: 'Мотивы', placeholder: 'дружба, поход в лес' },
  { name: 'favoriteWords', label: 'Любимые слова', placeholder: 'ура, чудеса' },
] as const;

export default function NewBookPage(): React.ReactElement {
  const router = useRouter();
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fastResult, setFastResult] = useState<{ bookId: string; pdfUrl: string } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: 'custom',
      protagonistMode: 'child',
      artStyle: 'watercolor',
      childGender: '',
    },
  });

  const mode = watch('mode');
  const protagonistMode = watch('protagonistMode');
  const artStyle = watch('artStyle');
  const showAppearance = mode === 'custom' && protagonistMode === 'child';

  useEffect(() => {
    void api.get<LearningGoal[]>('/learning-goals').then(setGoals);
  }, []);

  async function onSubmit(values: FormValues): Promise<void> {
    setServerError(null);
    setFastResult(null);
    try {
      const child = await api.post<Child>('/children', {
        name: values.childName,
        age: values.childAge,
        gender: values.childGender || undefined,
        appearance: values.childAppearance || undefined,
      });

      if (values.mode === 'fast') {
        const result = await api.post<FastBookResult>('/books', {
          childId: child.id,
          learningGoalId: values.learningGoalId,
          mode: 'fast',
        });
        const { url } = await api.get<{ url: string }>(`/books/${result.bookId}/pdf-url`);
        setFastResult({ bookId: result.bookId, pdfUrl: url });
      } else {
        const book = await api.post<CustomBookResult>('/books', {
          childId: child.id,
          learningGoalId: values.learningGoalId,
          mode: 'custom',
          protagonistMode: values.protagonistMode,
          artStyle: values.artStyle,
          interests: toSeedList(values.interests),
          motifs: toSeedList(values.motifs),
          favoriteWords: toSeedList(values.favoriteWords),
        });
        await api.post(`/books/${book.id}/generate`, {});
        router.replace(`/books/${book.id}/progress`);
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Что-то пошло не так');
    }
  }

  return (
    <main className="mx-auto w-full max-w-[600px] px-7 py-10">
      <Link href="/books" className="sg-back-link">
        ← К списку книг
      </Link>
      <h1 className="sg-page-title my-4 mb-7">Новая книга</h1>

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-[18px]">
        {/* ── Ребёнок ── */}
        <div className="sg-card">
          <span className="sg-section-label">Ребёнок</span>
          <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-[1.4fr_0.8fr_1fr]">
            <div>
              <label className="sg-label">Имя</label>
              <input className="sg-input" placeholder="Маша" {...register('childName')} />
              {errors.childName && (
                <span className="sg-field-hint text-danger">{errors.childName.message}</span>
              )}
            </div>
            <div>
              <label className="sg-label">Возраст</label>
              <input
                className="sg-input"
                type="number"
                min={3}
                max={6}
                placeholder="5"
                {...register('childAge')}
              />
              <span className="sg-field-hint">Доступно 3–6 лет</span>
              {errors.childAge && (
                <span className="sg-field-hint text-danger">{errors.childAge.message}</span>
              )}
            </div>
            <div>
              <label className="sg-label">
                Пол <span className="sg-opt">необязательно</span>
              </label>
              <select className="sg-select" {...register('childGender')}>
                <option value="">Не указано</option>
                <option value="female">Девочка</option>
                <option value="male">Мальчик</option>
                <option value="other">Другой</option>
              </select>
            </div>
          </div>

          {showAppearance && (
            <div className="mt-4">
              <label className="sg-label">
                Как выглядит <span className="sg-opt">необязательно</span>
              </label>
              <textarea
                className="sg-textarea"
                placeholder="Например: кудрявые каштановые волосы, голубые глаза, красное платье"
                {...register('childAppearance')}
              />
              {errors.childAppearance ? (
                <span className="sg-field-hint text-danger">{errors.childAppearance.message}</span>
              ) : (
                <span className="sg-field-hint">
                  Используется, чтобы нарисовать ребёнка героем книги.
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Цель обучения ── */}
        <div className="sg-card">
          <span className="sg-section-label">Цель обучения</span>
          <label className="sg-label">Чему научит история</label>
          <select className="sg-select" {...register('learningGoalId')}>
            <option value="">— выберите цель —</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          {errors.learningGoalId && (
            <span className="sg-field-hint text-danger">{errors.learningGoalId.message}</span>
          )}
        </div>

        {/* ── Режим создания ── */}
        <div className="sg-card">
          <span className="sg-section-label">Режим создания</span>
          <div className="flex flex-col gap-3">
            <label className="sg-radio-card" data-checked={mode === 'custom'}>
              <input type="radio" value="custom" className="sr-only" {...register('mode')} />
              <span className="sg-radio-dot" />
              <span>
                <b>Персонализированный</b>
                <span className="sg-radio-desc">ИИ создаёт уникальную книгу — 1–2 минуты</span>
              </span>
              <span className="sg-badge sg-badge-primary ml-auto">Рекомендуем</span>
            </label>
            <label className="sg-radio-card" data-checked={mode === 'fast'}>
              <input type="radio" value="fast" className="sr-only" {...register('mode')} />
              <span className="sg-radio-dot" />
              <span>
                <b>Быстрый</b>
                <span className="sg-radio-desc">Готовая история из шаблона — за секунды</span>
              </span>
            </label>
          </div>
        </div>

        {/* ── Детали истории (custom only) ── */}
        {mode === 'custom' && (
          <div className="sg-card">
            <span className="sg-section-label">Детали истории</span>
            <div className="mb-[18px]">
              <label className="sg-label">Кто главный герой</label>
              <div className="sg-seg">
                <button
                  type="button"
                  className="sg-seg-opt"
                  data-active={protagonistMode === 'child'}
                  onClick={() => setValue('protagonistMode', 'child')}
                >
                  Ребёнок — герой
                </button>
                <button
                  type="button"
                  className="sg-seg-opt"
                  data-active={protagonistMode === 'observer'}
                  onClick={() => setValue('protagonistMode', 'observer')}
                >
                  Наблюдатель
                </button>
              </div>
            </div>
            <div>
              <label className="sg-label">Стиль иллюстраций</label>
              <div className="sg-style-grid">
                {ART_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="sg-style-opt"
                    data-active={artStyle === s.id}
                    onClick={() => setValue('artStyle', s.id)}
                  >
                    <div className="sg-style-sw relative">
                      <Image
                        src={`/styles/${s.id}.png`}
                        alt={s.label}
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                    </div>
                    <span className="sg-style-nm">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Персонализация (custom only) ── */}
        {mode === 'custom' && (
          <div className="sg-card">
            <span className="sg-section-label">
              Персонализация <span className="sg-opt">необязательно</span>
            </span>
            <p className="sg-field-hint mb-3">
              Конкретные детали делают историю живой. Мы вплетём их в мир героя, не меняя сюжет.
              Несколько значений — через запятую.
            </p>
            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
              {SEED_FIELDS.map((f) => (
                <div key={f.name}>
                  <label className="sg-label">{f.label}</label>
                  <input className="sg-input" placeholder={f.placeholder} {...register(f.name)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {serverError && <p className="text-sm text-danger">{serverError}</p>}

        {fastResult && (
          <div className="sg-card border-success-soft">
            <p className="mb-3 font-semibold text-success">Книга готова!</p>
            <div className="flex gap-3">
              <a
                href={fastResult.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="sg-btn sg-btn-primary"
              >
                Скачать PDF
              </a>
              <Link href={`/books/${fastResult.bookId}`} className="sg-btn sg-btn-ghost">
                Открыть книгу
              </Link>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="sg-btn sg-btn-primary sg-btn-lg self-start"
        >
          {isSubmitting ? (mode === 'fast' ? 'Генерируем PDF…' : 'Создаём…') : 'Создать книгу ✦'}
        </button>
      </form>
    </main>
  );
}
