'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearTokens, getAccessToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Persistent app-shell header: brand home link + primary nav + logout. */
export function AppHeader(): React.ReactElement {
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
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[940px] items-center justify-between px-7">
        <Link
          href="/books"
          className="flex items-center gap-1.5 font-display text-lg font-semibold text-text"
        >
          <span className="text-primary">✦</span> StoryGrow
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/books" className="sg-btn sg-btn-ghost">
            Мои книги
          </Link>
          <Link href="/books/new" className="sg-btn sg-btn-primary">
            + Новая книга
          </Link>
          <button onClick={() => void handleLogout()} className="sg-btn sg-btn-ghost">
            Выйти
          </button>
        </nav>
      </div>
    </header>
  );
}
