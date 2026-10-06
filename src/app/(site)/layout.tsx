import Link from 'next/link';
import localFont from 'next/font/local';
import './site.css';
import { SiteHeader } from '@/components/site/site-header';

import { AUTHOR, isPublished } from '@/lib/site';

const headline = localFont({
  src: '../fonts/bricolage-grotesque-600.woff2',
  weight: '600',
  style: 'normal',
  variable: '--font-headline',
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
});

const wordmark = localFont({
  src: '../fonts/allura-400.woff2',
  weight: '400',
  style: 'normal',
  variable: '--font-wordmark',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

/*
 * Shared frame for every content page.
 *
 * Page content stays server-rendered and readable by crawlers. The header
 * adds only the small client component needed for the mobile menu.
 *
 * The nav lists the page's own sections plus the coach. Frameworks and About
 * join it the moment those pages exist, via PAGES in src/lib/site.ts, and not
 * a second before: a nav that links to pages which are not there yet would
 * send every crawler into a 404, which is the opposite of the point.
 */
const PAGE_LINKS = [
  { path: '/frameworks', label: 'Frameworks' },
  { path: '/about', label: 'About' },
];

const SECTION_LINKS = [
  { href: '/#report', label: 'The report' },
  { href: '/#formats', label: 'Formats' },
  { href: '/#questions', label: 'Questions' },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const live = PAGE_LINKS.filter((link) => isPublished(link.path));

  return (
    <div className={`site-shell ${headline.variable} ${wordmark.variable}`}>
      <a href="#main-content" className="site-skip-link">Skip to content</a>
      <SiteHeader additionalLinks={live} />

      {/* Full width on purpose: the homepage runs full bleed colour bands that
          have to escape the reading column. A text page wraps itself. */}
      <main id="main-content">{children}</main>

      <footer className="site-footer">
        <div className="site-container footer-inner">
          <div>
            <p className="site-wordmark">Aawaz Speaker Coach</p>
            <p className="footer-credit">
              Built by {AUTHOR.name}. &copy; {new Date().getFullYear()}.
            </p>
          </div>
          <nav aria-label="Footer" className="footer-links">
            {SECTION_LINKS.map((link) => (
              <Link key={link.href} href={link.href} >
                {link.label}
              </Link>
            ))}
            {live.map((link) => (
              <Link key={link.path} href={link.path} >
                {link.label}
              </Link>
            ))}
            <Link href="/coach" >
              Open the coach
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
