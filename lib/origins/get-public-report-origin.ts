import { resolvePublicReportUrlCandidate } from "@/lib/origins/candidates";
import { OriginConfigError } from "@/lib/origins/types";
import { normalizeConfiguredOrigin } from "@/lib/origins/validate-origin";

/**
 * Public report origin (`PUBLIC_REPORT_URL`, falling back to `APP_URL`).
 *
 * Priority (via resolvePublicReportUrlCandidate):
 * 1. PUBLIC_REPORT_URL
 * 2. APP_URL
 * 3. Vercel HTTPS deployment URL when APP_URL is missing or localhost-on-Vercel
 * 4. http://localhost:3000 only in non-production local development
 *
 * Never derived from Host / X-Forwarded-Host.
 */
export function getPublicReportOrigin(): string {
  const candidate = resolvePublicReportUrlCandidate();

  if (!candidate) {
    throw new OriginConfigError(
      "missing",
      "PUBLIC_REPORT_URL / APP_URL is missing. Set PUBLIC_REPORT_URL and APP_URL to the public https origin (e.g. https://befluencer-reports.vercel.app)."
    );
  }

  try {
    return normalizeConfiguredOrigin(candidate);
  } catch (error) {
    if (error instanceof OriginConfigError) {
      throw new OriginConfigError(
        error.code,
        `PUBLIC_REPORT_URL is invalid: ${error.message}`
      );
    }
    throw error;
  }
}

export function isPublicReportOriginConfigured(): boolean {
  try {
    getPublicReportOrigin();
    return true;
  } catch {
    return false;
  }
}
