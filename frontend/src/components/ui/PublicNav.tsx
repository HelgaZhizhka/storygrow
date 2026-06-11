'use client';

import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

interface NavLink {
  href: string;
  label: string;
}

interface Props {
  links?: NavLink[];
}

const DEFAULT_LINKS: NavLink[] = [
  { href: '/#how', label: 'Как это работает' },
  { href: '/#features', label: 'Возможности' },
  { href: '/pricing', label: 'Тарифы' },
];

export function PublicNav({ links = DEFAULT_LINKS }: Props): React.ReactElement {
  return (
    <header className="lp-nav">
      <Link href="/" className="sg-wordmark">
        <span className="sg-spark" />
        StoryGrow
      </Link>
      <nav className="lp-nav__links">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="lp-nav__right">
        <ThemeToggle />
        <Link href="/login" className="sg-btn sg-btn-ghost">
          Войти
        </Link>
      </div>
    </header>
  );
}
