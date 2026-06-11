'use client';

function toggleTheme(): void {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sg-theme', next);
}

export function ThemeToggle(): React.ReactElement {
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={toggleTheme}
      title="Сменить тему"
      aria-label="Сменить тему"
    />
  );
}
