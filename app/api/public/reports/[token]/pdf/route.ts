import { NextResponse } from "next/server";

import { PDF_TOTAL_TIMEOUT_MS } from "@/features/pdf/constants";
import {
  ReportPdfError,
  logPdfDiagnostics,
  toTurkishPdfMessage,
} from "@/features/pdf/errors";
import { buildPrintUrl, getAppOrigin } from "@/features/pdf/origin";
import {
  buildContentDisposition,
  buildReportPdfFilename,
} from "@/features/pdf/services/build-report-pdf-filename";
import {
  buildTokenExpiry,
  generateRawExportToken,
  hashExportToken,
} from "@/features/pdf/services/export-token";
import { generateReportPdf } from "@/features/pdf/services/generate-report-pdf";
import {
  PUBLIC_SHARE_UNAVAILABLE_MESSAGE,
  PublicReportShareError,
  logPublicShareDiagnostics,
  toPublicShareMessage,
} from "@/features/public-reports/errors";
import { consumePublicRateLimit } from "@/features/public-reports/rate-limit";
import {
  consumePublicReportPdfShare,
  issuePublicReportPrintToken,
} from "@/features/public-reports/queries";
import { isRawShareToken } from "@/features/public-reports/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(new PublicReportShareError("pdf_timeout", "Total timeout")),
        ms
      );
    }),
  ]);
}

function errorResponse(error: unknown, pdfDisabled = false) {
  logPublicShareDiagnostics("Public PDF export failed", error);
  logPdfDiagnostics("Public report PDF export failed", error);

  if (
    pdfDisabled ||
    (error instanceof PublicReportShareError && error.code === "pdf_disabled")
  ) {
    return NextResponse.json(
      { error: "Bu paylaşım için PDF indirme kapalı." },
      { status: 403, headers: NO_STORE }
    );
  }

  if (error instanceof ReportPdfError) {
    return NextResponse.json(
      { error: toTurkishPdfMessage(error) },
      {
        status: error.status >= 500 ? error.status : 404,
        headers: NO_STORE,
      }
    );
  }

  if (
    error instanceof PublicReportShareError &&
    (error.code === "pdf_timeout" ||
      error.code === "browser_failure" ||
      error.code === "rate_limited" ||
      error.code === "app_origin_invalid")
  ) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    { error: toPublicShareMessage(error) },
    { status: 404, headers: NO_STORE }
  );
}

/**
 * Public PDF for one immutable shared report version.
 *
 * 1. Consume share once (increments access_count; requires allow_pdf_download)
 * 2. Issue short-lived report_export_tokens row (no second share increment)
 * 3. Puppeteer loads the internal print route on APP_URL with that one-time
 *    export token only — the public share raw token never crosses to APP_URL
 *
 * Public API is served on PUBLIC_REPORT_URL in production; print rendering
 * stays on the internal application origin (APP_URL).
 *
 * Never logs the raw public share token.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!isRawShareToken(token)) {
    return NextResponse.json(
      { error: PUBLIC_SHARE_UNAVAILABLE_MESSAGE },
      { status: 404, headers: NO_STORE }
    );
  }

  const limited = consumePublicRateLimit(`pdf:${token.slice(0, 16)}`, 5);

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin." },
      {
        status: 429,
        headers: {
          ...NO_STORE,
          "Retry-After": String(limited.retryAfterSeconds),
        },
      }
    );
  }

  try {
    const appOrigin = getAppOrigin();

    // First peek via resolve is not used — PDF consume both validates PDF
    // permission and increments. Empty result covers revoked/expired/disabled
    // without revealing which.
    const payload = await consumePublicReportPdfShare(token);

    if (!payload) {
      // Distinguish PDF-disabled for a still-valid share by resolving once.
      // resolve does not increment. If resolve works but PDF consume failed,
      // PDF is disabled or version unavailable after race.
      const { resolvePublicReportShare } = await import(
        "@/features/public-reports/queries"
      );
      const resolved = await resolvePublicReportShare(token);

      if (resolved && !resolved.allowPdfDownload) {
        return errorResponse(
          new PublicReportShareError("pdf_disabled"),
          true
        );
      }

      return NextResponse.json(
        { error: PUBLIC_SHARE_UNAVAILABLE_MESSAGE },
        { status: 404, headers: NO_STORE }
      );
    }

    const rawExportToken = generateRawExportToken();
    const expiresAt = buildTokenExpiry(new Date());
    const printTokenId = await issuePublicReportPrintToken(
      token,
      hashExportToken(rawExportToken),
      expiresAt
    );

    if (!printTokenId) {
      throw new PublicReportShareError(
        "database_failure",
        "print token issue failed"
      );
    }

    const printUrl = buildPrintUrl({
      appOrigin,
      campaignId: payload.campaignId,
      reportVersionId: payload.reportVersionId,
      token: rawExportToken,
    });

    const pdf = await withTimeout(
      generateReportPdf({ printUrl, appOrigin }),
      PDF_TOTAL_TIMEOUT_MS
    );

    const filename = buildReportPdfFilename({
      campaignName: payload.campaignName,
      reportNumber: payload.reportNumber,
      versionNumber: payload.versionNumber,
    });

    return new NextResponse(pdf.bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildContentDisposition(filename),
        "Content-Length": String(pdf.byteLength),
        ...NO_STORE,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
