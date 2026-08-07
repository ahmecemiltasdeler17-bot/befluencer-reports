import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CampaignReportView } from "@/components/report/campaign-report-view";
import { HistoricalReportNav } from "@/components/report/historical-report-nav";
import { ShareManagementPanel } from "@/features/public-reports/components/share-management-panel";
import { parseSnapshotForRendering } from "@/features/report-generation/services/deserialize-report-snapshot";
import { getReportVersionById } from "@/features/report-generation/queries";
import { getCampaignById } from "@/features/campaigns/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}): Promise<Metadata> {
  const { id, versionId } = await params;
  const [campaign, version] = await Promise.all([
    getCampaignById(id),
    getReportVersionById(versionId),
  ]);

  if (!campaign || !version) {
    return { title: "Rapor Sürümü" };
  }

  return {
    title: `${campaign.name} — Rapor v${version.version_number}`,
  };
}

export default async function HistoricalReportVersionPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  const { id, versionId } = await params;
  const version = await getReportVersionById(versionId);

  if (!version || version.campaign_id !== id) {
    notFound();
  }

  if (version.status === "generating") {
    return (
      <div className="min-h-screen bg-[#09090B] font-sans">
        <div className="relative mx-auto max-w-[1360px] px-6 py-24 text-center min-[1100px]:px-12">
          <HistoricalReportNav
            campaignId={id}
            versionNumber={version.version_number}
          />
          <h1 className="text-2xl font-semibold text-white">
            Rapor hazırlanıyor
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            Sürüm v{version.version_number} oluşturuluyor. Lütfen kısa süre
            sonra tekrar deneyin.
          </p>
        </div>
      </div>
    );
  }

  if (version.status === "failed") {
    return (
      <div className="min-h-screen bg-[#09090B] font-sans">
        <div className="relative mx-auto max-w-[1360px] px-6 py-24 text-center min-[1100px]:px-12">
          <HistoricalReportNav
            campaignId={id}
            versionNumber={version.version_number}
          />
          <h1 className="text-2xl font-semibold text-white">
            Rapor oluşturulamadı
          </h1>
          <p className="mt-3 text-sm text-red-400">
            {version.error_message ?? "Bilinmeyen bir hata oluştu."}
          </p>
          <Link
            href={`/campaigns/${id}/reports`}
            className="mt-6 inline-block text-sm text-orange-400 hover:text-orange-300"
          >
            Rapor geçmişine dön
          </Link>
        </div>
      </div>
    );
  }

  let report;

  try {
    report = parseSnapshotForRendering(version.snapshot);
  } catch {
    return (
      <div className="min-h-screen bg-[#09090B] font-sans">
        <div className="relative mx-auto max-w-[1360px] px-6 py-24 text-center min-[1100px]:px-12">
          <HistoricalReportNav
            campaignId={id}
            versionNumber={version.version_number}
            archived={version.status === "archived"}
          />
          <h1 className="text-2xl font-semibold text-white">
            Rapor anlık görüntüsü geçersiz
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            Bu sürüm okunamıyor. Canlı rapor verileri kullanılmadı.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] font-sans">
      <div className="relative mx-auto max-w-[1360px] px-6 pt-10 min-[1100px]:px-12">
        <HistoricalReportNav
          campaignId={id}
          versionId={version.id}
          versionNumber={version.version_number}
          status={version.status}
          archived={version.status === "archived"}
        />
        <div id="shares" className="mb-6 max-w-3xl print:hidden">
          <ShareManagementPanel
            reportVersionId={version.id}
            status={version.status}
          />
        </div>
        <CampaignReportView
          report={report}
          reportNumber={report.metadata.reportNumber}
          reportDate={report.metadata.reportDate}
          freshness={report.metadata.freshness}
          persistGallerySortInUrl={false}
          presentationContext={
            version.status === "archived" ? "archived" : "historical"
          }
          versionLabel={`Sürüm v${version.version_number}`}
        />
      </div>
    </div>
  );
}
