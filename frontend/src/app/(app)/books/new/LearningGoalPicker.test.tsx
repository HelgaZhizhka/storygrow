import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LearningGoalPicker } from './LearningGoalPicker';
import { schema, CUSTOM_GOAL_VALUE, type FormValues, type LearningGoal } from './schema';

const goals: LearningGoal[] = [{ id: 'g1', title: 'Доброта', description: 'x' }];

function Harness({ childAge }: { childAge?: number }): React.ReactElement {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: 'custom',
      protagonistMode: 'child',
      artStyle: 'watercolor',
      customGoalArcType: 'virtue',
      learningGoalId: '',
    },
  });
  return (
    <LearningGoalPicker
      goals={goals}
      childAge={childAge}
      register={register}
      watch={watch}
      setValue={setValue}
      errors={errors}
    />
  );
}

describe('LearningGoalPicker', () => {
  it('reveals a text field when "+ Своя цель" is selected', async () => {
    render(<Harness childAge={5} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), CUSTOM_GOAL_VALUE);
    expect(screen.getByLabelText(/опишите цель/i)).toBeInTheDocument();
  });

  it('shows the arc-type choice for a 5-6 child', async () => {
    render(<Harness childAge={5} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), CUSTOM_GOAL_VALUE);
    expect(screen.getByText(/герой учится хорошему/i)).toBeInTheDocument();
  });

  it('hides the arc-type choice for a 3-4 child', async () => {
    render(<Harness childAge={3} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), CUSTOM_GOAL_VALUE);
    expect(screen.queryByText(/герой учится хорошему/i)).not.toBeInTheDocument();
  });

  it('does not show the custom-goal field for a built-in goal', () => {
    render(<Harness childAge={5} />);
    expect(screen.queryByLabelText(/опишите цель/i)).not.toBeInTheDocument();
  });
});
