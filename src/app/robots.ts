import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/*
 * Every crawler is allowed, AI search crawlers included (OAI-SearchBot,
 * Claude-SearchBot, PerplexityBot): blocking them removes the site from
 * ChatGPT, Claude and Perplexity search answers. Only the API is off limits.
 *
 * No `host` entry: `Host:` is a Yandex-only directive that Google and Bing
 * ignore, and the canonical tags already name the preferred host.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
