import { getAppOrigin } from "@/lib/origins/get-app-origin";
import { getPublicReportOrigin } from "@/lib/origins/get-public-report-origin";
import { OriginConfigError } from "@/lib/origins/types";

/**
 * Join a trusted origin with an absolute-or-relative path.
 * Never reads Host headers; origin must already be configured.
 */
export function joinConfiguredOriginPath(
  origin: string,
  path: string = "/"
): string {
  let base: URL;

  try {
    base = new URL(origin);
  } catch {
    throw new OriginConfigError("invalid_url", "Origin is not a valid URL.");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, base.origin);

  if (url.origin !== base.origin) {
    throw new OriginConfigError(
      "invalid_url",
      "Path resolution escaped the configured origin."
    );
  }

  return url.toString();
}

/**
 * Absolute admin/app URL.
 * Example: getAppUrl("/campaigns") → https://app.befluencer.co/campaigns
 */
export function getAppUrl(path: string = "/"): string {
  return joinConfiguredOriginPath(getAppOrigin(), path);
}

/**
 * Absolute public report / creator-list URL.
 * Example: getPublicReportUrl("/r/token") → https://reports.befluencer.co/r/token
 */
export function getPublicReportUrl(path: string = "/"): string {
  return joinConfiguredOriginPath(getPublicReportOrigin(), path);
}
