import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage', () => {
  it('renders brand name', () => {
    render(<HomePage />);
    expect(screen.getByText('StoryGrow')).toBeInTheDocument();
  });

  it('renders main heading', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Персонализированные детские книги с возрастной адаптацией',
    );
  });
});
