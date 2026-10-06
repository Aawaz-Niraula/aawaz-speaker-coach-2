'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { GlassSurface } from './glass-surface';
import { ArrowUpRight } from 'lucide-react';

const SECTION_LINKS = [
  { path: '/#report', label: 'The feedback' },
  { path: '/#formats', label: 'Speech formats' },
  { path: '/#questions', label: 'Questions' },
];

export function SiteHeader({ additionalLinks = [] }: {
  additionalLinks?: { path: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const links = [...SECTION_LINKS, ...additionalLinks];
  const actionClass = 'site-button header-action glass-control';

  function closeMenu() {
    setOpen(false);
    menuButton.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!open) return;

    // Keep the menu and its top bar in one focus boundary. Lock scrolling
    // without moving the document, so section links retain native anchoring.
    const root = document.documentElement;
    const body = document.body;
    const previous = { rootOverflow: root.style.overflow, bodyOverflow: body.style.overflow, padding: body.style.paddingRight };
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (scrollbar) body.style.paddingRight = `${scrollbar}px`;

    const background = [...document.querySelectorAll<HTMLElement>('.site-shell > main, .site-shell > footer, .site-shell > .site-skip-link')];
    const previousInert = background.map((element) => element.inert);
    background.forEach((element) => { element.inert = true; });

    const desktop = window.matchMedia('(min-width: 1101px)');
    const onResize = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener('change', onResize);

    return () => {
      root.style.overflow = previous.rootOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.paddingRight = previous.padding;
      background.forEach((element, index) => { element.inert = previousInert[index]; });
      desktop.removeEventListener('change', onResize);
    };
  }, [open]);

  return (
    <header
      ref={header}
      className="site-header"
      data-menu-open={open}
      role={open ? 'dialog' : undefined}
      aria-modal={open ? true : undefined}
      aria-label={open ? 'Site navigation' : undefined}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          closeMenu();
        }
        if (event.key === 'Tab' && open) {
          const focusable = [...(header.current?.querySelectorAll<HTMLElement>('a[href], button') ?? [])]
            .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div className="site-container header-inner">
        <Link href="/" className="site-wordmark" onClick={() => setOpen(false)}>
          Aawaz Speaker Coach
        </Link>
        <nav aria-label="Main" className="header-navigation">
          {links.map(({ path, label }) => (
            <Link key={path} href={path} className="glass-control"><GlassSurface />
              {label}
            </Link>
          ))}
        </nav>
        <Link href="/coach" className={actionClass}><GlassSurface />
          Start practising <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <button
          ref={menuButton}
          type="button"
          className="menu-toggle glass-control"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => open ? closeMenu() : setOpen(true)}
        >
          <span className="menu-lines" aria-hidden="true"><span /><span /><span /></span>
        </button>
      </div>
      <nav id="mobile-navigation" aria-label="Mobile" aria-hidden={!open} inert={!open} className="mobile-navigation">
        <div className="mobile-navigation-content">
          {links.map(({ path, label }) => (
            <Link key={path} href={path} tabIndex={open ? 0 : -1} onClick={closeMenu}>
              {label}
            </Link>
          ))}
          <Link href="/coach" tabIndex={open ? 0 : -1} onClick={closeMenu} className="site-button glass-control"><GlassSurface />
            Start practising <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </nav>
    </header>
  );
}
