import { cn } from '@/lib/utils';

type ShellProps = {
  children: React.ReactNode;
  className?: string;
  /** Visual accent for the surface. */
  tone?: 'default' | 'accent' | 'danger';
};

/**
 * Primary glass surface used across the app.
 *
 * The blur lives in `.glass-surface` rather than inline: cards scroll, and a
 * backdrop-filter on a scrolling element forces the compositor to re-sample
 * everything behind it every frame. The class drops the blur on touch devices
 * and for reduced-motion users, keeping the same look via a solid tint.
 */
export function Shell({ children, className, tone = 'default' }: ShellProps) {
  return (
    <div
      className={cn(
        'glass-edge glass-surface relative rounded-[24px] border bg-white/[0.055] p-4 shadow-[0_20px_70px_rgba(2,6,23,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] sm:rounded-[28px] sm:p-6',
        tone === 'default' && 'border-white/10',
        tone === 'accent' && 'border-[#a78bfa]/25 bg-[linear-gradient(135deg,rgba(167,139,250,0.09),rgba(249,168,212,0.06))]',
        tone === 'danger' && 'border-[#f87171]/20',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Tiny uppercase label used as section eyebrow. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('font-mono text-[10px] uppercase tracking-[0.3em] text-[#857ca2]', className)}>{children}</p>;
}

/** Serif section heading. */
export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('font-serif text-lg font-medium tracking-tight text-white sm:text-xl', className)}>{children}</p>;
}
