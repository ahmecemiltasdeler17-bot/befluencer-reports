import { resolveAppUrlCandidate } from "@/lib/origins/candidates";
import { OriginConfigError } from "@/lib/origins/types";
import { normalizeConfiguredOrigin } from "@/lib/origins/validate-origin";

/**
 * Internal management application origin (`APP_URL`).
 *
 * Priority (via resolveAppUrlCandidate):
 * 1. APP_URL
 * 2. Vercel HTTPS deployment URL when APP_URL is missing or localhost-on-Vercel
 * 3. http://localhost:3000 only in non-production local development
 *
 * Never derived from Host / X-Forwarded-Host.
 */
export function getAppOrigin(): string {
  const candidate = resolveAppUrlCandidate();

  if (!candidate) {
    throw new OriginConfigError(
      "missing",
      "APP_URL is missing. Set APP_URL to the internal application origin (e.g. https://befluencer-reports.vercel.app)."
    );
  }

  try {
    return normalizeConfiguredOrigin(candidate);
  } catch (error) {
    if (error instanceof OriginConfigError) {
      throw new OriginConfigError(
        error.code,
        `APP_URL is invalid: ${error.message}`
      );
    }
    throw error;
  }
}

export function isAppOriginConfigured(): boolean {
  try {
    getAppOrigin();
    return true;
  } catch {
    return false;
  }
}
