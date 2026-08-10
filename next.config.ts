import type { NextConfig } from "next";

/**
 * Minimal production-safe headers.
 * Avoid a full CSP here — Recharts, Next assets, Supabase Auth, and provider
 * images must keep working. Public token routes also get no-store via proxy.ts.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const publicShareHeaders = [
  ...securityHeaders,
  { key: "Cache-Control", value: "private, no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

/**
 * Exact assets required by @sparticuz/chromium.executablePath(binDir).
 * Listed explicitly — Turbopack NFT previously traced only build/*.js and
 * omitted every *.br pack, which made production launch fail before goto.
 */
const chromiumTraceIncludes = [
  "./node_modules/@sparticuz/chromium/package.json",
  "./node_modules/@sparticuz/chromium/build/**/*",
  "./node_modules/@sparticuz/chromium/bin/chromium.br",
  "./node_modules/@sparticuz/chromium/bin/fonts.tar.br",
  "./node_modules/@sparticuz/chromium/bin/swiftshader.tar.br",
  "./node_modules/@sparticuz/chromium/bin/al2023.tar.br",
  "./node_modules/tar-fs/**/*",
];

const nextConfig: NextConfig = {
  /**
   * Intentionally NOT raising serverActions.bodySizeLimit.
   * Featured preview MP4/WebM (up to 30MB) uploads go browser → Supabase
   * Storage; the server action only receives metadata (path + MIME).
   * Next.js default action body cap remains 1MB.
   */
  images: {
    // Avatars/thumbnails often use <Image unoptimized>, but allow provider CDNs
    // so custom domains never depend on a missing remotePatterns allowlist.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.tiktokcdn.com" },
      { protocol: "https", hostname: "**.tiktokcdn-us.com" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
  /**
   * Chromium and Puppeteer must stay external: the bundler cannot trace the
   * native binary, and bundling them would break the serverless function.
   */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "tar-fs"],
  /**
   * Force the brotli Chromium packs into both PDF API functions.
   * Route keys use contains-matching (picomatch) against normalized app paths.
   */
  outputFileTracingIncludes: {
    "/api/campaigns/*/reports/*/pdf": chromiumTraceIncludes,
    "/api/campaigns/[id]/reports/[versionId]/pdf": chromiumTraceIncludes,
    "/api/public/reports/*/pdf": chromiumTraceIncludes,
    "/api/public/reports/[token]/pdf": chromiumTraceIncludes,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/r/:path*",
        headers: publicShareHeaders,
      },
      {
        source: "/lists/:path*",
        headers: publicShareHeaders,
      },
      {
        source: "/api/public/:path*",
        headers: publicShareHeaders,
      },
      {
        source: "/campaigns/:id/reports/:versionId/print",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
};

export default nextConfig;
