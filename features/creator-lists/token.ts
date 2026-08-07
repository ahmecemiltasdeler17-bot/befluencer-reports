import {
  buildPublicShareUrl as buildReportShareUrl,
  generateAccessNonce,
  generateRawShareToken,
  hashShareToken,
  isAccessNonce,
  isRawShareToken,
  normalizeRouteShareToken,
} from "@/features/public-reports/token";

export {
  generateAccessNonce,
  generateRawShareToken,
  hashShareToken,
  isAccessNonce,
  isRawShareToken,
  normalizeRouteShareToken,
};

/**
 * Builds `/lists/<raw-token>` against PUBLIC_REPORT_URL (falls back to APP_URL).
 * Never derives the host from a request header.
 */
export function buildPublicCreatorListUrl(
  publicReportOrigin: string,
  rawToken: string
): string {
  const reportUrl = buildReportShareUrl(publicReportOrigin, rawToken);
  return reportUrl.replace("/r/", "/lists/");
}
