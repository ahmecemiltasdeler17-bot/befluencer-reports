import { ReportPdfError } from "@/features/pdf/errors";
import {
  getAppOrigin as getConfiguredAppOrigin,
  isAppOriginConfigured as isConfiguredAppOriginReady,
  isValidConfiguredOrigin,
  resolveAppUrlCandidate,
} from "@/lib/origins";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RAW_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isRawExportToken(value: string): boolean {
  return RAW_TOKEN_PATTERN.test(value);
}

/** @deprecated Prefer isValidConfiguredOrigin from lib/origins — kept for PDF callers. */
export function isValidAppUrl(value: string): boolean {
  return isValidConfiguredOrigin(value);
}

export { resolveAppUrlCandidate };

/**
 * Trusted internal application origin (`APP_URL`).
 * Used for authenticated PDF print navigation — never Host / X-Forwarded-Host.
 */
export function getAppOrigin(): string {
  try {
    return getConfiguredAppOrigin();
  } catch {
    throw new ReportPdfError("app_origin_invalid", "APP_URL missing or invalid");
  }
}

export function isAppOriginConfigured(): boolean {
  return isConfiguredAppOriginReady();
}

/**
 * Builds the internal print URL. Ids and token are validated and the result is
 * re-checked against the trusted APP_URL origin, so no user input can steer
 * navigation. Authenticated and public PDF flows both load this route on APP_URL.
 */
export function buildPrintUrl({
  appOrigin,
  campaignId,
  reportVersionId,
  token,
}: {
  appOrigin: string;
  campaignId: string;
  reportVersionId: string;
  token: string;
}): string {
  if (!isUuid(campaignId) || !isUuid(reportVersionId)) {
    throw new ReportPdfError("report_not_found", "Invalid identifier format");
  }

  if (!isRawExportToken(token)) {
    throw new ReportPdfError("export_token_failed", "Invalid token format");
  }

  const origin = new URL(appOrigin).origin;
  const url = new URL(
    `/campaigns/${campaignId}/reports/${reportVersionId}/print`,
    origin
  );
  url.searchParams.set("token", token);

  if (url.origin !== origin) {
    throw new ReportPdfError("app_origin_invalid", "Origin mismatch");
  }

  return url.toString();
}

/** Guards headless navigation so only same-origin requests are ever allowed. */
export function isAllowedPrintUrl(candidate: string, appOrigin: string): boolean {
  try {
    const url = new URL(candidate);
    return url.origin === new URL(appOrigin).origin;
  } catch {
    return false;
  }
}
