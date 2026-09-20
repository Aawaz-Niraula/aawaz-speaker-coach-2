/**
 * Structured data for search engines and AI crawlers.
 *
 * A plain <script> rather than next/script: this is data, not code to run.
 * `<` is escaped to its unicode form so no string inside the payload can
 * close the script tag early — the sanitisation Next.js recommends.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
