import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CampaignReportView } from "@/components/report/campaign-report-view";
import { HistoricalReportNav } from "@/components/report/historical-report-nav";
import { ReportCanvas } from "@/components/report/report-canvas";
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
      <ReportCanvas innerClassName="py-24 text-center">
        <HistoricalReportNav
          campaignId={id}
          versionNumber={version.version_number}
        />
        <h1 className="text-2xl font-semibold text-white">
          Rapor hazırlanıyor
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          Sürüm v{version.version_number} oluşturuluyor. Lütfen kısa süre sonra
          tekrar deneyin.
        </p>
      </ReportCanvas>
    );
  }

  if (version.status === "failed") {
    return (
      <ReportCanvas innerClassName="py-24 text-center">
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
          className="mt-6 inline-block text-sm text-primary hover:text-[var(--bf-accent-soft)]"
        >
          Rapor geçmişine dön
        </Link>
      </ReportCanvas>
    );
  }

  let report;

  try {
    report = parseSnapshotForRendering(version.snapshot);
  } catch {
    return (
      <ReportCanvas innerClassName="py-24 text-center">
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
      </ReportCanvas>
    );
  }

  return (
    <ReportCanvas
      topSlot={
        <>
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
        </>
      }
    >
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
    </ReportCanvas>
  );
}
