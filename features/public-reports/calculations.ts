import type {
  PublicReportShareRow,
  PublicReportShareSummary,
  PublicShareStatus,
  ShareExpirationPreset,
} from "@/features/public-reports/types";

export const SHARE_LABEL_MAX_LENGTH = 120;
export const SHARE_MAX_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;

const PRESET_MS: Record<Exclude<ShareExpirationPreset, "never" | "custom">, number> =
  {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

export function sanitizeShareLabel(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, SHARE_LABEL_MAX_LENGTH);

  return cleaned.length > 0 ? cleaned : null;
}

export function resolveShareExpiresAt(
  preset: ShareExpirationPreset,
  now: Date,
  customExpiresAt?: string | null
): string | null {
  if (preset === "never") {
    return null;
  }

  if (preset === "custom") {
    if (!customExpiresAt) {
      throw new Error("custom_expires_required");
    }

    const expiry = new Date(customExpiresAt);

    if (!Number.isFinite(expiry.getTime())) {
      throw new Error("invalid_custom_expiry");
    }

    if (expiry.getTime() <= now.getTime()) {
      throw new Error("expiry_not_future");
    }

    if (expiry.getTime() - now.getTime() > SHARE_MAX_EXPIRY_MS) {
      throw new Error("expiry_too_far");
    }

    return expiry.toISOString();
  }

  const ms = PRESET_MS[preset];
  return new Date(now.getTime() + ms).toISOString();
}

export function assertExpiryWithinLimit(
  expiresAt: string | null,
  now: Date,
  createdAt?: Date
): void {
  if (expiresAt == null) {
    return;
  }

  const expiry = new Date(expiresAt).getTime();

  if (!Number.isFinite(expiry)) {
    throw new Error("invalid_custom_expiry");
  }

  if (expiry <= now.getTime()) {
    throw new Error("expiry_not_future");
  }

  const base = createdAt?.getTime() ?? now.getTime();

  if (expiry - base > SHARE_MAX_EXPIRY_MS) {
    throw new Error("expiry_too_far");
  }
}

export function resolvePublicShareStatus(
  row: Pick<PublicReportShareRow, "revoked_at" | "expires_at">,
  now: Date = new Date()
): PublicShareStatus {
  if (row.revoked_at) {
    return "revoked";
  }

  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) {
    return "expired";
  }

  return "active";
}

export function mapShareRow(
  row: PublicReportShareRow,
  now: Date = new Date()
): PublicReportShareSummary {
  return {
    id: row.id,
    reportVersionId: row.report_version_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastAccessedAt: row.last_accessed_at,
    accessCount: Number(row.access_count),
    label: row.label,
    allowPdfDownload: row.allow_pdf_download,
    status: resolvePublicShareStatus(row, now),
  };
}

export function isShareableVersionStatus(status: string): boolean {
  return status === "ready" || status === "archived";
}
