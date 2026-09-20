import type { Metadata } from 'next';

export const SITE_URL = 'https://speaker-coach.aawax.me';
export const SITE_NAME = 'Aawaz Speaker Coach';

export const AUTHOR = {
  name: 'Aawaz Niraula',
  url: `${SITE_URL}/about`,
};

/**
 * Every public, indexable page.
 *
 * The sitemap is generated from this list, and the site header and footer
 * only link pages that appear in it, so publishing a page is one line here.
 * Set `updated` to the date the page's content last really changed — never
 * the build date. A lastmod that moves on every deploy is a signal crawlers
 * learn to ignore.
 */
export const PAGES: { path: string; updated: string }[] = [
  { path: '/', updated: '2026-09-14' },
];

export function isPublished(path: string) {
  return PAGES.some((page) => page.path === path);
}

/**
 * The link preview drawn by src/app/opengraph-image.tsx, which takes its alt
 * text, size and type from here so they're defined once.
 *
 * The v= query exists to bust the copies Facebook, LinkedIn and WhatsApp cache
 * per URL: bump it whenever the image's design changes.
 */
export const PREVIEW_IMAGE = {
  url: '/opengraph-image?v=1',
  width: 1200,
  height: 630,
  alt: 'Aawaz Speaker Coach: practise a speech and get an honest score',
  type: 'image/png',
};

/**
 * Metadata for a content page.
 *
 * Next.js replaces a parent's `openGraph` and `twitter` objects wholesale
 * rather than merging them. A page that sets its own `openGraph` therefore
 * loses everything it would have inherited — the site name, the card type and,
 * easy to miss, the image from opengraph-image.tsx, which leaves the link
 * preview blank. Building both objects here, image included, keeps every
 * page's preview complete.
 */
export function pageMetadata({
  title,
  description,
  path,
  type = 'website',
}: {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
}): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: 'en_GB',
      url: path,
      title,
      description,
      images: [PREVIEW_IMAGE],
    },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: PREVIEW_IMAGE.url, alt: PREVIEW_IMAGE.alt }] },
  };
}
