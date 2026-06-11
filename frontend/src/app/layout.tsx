import type { Metadata } from 'next';
import { Unbounded, Manrope } from 'next/font/google';

import './globals.css';
import './marketing.css';
import { ThemeInit } from '@/components/ui/ThemeInit';

// The design's fonts (Bricolage display, Outfit body) have NO Cyrillic, but the
// UI is Russian. Cyrillic-capable substitutes that keep the intent — a
// distinctive display + a clean geometric body: Unbounded + Manrope.
const fontDisplay = Unbounded({
  variable: '--font-head',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

const fontBody = Manrope({
  variable: '--font-body',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'StoryGrow',
  description:
    'Персонализированные детские книги с возрастной адаптацией лексики и педагогическим контролем качества.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html
      lang="ru"
      data-theme="light"
      className={`${fontDisplay.variable} ${fontBody.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}
