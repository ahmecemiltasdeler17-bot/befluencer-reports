import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import {
  GenerateReportButton,
  RetryReportButton,
} from "@/features/report-generation/components/generate-report-button";
import { ReportVersionList } from "@/features/report-generation/components/report-version-list";
import {
  getCampaignReportSeriesSummary,
  listReportVersions,
} from "@/features/report-generation/queries";
import { getCampaignById } from "@/features/campaigns/queries";
import { cn } from "@/lib/utils";

export default async function CampaignReportHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [campaign, versions, summary] = await Promise.all([
    getCampaignById(id),
    listReportVersions(id),
    getCampaignReportSeriesSummary(id),
  ]);

  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/campaigns/${id}#report`}
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            ← Kampanyaya dön
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            Rapor Geçmişi
          </h1>
          <p className="mt-1 text-sm text-zinc-400">{campaign.name}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/campaigns/${id}/report`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Canlı Raporu Aç
          </Link>
          <GenerateReportButton
            campaignId={id}
            hasSeries={summary.hasSeries}
            disabled={summary.hasGenerating}
          />
          {summary.hasFailed ? (
            <RetryReportButton
              campaignId={id}
              disabled={summary.hasGenerating}
            />
          ) : null}
        </div>
      </div>

      <ReportVersionList campaignId={id} versions={versions} />
    </div>
  );
}
