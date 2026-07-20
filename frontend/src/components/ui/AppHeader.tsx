'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/auth';

/** Persistent app-shell header: brand home link + primary nav + logout. */
export function AppHeader(): React.ReactElement {
  const router = useRouter();

  async function handleLogout(): Promise<void> {
    await logout();
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
          <Link href="/pricing" className="sg-btn sg-btn-ghost">
            Тарифы
          </Link>
          <Link href="/books/new" className="sg-btn sg-btn-primary">
            + Новая книга
          </Link>
          <Link href="/account" className="sg-btn sg-btn-ghost">
            Аккаунт
          </Link>
          <button onClick={() => void handleLogout()} className="sg-btn sg-btn-ghost">
            Выйти
          </button>
        </nav>
      </div>
    </header>
  );
}
