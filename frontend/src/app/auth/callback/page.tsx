'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setTokens } from '@/lib/auth';

export default function AuthCallbackPage(): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      setTokens(accessToken, refreshToken);
      router.replace('/books');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Выполняется вход…</p>
    </main>
  );
}
