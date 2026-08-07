export type ShareExpirationPreset =
  | "never"
  | "24h"
  | "7d"
  | "30d"
  | "custom";

export type PublicShareStatus = "active" | "expired" | "revoked";

export type PublicReportShareRow = {
  id: string;
  report_version_id: string;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_accessed_at: string | null;
  access_count: number;
  label: string | null;
  allow_pdf_download: boolean;
};

/** Management-facing share summary. Never includes token_hash or raw token. */
export type PublicReportShareSummary = {
  id: string;
  reportVersionId: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
  label: string | null;
  allowPdfDownload: boolean;
  status: PublicShareStatus;
};

export type CreatePublicReportShareInput = {
  reportVersionId: string;
  label?: string | null;
  expiration: ShareExpirationPreset;
  /** Required when expiration is `custom`. ISO datetime string. */
  customExpiresAt?: string | null;
  allowPdfDownload: boolean;
};

export type CreatePublicReportShareResult = {
  shareId: string;
  publicUrl: string;
  expiresAt: string | null;
  allowPdfDownload: boolean;
};

export type UpdatePublicReportShareInput = {
  shareId: string;
  label?: string | null;
  expiresAt?: string | null;
  allowPdfDownload?: boolean;
};

export type PublicShareActionState = {
  success?: string;
  error?: string;
  result?: CreatePublicReportShareResult;
};

/** Payload returned by resolve / consume RPCs for public rendering. */
export type PublicReportSharePayload = {
  shareId: string;
  reportVersionId: string;
  campaignId: string;
  versionNumber: number;
  status: "ready" | "archived";
  generatedAt: string | null;
  snapshot: unknown;
  campaignName: string;
  reportNumber: string | null;
  allowPdfDownload: boolean;
  expiresAt: string | null;
  label: string | null;
  accessRecorded?: boolean;
};
