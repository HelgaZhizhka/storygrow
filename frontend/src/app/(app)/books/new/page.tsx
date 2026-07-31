'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@/lib/api';
import {
  schema,
  toSeedList,
  NEW_CHILD_VALUE,
  CUSTOM_GOAL_VALUE,
  type FormValues,
  type Child,
  type LearningGoal,
} from './schema';
import { LearningGoalPicker } from './LearningGoalPicker';
import { ChildPicker } from './ChildPicker';

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

const SEED_FIELDS = [
  { name: 'interests', label: 'Интересы', placeholder: 'динозавры, космос, рисование' },
  { name: 'motifs', label: 'Мотивы', placeholder: 'дружба, поход в лес' },
  { name: 'favoriteWords', label: 'Любимые слова', placeholder: 'ура, чудеса' },
] as const;

export default function NewBookPage(): React.ReactElement {
  const router = useRouter();
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [existingChildren, setExistingChildren] = useState<Child[]>([]);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fastResult, setFastResult] = useState<{ bookId: string; pdfUrl: string } | null>(null);
  // #128: opt into the photo-character step (child hero looks like a real photo).
  const [usePhoto, setUsePhoto] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      selectedChildId: NEW_CHILD_VALUE,
      mode: 'custom',
      protagonistMode: 'child',
      artStyle: 'watercolor',
      childGender: '',
    },
  });

  const mode = watch('mode');
  const learningGoalId = watch('learningGoalId');
  const protagonistMode = watch('protagonistMode');
  const artStyle = watch('artStyle');
  const selectedChildId = watch('selectedChildId');
  const isNewChild = !selectedChildId;
  const selectedChild = existingChildren.find((c) => c.id === selectedChildId);
  const childAge = isNewChild ? watch('childAge') : selectedChild?.age;
  // Appearance belongs to the Child record, not to any one book's protagonist
  // mode — it's set once and reused across every future custom-flow book for
  // this child, so it must stay available regardless of whether *this* book
  // uses "Ребёнок-герой" or "Наблюдатель".
  const showAppearance = mode === 'custom' && isNewChild;

  useEffect(() => {
    void api
      .get<Child[]>('/children')
      .then(setExistingChildren)
      .finally(() => setChildrenLoaded(true));
  }, []);

  useEffect(() => {
    const query = childAge && Number.isFinite(Number(childAge)) ? `?age=${childAge}` : '';
    void api.get<LearningGoal[]>(`/learning-goals${query}`).then((fetched) => {
      setGoals(fetched);
      setValue('learningGoalId', '');
    });
  }, [childAge]);

  useEffect(() => {
    if (learningGoalId === CUSTOM_GOAL_VALUE && mode !== 'custom') {
      setValue('mode', 'custom');
    }
  }, [learningGoalId, mode, setValue]);

  async function onSubmit(values: FormValues): Promise<void> {
    setServerError(null);
    setFastResult(null);
    try {
      const childId = values.selectedChildId
        ? values.selectedChildId
        : (
            await api.post<Child>('/children', {
              name: values.childName,
              age: values.childAge,
              gender: values.childGender || undefined,
              appearance: values.childAppearance || undefined,
            })
          ).id;

      const resolvedChildAge = values.selectedChildId ? selectedChild?.age : values.childAge;

      const needsArcTypeChoice =
        values.learningGoalId === CUSTOM_GOAL_VALUE &&
        resolvedChildAge !== undefined &&
        resolvedChildAge >= 5;
      if (needsArcTypeChoice && !values.customGoalArcType) {
        setError('customGoalArcType', { message: 'Выберите, какая это история' });
        return;
      }

      const learningGoalId =
        values.learningGoalId === CUSTOM_GOAL_VALUE
          ? (
              await api.post<LearningGoal>('/learning-goals/custom', {
                text: values.customGoalText?.trim(),
                childAge: resolvedChildAge,
                arcType: values.customGoalArcType,
              })
            ).id
          : values.learningGoalId;

      if (values.mode === 'fast') {
        const result = await api.post<FastBookResult>('/books', {
          childId,
          learningGoalId,
          mode: 'fast',
        });
        const { url } = await api.get<{ url: string }>(`/books/${result.bookId}/pdf-url`);
        setFastResult({ bookId: result.bookId, pdfUrl: url });
      } else {
        const book = await api.post<CustomBookResult>('/books', {
          childId,
          learningGoalId,
          mode: 'custom',
          protagonistMode: values.protagonistMode,
          artStyle: values.artStyle,
          interests: toSeedList(values.interests),
          motifs: toSeedList(values.motifs),
          favoriteWords: toSeedList(values.favoriteWords),
        });
        // Photo character (#128): defer generation to the portrait step, where the
        // parent uploads a photo, approves the stylised portrait, then generates.
        if (usePhoto && values.protagonistMode === 'child') {
          router.replace(`/books/${book.id}/portrait`);
          return;
        }
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
        <ChildPicker
          childrenLoaded={childrenLoaded}
          existingChildren={existingChildren}
          selectedChild={selectedChild}
          isNewChild={isNewChild}
          showAppearance={showAppearance}
          register={register}
          errors={errors}
        />

        {/* ── Цель обучения ── */}
        <LearningGoalPicker
          goals={goals}
          childAge={childAge}
          register={register}
          watch={watch}
          setValue={setValue}
          clearErrors={clearErrors}
          errors={errors}
        />

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
            {learningGoalId !== CUSTOM_GOAL_VALUE && (
              <label className="sg-radio-card" data-checked={mode === 'fast'}>
                <input type="radio" value="fast" className="sr-only" {...register('mode')} />
                <span className="sg-radio-dot" />
                <span>
                  <b>Быстрый</b>
                  <span className="sg-radio-desc">Готовая история из шаблона — за секунды</span>
                </span>
              </label>
            )}
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
              {protagonistMode === 'child' && (
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={usePhoto}
                    onChange={(e) => setUsePhoto(e.target.checked)}
                  />
                  <span>
                    <b>Сделать героя похожим на моего ребёнка</b>
                    <span className="sg-radio-desc">
                      На следующем шаге загрузите фото — мы нарисуем героя по нему. Фото удаляется
                      после создания портрета.
                    </span>
                  </span>
                </label>
              )}
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
