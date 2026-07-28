import type {
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  UseFormClearErrors,
  FieldErrors,
} from 'react-hook-form';
import { CUSTOM_GOAL_VALUE, type FormValues, type LearningGoal } from './schema';

interface LearningGoalPickerProps {
  goals: LearningGoal[];
  childAge: number | undefined;
  register: UseFormRegister<FormValues>;
  watch: UseFormWatch<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  clearErrors: UseFormClearErrors<FormValues>;
  errors: FieldErrors<FormValues>;
}

const ARC_TYPE_OPTIONS = [
  {
    value: 'virtue',
    title: 'Герой учится хорошему',
    description: 'История про то, как герой находит в себе силы поступить правильно',
  },
  {
    value: 'flaw',
    title: 'Герой ошибается и исправляет',
    description: 'История про ошибку и её последствия — и как герой всё исправляет',
  },
] as const;

export function LearningGoalPicker({
  goals,
  childAge,
  register,
  watch,
  setValue,
  clearErrors,
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
              <div className="flex flex-col gap-3">
                {ARC_TYPE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="sg-radio-card"
                    data-checked={customGoalArcType === option.value}
                  >
                    <input
                      type="radio"
                      value={option.value}
                      className="sr-only"
                      checked={customGoalArcType === option.value}
                      onChange={() => {
                        setValue('customGoalArcType', option.value);
                        clearErrors('customGoalArcType');
                      }}
                    />
                    <span className="sg-radio-dot" />
                    <span>
                      <b>{option.title}</b>
                      <span className="sg-radio-desc">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              {errors.customGoalArcType && (
                <span className="sg-field-hint text-danger">
                  {errors.customGoalArcType.message}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
