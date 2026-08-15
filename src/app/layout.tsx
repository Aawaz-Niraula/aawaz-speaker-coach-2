import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

/*
 * All three fonts ship with the app rather than being fetched from Google at
 * build time.
 *
 * next/font/google downloads the files during the build and self-hosts them,
 * so the runtime was never dependent on Google — but the BUILD was. When
 * Google republished Cormorant Garamond the cached woff2 filenames started
 * returning 404 and production failed on unchanged code. Vercel restoring its
 * build cache is what made it stick.
 *
 * Committing the files removes that failure mode entirely: no third party can
 * break a deploy by rotating a filename. Only the latin weights the app
 * actually uses are included.
 */
const serif = localFont({
  src: [
    { path: './fonts/cormorant-garamond-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/cormorant-garamond-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/cormorant-garamond-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-serif-next',
  display: 'swap',
  // Matches the metrics Google's own fallback uses, so swapping in the real
  // font does not shift the layout.
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

const sans = localFont({
  src: [
    { path: './fonts/manrope-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/manrope-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/manrope-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/manrope-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans-next',
  display: 'swap',
  fallback: ['system-ui', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

const mono = localFont({
  src: [
    { path: './fonts/dm-mono-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/dm-mono-500.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-mono-next',
  display: 'swap',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});

export const metadata: Metadata = {
  title: 'Aawaz Speaker Coach',
  description: 'History-aware speech coaching with honest, technical feedback.',
};

export const viewport: Viewport = {
  themeColor: '#06060b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <div className="bg-mesh" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
