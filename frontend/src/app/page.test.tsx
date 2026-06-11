import { render, screen } from '@testing-library/react';
import HomePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('HomePage (landing)', () => {
  it('renders the hero heading', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('главный герой');
  });

  it('shows the primary CTA', () => {
    render(<HomePage />);
    expect(screen.getByRole('button', { name: 'Создать книгу' })).toBeInTheDocument();
  });

  it('links to pricing', () => {
    render(<HomePage />);
    expect(screen.getByRole('link', { name: 'Смотреть тарифы' })).toBeInTheDocument();
  });
});
