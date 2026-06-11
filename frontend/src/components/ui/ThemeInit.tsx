'use client';

import { useEffect } from 'react';

/** Applies the stored theme to <html> on load, for every route. */
export function ThemeInit(): null {
  useEffect(() => {
    const stored = localStorage.getItem('sg-theme');
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  }, []);

  return null;
}
