import { NextResponse } from "next/server";

import { PDF_TOTAL_TIMEOUT_MS } from "@/features/pdf/constants";
import {
  ReportPdfError,
  logPdfDiagnostics,
  pdfErrorStatus,
  toTurkishPdfMessage,
} from "@/features/pdf/errors";
import { buildPrintUrl, getAppOrigin } from "@/features/pdf/origin";
import {
  createReportExportToken,
  getReportVersionForExport,
} from "@/features/pdf/queries";
import {
  buildContentDisposition,
  buildReportPdfFilename,
} from "@/features/pdf/services/build-report-pdf-filename";
import { generateReportPdf } from "@/features/pdf/services/generate-report-pdf";

/** Chromium cannot run on the Edge runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new ReportPdfError("print_route_timeout", "Total timeout")),
        ms
      );
    }),
  ]);
}

function errorResponse(error: unknown) {
  logPdfDiagnostics("Report PDF export failed", error);

  return NextResponse.json(
    { error: toTurkishPdfMessage(error) },
    {
      status: pdfErrorStatus(error),
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}

/**
 * Generates a PDF for one immutable report version.
 *
 * POST only — generation has side effects (it issues a single-use token) and
 * must never be triggered by a prefetch or a cached GET.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;

  try {
    const appOrigin = getAppOrigin();

    // Authenticated lookup under RLS. Confirms the version belongs to this
    // campaign and is ready or archived before anything else happens.
    const { target } = await getReportVersionForExport(id, versionId);

    const { token } = await createReportExportToken(target.reportVersionId);

    const printUrl = buildPrintUrl({
      appOrigin,
      campaignId: target.campaignId,
      reportVersionId: target.reportVersionId,
      token,
    });

    const pdf = await withTimeout(
      generateReportPdf({ printUrl, appOrigin }),
      PDF_TOTAL_TIMEOUT_MS
    );

    const filename = buildReportPdfFilename({
      campaignName: target.campaignName,
      reportNumber: target.reportNumber,
      versionNumber: target.versionNumber,
    });

    return new NextResponse(pdf.bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildContentDisposition(filename),
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
