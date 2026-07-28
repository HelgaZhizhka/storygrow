import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import { NEW_CHILD_VALUE, type Child, type FormValues } from './schema';

interface ChildPickerProps {
  childrenLoaded: boolean;
  existingChildren: Child[];
  selectedChild: Child | undefined;
  isNewChild: boolean;
  showAppearance: boolean;
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
}

export function ChildPicker({
  childrenLoaded,
  existingChildren,
  selectedChild,
  isNewChild,
  showAppearance,
  register,
  errors,
}: ChildPickerProps): React.ReactElement {
  return (
    <div className="sg-card">
      <span className="sg-section-label">Ребёнок</span>

      {!childrenLoaded && <p className="sg-field-hint">Загрузка…</p>}

      {childrenLoaded && existingChildren.length > 0 && (
        <div className="mb-[14px]">
          <label className="sg-label">Кто получит книгу</label>
          <select className="sg-select" {...register('selectedChildId')}>
            <option value={NEW_CHILD_VALUE}>+ Новый ребёнок</option>
            {existingChildren.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.age} лет)
              </option>
            ))}
          </select>
          {selectedChild?.appearance && (
            <p className="sg-field-hint mt-1">Внешность: {selectedChild.appearance}</p>
          )}
        </div>
      )}

      {childrenLoaded && isNewChild && (
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
      )}

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
  );
}
