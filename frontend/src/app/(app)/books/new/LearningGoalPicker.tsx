import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form';
import { CUSTOM_GOAL_VALUE, type FormValues, type LearningGoal } from './schema';

interface LearningGoalPickerProps {
  goals: LearningGoal[];
  childAge: number | undefined;
  register: UseFormRegister<FormValues>;
  watch: UseFormWatch<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  errors: FieldErrors<FormValues>;
}

export function LearningGoalPicker({
  goals,
  childAge,
  register,
  watch,
  setValue,
  errors,
}: LearningGoalPickerProps): React.ReactElement {
  const learningGoalId = watch('learningGoalId');
  const customGoalArcType = watch('customGoalArcType');
  const isCustom = learningGoalId === CUSTOM_GOAL_VALUE;
  const canPickArcType = isCustom && childAge !== undefined && childAge >= 5;

  return (
    <div className="sg-card">
      <span className="sg-section-label">Цель обучения</span>
      <label className="sg-label" htmlFor="learningGoalId">
        Чему научит история
      </label>
      <select id="learningGoalId" className="sg-select" {...register('learningGoalId')}>
        <option value="">— выберите цель —</option>
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.title}
          </option>
        ))}
        <option value={CUSTOM_GOAL_VALUE}>+ Своя цель</option>
      </select>
      {errors.learningGoalId && (
        <span className="sg-field-hint text-danger">{errors.learningGoalId.message}</span>
      )}

      {isCustom && (
        <div className="mt-4">
          <label className="sg-label" htmlFor="customGoalText">
            Опишите цель
          </label>
          <input
            id="customGoalText"
            className="sg-input"
            placeholder="Например: бережное отношение к книгам"
            maxLength={60}
            {...register('customGoalText')}
          />
          {errors.customGoalText && (
            <span className="sg-field-hint text-danger">{errors.customGoalText.message}</span>
          )}

          {canPickArcType && (
            <div className="mt-3">
              <label className="sg-label">Какая это история</label>
              <div className="sg-seg">
                <button
                  type="button"
                  className="sg-seg-opt"
                  data-active={customGoalArcType === 'virtue'}
                  onClick={() => setValue('customGoalArcType', 'virtue')}
                >
                  Герой учится хорошему
                </button>
                <button
                  type="button"
                  className="sg-seg-opt"
                  data-active={customGoalArcType === 'flaw'}
                  onClick={() => setValue('customGoalArcType', 'flaw')}
                >
                  Герой ошибается и исправляет
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
