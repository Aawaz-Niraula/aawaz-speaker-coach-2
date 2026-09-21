import type { Metadata } from 'next';

/*
 * These routes exist only so the homepage's screenshots can be rendered from
 * the real components. They are temporary, and they must never be indexed:
 * robots.ts allows everything outside /api/, so without this a crawler would
 * happily list two near duplicates of the app's report.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ReportPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
