import type { Metadata } from "next";

import { CampaignReportView } from "@/components/report/campaign-report-view";
import { PublicAccessBeacon } from "@/features/public-reports/components/public-access-beacon";
import { PublicPdfDownloadButton } from "@/features/public-reports/components/public-pdf-download-button";
import { PublicReportFooter } from "@/features/public-reports/components/public-report-footer";
import { PublicReportHeader } from "@/features/public-reports/components/public-report-header";
import { PublicShareUnavailable } from "@/features/public-reports/components/public-share-unavailable";
import { resolvePublicReportShare } from "@/features/public-reports/queries";
import {
  buildPublicShareUrl,
  isRawShareToken,
  normalizeRouteShareToken,
} from "@/features/public-reports/token";
import { parseSnapshotForRendering } from "@/features/report-generation/services/deserialize-report-snapshot";
import { getPublicReportOrigin } from "@/lib/origins";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Metadata must not call resolve/consume (no access increment).
 * Canonical uses PUBLIC_REPORT_URL; robots stay noindex.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token: routeToken } = await params;
  const token = normalizeRouteShareToken(routeToken);

  const metadata: Metadata = {
    title: "Paylaşılan Rapor",
    robots: {
      index: false,
      follow: false,
      nocache: true,
      noarchive: true,
    },
  };

  if (isRawShareToken(token)) {
    try {
      metadata.alternates = {
        canonical: buildPublicShareUrl(getPublicReportOrigin(), token),
      };
    } catch {
      // Origin misconfiguration — omit canonical rather than failing the page.
    }
  }

  return metadata;
}

export default async function PublicSharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: routeToken } = await params;
  const token = normalizeRouteShareToken(routeToken);

  if (!isRawShareToken(token)) {
    return <PublicShareUnavailable />;
  }

  const payload = await resolvePublicReportShare(token);

  if (!payload) {
    return <PublicShareUnavailable />;
  }

  let report;

  try {
    report = parseSnapshotForRendering(payload.snapshot);
  } catch {
    return <PublicShareUnavailable />;
  }

  const reportNumber =
    payload.reportNumber ?? report.metadata.reportNumber ?? null;

  return (
    <div className="min-h-screen bg-[#09090B] font-sans">
      <PublicAccessBeacon />
      <div className="relative mx-auto max-w-[1360px] px-6 pt-10 min-[1100px]:px-12">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <PublicReportHeader
              campaignName={payload.campaignName}
              versionNumber={payload.versionNumber}
              generatedAt={payload.generatedAt}
              archived={payload.status === "archived"}
            />
          </div>
          {payload.allowPdfDownload ? (
            <PublicPdfDownloadButton versionNumber={payload.versionNumber} />
          ) : null}
        </div>

        <CampaignReportView
          report={report}
          reportNumber={reportNumber}
          reportDate={report.metadata.reportDate}
          freshness={report.metadata.freshness}
          persistGallerySortInUrl={false}
          presentationContext="public"
          versionLabel={`Sürüm v${payload.versionNumber}`}
        />

        <PublicReportFooter
          reportNumber={reportNumber}
          versionNumber={payload.versionNumber}
        />
      </div>
    </div>
  );
}
