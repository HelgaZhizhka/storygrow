'use client';

import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function StartCtaButton({ children, className }: Props): React.ReactElement {
  const router = useRouter();

  function start(): void {
    router.push(isAuthenticated() ? '/books/new' : '/login');
  }

  return (
    <button type="button" className={className} onClick={start}>
      {children}
    </button>
  );
}
