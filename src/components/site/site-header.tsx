'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { GlassSurface } from './glass-surface';
import { ArrowUpRight, Menu, X } from 'lucide-react';

const SECTION_LINKS = [
  { path: '/#report', label: 'The feedback' },
  { path: '/#formats', label: 'Speech formats' },
  { path: '/#questions', label: 'Questions' },
];

export function SiteHeader({ additionalLinks = [] }: {
  additionalLinks?: { path: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const links = [...SECTION_LINKS, ...additionalLinks];
  const actionClass = 'site-button header-action glass-control';

  return (
    <header
      className="site-header"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          menuButton.current?.focus();
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
          onClick={() => setOpen(!open)}
        >
          <GlassSurface />
          {open ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
        </button>
      </div>
      <nav id="mobile-navigation" aria-label="Mobile" hidden={!open} className="mobile-navigation">
        {links.map(({ path, label }) => (
          <Link key={path} href={path} onClick={() => setOpen(false)} className="glass-control"><GlassSurface />
            {label}<ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ))}
        <Link href="/coach" onClick={() => setOpen(false)} className="site-button glass-control"><GlassSurface />
          Start practising <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </nav>
    </header>
  );
}
