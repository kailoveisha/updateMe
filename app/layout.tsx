import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#f1f3ef',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
