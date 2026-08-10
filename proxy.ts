import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Session refresh for all matched routes. Login redirect lives in
 * `app/(protected)/layout.tsx` — public share paths (`/r/*`, `/lists/*`,
 * `/api/public/*`) sit outside that layout and must remain reachable without
 * a session.
 *
 * Hostname-aware redirects (app.befluencer.co vs reports.befluencer.co) are
 * intentionally not enforced here until custom DNS is fully live — both hosts
 * may serve the same deployment during the vercel.app transitional period.
 */
export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isPublicSharePath =
    pathname.startsWith("/r/") ||
    pathname.startsWith("/lists/") ||
    pathname.startsWith("/api/public/");

  const isPrintPath = /\/campaigns\/[^/]+\/reports\/[^/]+\/print\/?$/.test(
    pathname
  );

  // Baseline hardening for every proxied response (also set in next.config).
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  if (isPublicSharePath || isPrintPath) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
