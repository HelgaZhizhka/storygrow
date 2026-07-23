import { render, screen, waitFor } from '@testing-library/react';
import { ApiError, api } from '@/lib/api';
import AdminMetricsPage from './page';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

describe('AdminMetricsPage', () => {
  it('shows an access-denied message on a 403, instead of hanging on Loading forever', async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(403, 'Forbidden'));

    render(<AdminMetricsPage />);

    await waitFor(() => {
      expect(screen.getByText(/доступ запрещён/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('shows a generic error message on a non-403 failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(500, 'Internal error'));

    render(<AdminMetricsPage />);

    await waitFor(() => {
      expect(screen.getByText(/не удалось загрузить/i)).toBeInTheDocument();
    });
  });

  it('renders metrics on success', async () => {
    vi.mocked(api.get).mockResolvedValue({
      windowDays: 7,
      totalBooks: 10,
      readyBooks: 8,
      passedFirstAttempt: 6,
      passRate: 0.8,
      meanFinalScore: 8.5,
      meanCriterionScores: { registerMatch: 8.5, earnedResolution: 9 },
      recentEvalCount: 12,
    });

    render(<AdminMetricsPage />);

    await waitFor(() => {
      expect(screen.getByText('Metrics')).toBeInTheDocument();
    });
    expect(screen.getByText('Register match')).toBeInTheDocument();
    expect(screen.getByText('Earned resolution')).toBeInTheDocument();
  });
});
