import Link from 'next/link';

import { AUTHOR, isPublished } from '@/lib/site';

/*
 * Shared frame for every content page (homepage, About, frameworks, guides).
 *
 * These pages stay server components: nothing here may import framer-motion or
 * any other client-only component. They need to load instantly on a phone, and
 * a crawler reads the plain HTML.
 *
 * Links are drawn from PAGES in src/lib/site.ts, so a link only appears once its
 * page is live — the header and footer can never point at a 404.
 */
const SECTIONS = [
  { path: '/frameworks', header: 'Frameworks', footer: 'Speech frameworks' },
  { path: '/about', header: 'About', footer: 'About Aawaz' },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const live = SECTIONS.filter((section) => isPublished(section.path));

  return (
    <>
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-6">
        <Link href="/" className="font-serif text-2xl tracking-[-0.03em] text-white">
          Aawaz Speaker Coach
        </Link>
        <nav aria-label="Main" className="flex items-center gap-5 text-sm text-[#cfc8e8]">
          {live.map((section) => (
            <Link key={section.path} href={section.path} className="transition hover:text-white">
              {section.header}
            </Link>
          ))}
          <Link
            href="/coach"
            className="inline-flex h-11 items-center rounded-full bg-[linear-gradient(135deg,#a78bfa,#f9a8d4)] px-5 font-semibold text-[#06060b] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a78bfa]"
          >
            Start practising
          </Link>
        </nav>
      </header>
      {/* Same outer width as the header so content lines up with the logo.
          Each page sets its own measure: the homepage uses the full width for
          its two-column sections, and a text page wraps itself in max-w-3xl. */}
      <main className="mx-auto max-w-5xl px-5 pb-16">{children}</main>
      <footer className="mx-auto max-w-5xl border-t border-white/10 px-5 py-10 text-sm text-[#a79dc8]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-serif text-xl tracking-[-0.03em] text-white">Aawaz Speaker Coach</p>
            <p className="mt-1">Built by {AUTHOR.name}.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-1">
            {live.map((section) => (
              <Link key={section.path} href={section.path} className="py-2 transition hover:text-white">
                {section.footer}
              </Link>
            ))}
            <Link href="/coach" className="py-2 transition hover:text-white">
              Open the coach
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
