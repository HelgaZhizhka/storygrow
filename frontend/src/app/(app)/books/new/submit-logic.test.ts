import { describe, it, expect } from 'vitest';

function resolveSubmitPath(
  mode: 'fast' | 'custom',
  fastResult: { bookId: string; pdfUrl: string } | null,
): 'fast-inline' | 'custom-redirect' | 'idle' {
  if (fastResult !== null) return 'fast-inline';
  if (mode === 'fast') return 'fast-inline';
  return 'custom-redirect';
}

describe('resolveSubmitPath', () => {
  it('returns fast-inline for fast mode', () => {
    expect(resolveSubmitPath('fast', null)).toBe('fast-inline');
  });

  it('returns custom-redirect for custom mode', () => {
    expect(resolveSubmitPath('custom', null)).toBe('custom-redirect');
  });

  it('returns fast-inline when fastResult is set regardless of mode', () => {
    expect(resolveSubmitPath('custom', { bookId: 'b1', pdfUrl: 'https://s3/x.pdf' })).toBe(
      'fast-inline',
    );
  });
});

function submitButtonLabel(isSubmitting: boolean, mode: 'fast' | 'custom'): string {
  if (!isSubmitting) return 'Создать книгу';
  return mode === 'fast' ? 'Генерируем PDF…' : 'Создаём…';
}

describe('submitButtonLabel', () => {
  it('returns default label when not submitting', () => {
    expect(submitButtonLabel(false, 'fast')).toBe('Создать книгу');
    expect(submitButtonLabel(false, 'custom')).toBe('Создать книгу');
  });

  it('returns fast label when submitting in fast mode', () => {
    expect(submitButtonLabel(true, 'fast')).toBe('Генерируем PDF…');
  });

  it('returns custom label when submitting in custom mode', () => {
    expect(submitButtonLabel(true, 'custom')).toBe('Создаём…');
  });
});
