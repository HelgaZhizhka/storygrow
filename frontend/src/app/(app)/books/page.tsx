'use client';

import { useRouter } from 'next/navigation';
import { clearTokens, getAccessToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function BooksPage(): React.ReactElement {
  const router = useRouter();

  async function handleLogout(): Promise<void> {
    const token = getAccessToken();
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    clearTokens();
    router.replace('/login');
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Мои книги
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Здесь будут ваши персонализированные книги.
      </p>
      <button
        onClick={() => void handleLogout()}
        className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Выйти
      </button>
    </main>
  );
}
