import { render, screen, waitFor } from '@testing-library/react';
import { ApiError, api } from '@/lib/api';
import AdminBooksPage from './page';

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

describe('AdminBooksPage', () => {
  it('shows an access-denied message on a 403, instead of a misleading empty table', async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(403, 'Forbidden'));

    render(<AdminBooksPage />);

    await waitFor(() => {
      expect(screen.getByText(/доступ запрещён/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/no books found/i)).not.toBeInTheDocument();
  });

  it('renders the books table on success', async () => {
    vi.mocked(api.get).mockResolvedValue([
      {
        id: 'book-1',
        title: 'Тестовая книга',
        status: 'ready',
        createdAt: '2026-01-01T00:00:00.000Z',
        child: { name: 'Аня', age: 5 },
        learningGoal: { title: 'Доброта' },
        evals: [{ finalScore: 9.5, passed: true, attempt: 1 }],
      },
    ]);

    render(<AdminBooksPage />);

    await waitFor(() => {
      expect(screen.getByText('Тестовая книга')).toBeInTheDocument();
    });
  });
});
