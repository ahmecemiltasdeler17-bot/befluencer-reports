export type PublicReportShareErrorCode =
  | "invalid_token"
  | "share_not_found"
  | "share_revoked"
  | "share_expired"
  | "report_unavailable"
  | "pdf_disabled"
  | "snapshot_invalid"
  | "unauthorized"
  | "validation_failed"
  | "database_failure"
  | "browser_failure"
  | "pdf_timeout"
  | "rate_limited"
  | "app_origin_invalid";

/** Generic public-facing message — never distinguishes revoked / expired / missing. */
export const PUBLIC_SHARE_UNAVAILABLE_MESSAGE =
  "Bu rapor bağlantısı geçersiz veya artık kullanılamıyor.";

const MANAGEMENT_MESSAGES: Record<PublicReportShareErrorCode, string> = {
  invalid_token: "Geçersiz paylaşım bağlantısı.",
  share_not_found: "Paylaşım bağlantısı bulunamadı.",
  share_revoked: "Bu paylaşım bağlantısı iptal edilmiş.",
  share_expired: "Bu paylaşım bağlantısının süresi dolmuş.",
  report_unavailable:
    "Bu rapor sürümü paylaşılamaz. Yalnızca hazır veya arşivlenmiş sürümler paylaşılabilir.",
  pdf_disabled: "Bu paylaşım için PDF indirme kapalı.",
  snapshot_invalid: "Rapor anlık görüntüsü okunamadı.",
  unauthorized: "Bu işlem için yetkiniz yok.",
  validation_failed: "Girdi doğrulanamadı.",
  database_failure: "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
  browser_failure: "PDF oluşturucu başlatılamadı. Lütfen daha sonra tekrar deneyin.",
  pdf_timeout: "PDF zamanında oluşturulamadı. Lütfen tekrar deneyin.",
  rate_limited: "Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin.",
  app_origin_invalid:
    "Paylaşım yapılandırması eksik (APP_URL / PUBLIC_REPORT_URL).",
};

const STATUS_CODES: Record<PublicReportShareErrorCode, number> = {
  invalid_token: 404,
  share_not_found: 404,
  share_revoked: 404,
  share_expired: 404,
  report_unavailable: 409,
  pdf_disabled: 403,
  snapshot_invalid: 422,
  unauthorized: 401,
  validation_failed: 400,
  database_failure: 500,
  browser_failure: 500,
  pdf_timeout: 504,
  rate_limited: 429,
  app_origin_invalid: 500,
};

export class PublicReportShareError extends Error {
  readonly code: PublicReportShareErrorCode;
  readonly status: number;
  readonly detail?: string;

  constructor(code: PublicReportShareErrorCode, detail?: string) {
    super(MANAGEMENT_MESSAGES[code]);
    this.name = "PublicReportShareError";
    this.code = code;
    this.status = STATUS_CODES[code];
    this.detail = detail;
  }
}

export function isPublicReportShareError(
  error: unknown
): error is PublicReportShareError {
  return error instanceof PublicReportShareError;
}

/** Collapses all public failures into one Turkish message. */
export function toPublicShareMessage(error?: unknown): string {
  void error;
  return PUBLIC_SHARE_UNAVAILABLE_MESSAGE;
}

/** Distinct messages for authenticated management UI only. */
export function toManagementShareMessage(error: unknown): string {
  if (isPublicReportShareError(error)) {
    return error.message;
  }

  return MANAGEMENT_MESSAGES.database_failure;
}

export function publicShareErrorStatus(error: unknown): number {
  if (isPublicReportShareError(error)) {
    return error.status;
  }

  return 500;
}

/**
 * Server-side diagnostics. Never logs raw tokens, token hashes, or stack
 * traces to the client. Avoid including share tokens in breadcrumbs.
 */
export function logPublicShareDiagnostics(context: string, error: unknown): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  if (isPublicReportShareError(error)) {
    console.error(`[public-share] ${context}: ${error.code}`, error.detail ?? "");
    return;
  }

  console.error(`[public-share] ${context}: unexpected failure`);
}
