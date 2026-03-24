import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aawaz Speaker Coach',
  description: 'History-aware speech coaching with brutal, technical feedback.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
