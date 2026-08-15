import type { Metadata, Viewport } from 'next';
import { DM_Mono, Manrope } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

/*
 * Cormorant Garamond is self-hosted rather than fetched from Google at build
 * time. Google republished the family and the woff2 URLs Next.js had cached
 * started returning 404, which failed the production build on unchanged code.
 * Shipping the files removes that dependency: the build can no longer be
 * broken by a third party rotating a filename.
 */
const serif = localFont({
  src: [
    { path: './fonts/cormorant-garamond-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/cormorant-garamond-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/cormorant-garamond-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-serif-next',
  display: 'swap',
});

const sans = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-next',
  display: 'swap',
});

const mono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-next',
  display: 'swap',
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
