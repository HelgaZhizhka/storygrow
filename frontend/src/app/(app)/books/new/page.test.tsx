import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { CUSTOM_GOAL_VALUE } from './schema';
import NewBookPage from './page';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt} />,
}));

describe('NewBookPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends childAge as a number to /learning-goals/custom for a newly-created child', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockImplementation((path: string) => {
      if (path === '/children') return Promise.resolve({ id: 'child-1' });
      if (path === '/learning-goals/custom') return Promise.resolve({ id: 'goal-1' });
      if (path === '/books') return Promise.resolve({ id: 'book-1' });
      return Promise.resolve({});
    });

    render(<NewBookPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/чему научит история/i)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    // Fill name/age before picking the goal: typing the age re-triggers the
    // goals-fetch effect, which resets learningGoalId — so the goal pick must
    // come last, once no further childAge change will clobber it.
    await user.type(screen.getByPlaceholderText('Маша'), 'Соня');
    await user.type(screen.getByPlaceholderText('5'), '5');
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/learning-goals?age=5');
    });

    await user.selectOptions(screen.getByLabelText(/чему научит история/i), CUSTOM_GOAL_VALUE);
    await user.type(await screen.findByLabelText(/опишите цель/i), 'Делиться игрушками');
    // Age 5 is in the 5-6 band, so the arc-type choice is required — no
    // default is pre-selected (#323 follow-up), the parent must pick one.
    await user.click(await screen.findByText(/герой учится хорошему/i));

    await user.click(screen.getByRole('button', { name: /создать книгу/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/learning-goals/custom',
        expect.objectContaining({ childAge: 5 }),
      );
    });

    const customGoalCall = vi
      .mocked(api.post)
      .mock.calls.find(([path]) => path === '/learning-goals/custom');
    expect(typeof (customGoalCall?.[1] as { childAge: unknown }).childAge).toBe('number');
  });

  it('blocks submission with an inline error when the arc-type choice is skipped for a 5-6 child', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({});

    render(<NewBookPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/чему научит история/i)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Маша'), 'Соня');
    await user.type(screen.getByPlaceholderText('5'), '5');
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/learning-goals?age=5');
    });
    await user.selectOptions(screen.getByLabelText(/чему научит история/i), CUSTOM_GOAL_VALUE);
    await user.type(await screen.findByLabelText(/опишите цель/i), 'Делиться игрушками');

    // Deliberately skip clicking an arc-type option, then submit.
    await user.click(screen.getByRole('button', { name: /создать книгу/i }));

    await waitFor(() => {
      expect(screen.getByText(/выберите, какая это история/i)).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalledWith('/learning-goals/custom', expect.anything());
  });
});
