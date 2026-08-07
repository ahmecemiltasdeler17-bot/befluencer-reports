/**
 * Typed PDF export failures.
 *
 * Every error carries a sanitized Turkish message safe for the browser. Causes,
 * stack traces, executable paths, tokens and Supabase errors stay server-side
 * and are only surfaced in development via logPdfDiagnostics().
 */

export type ReportPdfErrorCode =
  | "report_not_found"
  | "report_not_ready"
  | "invalid_snapshot"
  | "export_token_failed"
  | "browser_launch_failed"
  | "print_route_timeout"
  | "print_ready_timeout"
  | "pdf_generation_failed"
  | "pdf_too_large"
  | "app_origin_invalid"
  | "unauthorized";

const MESSAGES: Record<ReportPdfErrorCode, string> = {
  report_not_found: "Rapor sürümü bulunamadı.",
  report_not_ready:
    "Bu rapor sürümü indirilemez. Yalnızca hazır veya arşivlenmiş sürümler PDF olarak alınabilir.",
  invalid_snapshot: "Rapor anlık görüntüsü okunamadı.",
  export_token_failed: "PDF indirme izni oluşturulamadı. Lütfen tekrar deneyin.",
  browser_launch_failed:
    "PDF oluşturucu başlatılamadı. Lütfen daha sonra tekrar deneyin.",
  print_route_timeout: "Rapor sayfası zamanında yüklenemedi. Lütfen tekrar deneyin.",
  print_ready_timeout: "Rapor grafikleri zamanında hazırlanamadı. Lütfen tekrar deneyin.",
  pdf_generation_failed: "PDF oluşturulamadı. Lütfen tekrar deneyin.",
  pdf_too_large: "PDF dosyası beklenenden büyük olduğu için indirilemedi.",
  app_origin_invalid: "PDF dışa aktarma yapılandırması eksik.",
  unauthorized: "Bu işlem için yetkiniz yok.",
};

const STATUS_CODES: Record<ReportPdfErrorCode, number> = {
  report_not_found: 404,
  report_not_ready: 409,
  invalid_snapshot: 422,
  export_token_failed: 500,
  browser_launch_failed: 500,
  print_route_timeout: 504,
  print_ready_timeout: 504,
  pdf_generation_failed: 500,
  pdf_too_large: 500,
  app_origin_invalid: 500,
  unauthorized: 401,
};

export class ReportPdfError extends Error {
  readonly code: ReportPdfErrorCode;
  readonly status: number;
  /** Development-only detail. Never sent to the browser. */
  readonly detail?: string;

  constructor(code: ReportPdfErrorCode, detail?: string) {
    super(MESSAGES[code]);
    this.name = "ReportPdfError";
    this.code = code;
    this.status = STATUS_CODES[code];
    this.detail = detail;
  }
}

export function isReportPdfError(error: unknown): error is ReportPdfError {
  return error instanceof ReportPdfError;
}

export function toPdfErrorCode(error: unknown): ReportPdfErrorCode {
  return isReportPdfError(error) ? error.code : "pdf_generation_failed";
}

/** Sanitized Turkish message for any failure. */
export function toTurkishPdfMessage(error: unknown): string {
  return isReportPdfError(error)
    ? error.message
    : MESSAGES.pdf_generation_failed;
}

export function pdfErrorStatus(error: unknown): number {
  return isReportPdfError(error) ? error.status : 500;
}

/**
 * Logs the error code and short detail in development only. Never logs tokens,
 * cookies, URLs, executable paths or raw Supabase errors.
 */
export function logPdfDiagnostics(context: string, error: unknown): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  if (isReportPdfError(error)) {
    console.error(context, { code: error.code, detail: error.detail });
    return;
  }

  console.error(context, {
    code: "unexpected",
    detail: error instanceof Error ? error.name : typeof error,
  });
}
