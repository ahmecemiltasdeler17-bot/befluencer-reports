import { Suspense } from "react";
import type { Metadata } from "next";

import { CampaignReportView } from "@/components/report/campaign-report-view";
import { ReportCanvas } from "@/components/report/report-canvas";
import { ReportPanelLink } from "@/components/report/report-panel-link";
import { getCampaignReportData } from "@/features/reports/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const report = await getCampaignReportData(id);
    return {
      title: `${report.campaign.name} — Canlı Rapor`,
    };
  } catch {
    return {
      title: "Canlı Rapor",
    };
  }
}

export default async function LiveCampaignReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getCampaignReportData(id);

  return (
    <ReportCanvas topSlot={<ReportPanelLink href={`/campaigns/${id}`} />}>
      <Suspense fallback={null}>
        <CampaignReportView report={report} presentationContext="live" />
      </Suspense>
    </ReportCanvas>
  );
}
