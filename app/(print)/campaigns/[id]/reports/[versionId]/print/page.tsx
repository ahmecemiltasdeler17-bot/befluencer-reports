import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampaignReportView } from "@/components/report/campaign-report-view";
import { ReportPrintFooter } from "@/components/report/report-print-footer";
import { PdfReadyMarker } from "@/features/pdf/components/pdf-ready-marker";
import { isRawExportToken } from "@/features/pdf/origin";
import {
  consumeReportExportToken,
  getPrintPayloadForSession,
} from "@/features/pdf/queries";
import type { PrintReportPayload } from "@/features/pdf/types";

/** Token consumption mutates state, so this route can never be cached. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Rapor PDF Görünümü",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Internal print layout for a single immutable report version.
 *
 * Access requires either an authenticated session (human preview) or a valid
 * single-use export token (headless browser). It is never publicly reachable.
 *
 * Data comes only from `report_versions.snapshot` — no live campaign, creator,
 * video, metric or sound table is queried, and no value is recalculated.
 */
export default async function ReportVersionPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; versionId: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { id, versionId } = await params;
  const { token } = await searchParams;

  const rawToken = Array.isArray(token) ? token[0] : token;

  let payload: PrintReportPayload | null = null;

  if (typeof rawToken === "string" && isRawExportToken(rawToken)) {
    payload = await consumeReportExportToken(rawToken);

    // The token must match both the campaign and the version in the URL.
    if (
      payload &&
      (payload.campaignId !== id || payload.reportVersionId !== versionId)
    ) {
      payload = null;
    }
  } else {
    payload = await getPrintPayloadForSession(id, versionId);
  }

  if (!payload) {
    notFound();
  }

  const { report } = payload;
  const title = `${payload.campaignName} — TikTok Müzik Kampanya Raporu`;

  return (
    <div className="pdf-document min-h-screen bg-[#09090B] font-sans">
      <div className="pdf-canvas mx-auto max-w-[1360px] px-10 pt-8">
        <p className="pdf-avoid-break mb-6 text-center text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
          {payload.status === "archived"
            ? `Arşivlenmiş rapor sürümü v${payload.versionNumber}`
            : `Rapor sürümü v${payload.versionNumber}`}
        </p>

        <CampaignReportView
          report={report}
          reportNumber={payload.reportNumber}
          reportDate={report.metadata.reportDate}
          freshness={report.metadata.freshness}
          persistGallerySortInUrl={false}
          presentationContext={
            payload.status === "archived" ? "archived" : "historical"
          }
          versionLabel={`Sürüm v${payload.versionNumber}`}
        />

        <ReportPrintFooter
          title={title}
          reportNumber={payload.reportNumber}
          versionNumber={payload.versionNumber}
          generatedAt={payload.generatedAt}
          archived={payload.status === "archived"}
        />
      </div>

      <PdfReadyMarker />
    </div>
  );
}
