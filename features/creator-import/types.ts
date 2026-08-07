export const CREATOR_IMPORT_MAX_ROWS = 500;
export const CREATOR_IMPORT_MAX_TEXT_CHARS = 250_000;
export const CREATOR_IMPORT_BATCH_SIZE = 50;

export type CreatorImportRowStatus =
  | "ready"
  | "existing"
  | "duplicate_in_list"
  | "invalid_link"
  | "username_unextracted";

export type CreatorImportRow = {
  /** 1-based source line / CSV row index for display. */
  rowNumber: number;
  original: string;
  username: string | null;
  displayName: string | null;
  profileUrl: string | null;
  status: CreatorImportRowStatus;
};

export type CreatorImportTotals = {
  total: number;
  ready: number;
  existing: number;
  duplicateInList: number;
  invalid: number;
};

export type CreatorImportPreview = {
  rows: CreatorImportRow[];
  totals: CreatorImportTotals;
  error?: string;
};

export type CreatorImportInsertResult = {
  total: number;
  inserted: number;
  skippedExisting: number;
  skippedDuplicate: number;
  invalid: number;
  failed: number;
  insertedIds: string[];
  message?: string;
  error?: string;
};

export type CreatorImportSyncStatus = "success" | "failed" | "skipped";

export type CreatorImportSyncErrorCode =
  | "creator_unavailable"
  | "username_mismatch"
  | "follower_unavailable"
  | "upstream_temporary"
  | "timeout"
  | "not_configured"
  | "invalid_username"
  | "unknown";

export type CreatorImportSyncRow = {
  creatorId: string;
  username: string;
  profileUrl: string | null;
  status: CreatorImportSyncStatus;
  errorCode: CreatorImportSyncErrorCode | null;
  errorMessage: string | null;
};

export type CreatorImportSyncResult = {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  rows: CreatorImportSyncRow[];
  message?: string;
  error?: string;
};

export const CREATOR_IMPORT_STATUS_LABELS: Record<
  CreatorImportRowStatus,
  string
> = {
  ready: "Hazır",
  existing: "Sistemde mevcut",
  duplicate_in_list: "Listede tekrar ediyor",
  invalid_link: "Geçersiz bağlantı",
  username_unextracted: "Kullanıcı adı çıkarılamadı",
};
