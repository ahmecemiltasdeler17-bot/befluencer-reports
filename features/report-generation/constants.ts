export const REPORT_SNAPSHOT_SCHEMA_VERSION = 1;

export const REPORT_VERSION_STATUSES = [
  "generating",
  "ready",
  "failed",
  "archived",
] as const;

export type ReportVersionStatus = (typeof REPORT_VERSION_STATUSES)[number];

export const GENERATION_MAX_VERSION_RETRIES = 2;

export const HASH_EXCLUDED_PATHS = [
  "reportMetadata.generatedAt",
  "reportMetadata.generatedBy",
  "reportMetadata.versionNumber",
  "reportMetadata.reportVersionId",
] as const;
