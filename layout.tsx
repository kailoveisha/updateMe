import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { BROWSER_BAR, LOOK_COOKIE, lookFromCookie } from '@/lib/chat/theme';

// Fonts are bundled from npm (no runtime requests to Google).
import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/bodoni-moda/opsz-italic.css';
import '@fontsource-variable/hanken-grotesk/wght.css';
import '@fontsource/reenie-beanie/latin-400.css';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Updateme', template: '%s — Updateme' },
  description: 'A small private page for two.',
  applicationName: 'Updateme',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Updateme', statusBarStyle: 'default' },
};

export async function generateViewport(): Promise<Viewport> {
  const saved = (await cookies()).get(LOOK_COOKIE)?.value;
  const palette = saved ? lookFromCookie(saved).palette : 'blueprint';
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    interactiveWidget: 'resizes-content',
    themeColor: BROWSER_BAR[palette],
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The chosen paper + colours are remembered in a cookie so the page is drawn correctly from the first paint.
  // Until someone picks a look, no attributes are set and the built-in defaults (lines, Blueprint) apply.
  const saved = (await cookies()).get(LOOK_COOKIE)?.value;
  const look = saved ? lookFromCookie(saved) : null;

  return (
    <html lang="en" data-paper={look?.paper} data-palette={look?.palette}>
      <body>{children}</body>
    </html>
  );
}
