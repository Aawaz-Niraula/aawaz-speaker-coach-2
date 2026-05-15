import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "@libsql/kysely-libsql"],
  /* config options here */
};

export default nextConfig;
