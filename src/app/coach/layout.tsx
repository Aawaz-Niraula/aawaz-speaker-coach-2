import type { Metadata } from 'next';

import { pageMetadata } from '@/lib/site';

/*
 * The coach is an app screen, not a page to rank: almost no text, and it
 * would compete with the homepage for the same searches. It stays crawlable
 * (never add it to robots.txt disallow — a crawler has to fetch the page to
 * see this noindex) but out of the index.
 *
 * pageMetadata still supplies its own URL, description and preview image, so
 * a shared /coach link previews as the coach rather than as the homepage.
 */
export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Coach | Aawaz Speaker Coach',
    description:
      'Pick the format you are giving, record your speech, and get a score out of 100 with specific fixes for structure, pace, pauses and filler words.',
    path: '/coach',
  }),
  robots: { index: false, follow: true },
};

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return children;
}
