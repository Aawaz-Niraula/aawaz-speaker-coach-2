import Link from 'next/link';

import { AUTHOR, isPublished } from '@/lib/site';

/*
 * Shared frame for every content page.
 *
 * These pages stay server components: nothing here may import framer-motion or
 * any other client-only component. They load instantly on a phone, and a
 * crawler reads the plain HTML.
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
    <>
      {/* The bar sits on a wash that starts near black at the very top edge
          and warms into violet as it falls, so the page never begins on a
          flat field of one colour. */}
      <header className="relative z-30">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,#06060b_0%,rgba(28,19,54,0.72)_45%,rgba(6,6,11,0)_100%)]"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-3 px-5 py-5 md:flex-row md:items-center md:gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="mr-auto font-serif text-xl tracking-[-0.03em] text-white transition hover:text-[#ddd6fe] sm:text-2xl"
            >
              Aawaz Speaker Coach
            </Link>
            <Link
              href="/coach"
              className="liquid-glass inline-flex h-11 shrink-0 items-center rounded-full px-5 font-semibold text-[#06060b] transition hover:brightness-[1.06] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a78bfa] md:hidden"
            >
              Open the coach
            </Link>
          </div>

          <nav
            aria-label="Main"
            className="chrome-blur flex items-center justify-between gap-1 self-stretch overflow-x-auto rounded-full border border-white/10 bg-[linear-gradient(120deg,rgba(124,92,222,0.34),rgba(249,168,212,0.2))] p-1 md:ml-auto md:self-auto md:overflow-visible"
          >
            {SECTION_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm text-[#e7e2f8] transition hover:bg-white/12 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            {live.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm text-[#e7e2f8] transition hover:bg-white/12 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/coach"
            className="liquid-glass hidden h-11 shrink-0 items-center rounded-full px-5 font-semibold text-[#06060b] transition hover:brightness-[1.06] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a78bfa] md:inline-flex"
          >
            Open the coach
          </Link>
        </div>
      </header>

      {/* Full width on purpose: the homepage runs full bleed colour bands that
          have to escape the reading column. A text page wraps itself. */}
      <main className="pb-16">{children}</main>

      <footer className="border-t border-white/10 bg-[#06060b] text-sm text-[#a79dc8]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-serif text-xl tracking-[-0.03em] text-white">Aawaz Speaker Coach</p>
            <p className="mt-1">
              Built by {AUTHOR.name}. &copy; {new Date().getFullYear()}.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-1">
            {SECTION_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="py-2 transition hover:text-white sm:py-0">
                {link.label}
              </Link>
            ))}
            {live.map((link) => (
              <Link key={link.path} href={link.path} className="py-2 transition hover:text-white sm:py-0">
                {link.label}
              </Link>
            ))}
            <Link href="/coach" className="py-2 transition hover:text-white sm:py-0">
              Open the coach
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
