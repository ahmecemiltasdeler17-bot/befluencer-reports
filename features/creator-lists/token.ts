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
 * Builds `/lists/<raw-token>` against a trusted public-report origin.
 * Prefer `getPublicReportUrl(\`/lists/${token}\`)` at call sites.
 * Never derives the host from a request header.
 */
export function buildPublicCreatorListUrl(
  publicReportOrigin: string,
  rawToken: string
): string {
  const reportUrl = buildReportShareUrl(publicReportOrigin, rawToken);
  return reportUrl.replace("/r/", "/lists/");
}
