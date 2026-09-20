import type { MetadataRoute } from 'next';
import { PAGES, SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((page) => ({
    url: page.path === '/' ? SITE_URL : `${SITE_URL}${page.path}`,
    lastModified: page.updated,
  }));
}
