import type { NextConfig } from "next";

/*
 * Browser-side hardening that costs nothing at runtime.
 *
 * - frame-ancestors / X-Frame-Options: the app records the microphone, so it
 *   must never render inside someone else's page where a click could be
 *   redirected.
 * - Permissions-Policy: the microphone is the only device feature the app
 *   uses, and only from its own origin.
 * - Content-Security-Policy is limited to the directives that cannot break
 *   rendering. A script-src policy needs nonces threaded through every inline
 *   script Next emits, which is a separate piece of work.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
];

const nextConfig: NextConfig = {
  // Set only for a local phone preview; production exposes no dev endpoint.
  allowedDevOrigins: process.env.AAWAZ_DEV_HOST ? [process.env.AAWAZ_DEV_HOST] : [],
  images: { qualities: [62, 75] },
  serverExternalPackages: ["@libsql/client", "@libsql/kysely-libsql"],
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
  /* The coach used to live at `/`. A Google sign-in started before it moved
     returns to `/?auth=...` or `/?error=...`; send those on to the coach with
     the query string intact so the greeting or error toast still appears.
     Matching on the params keeps the homepage itself a static page. */
  async redirects() {
    return [
      { source: "/", has: [{ type: "query", key: "auth" }], destination: "/coach", permanent: false },
      { source: "/", has: [{ type: "query", key: "error" }], destination: "/coach", permanent: false },
    ];
  },
};

export default nextConfig;
