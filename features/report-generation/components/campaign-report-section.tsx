import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  GenerateReportButton,
  RetryReportButton,
} from "@/features/report-generation/components/generate-report-button";
import { ReportVersionMetadata } from "@/features/report-generation/components/report-version-metadata";
import type { CampaignReportSeriesSummary } from "@/features/report-generation/types";
import { cn } from "@/lib/utils";

export function CampaignReportSection({
  campaignId,
  summary,
}: {
  campaignId: string;
  summary: CampaignReportSeriesSummary;
}) {
  return (
    <section id="report" className="scroll-mt-24 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-white">Rapor</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Canlı rapor ve kalıcı sürüm yönetimi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/campaigns/${campaignId}/report`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Canlı Raporu Aç
          </Link>
          <Link
            href={`/campaigns/${campaignId}/reports`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Rapor Geçmişi
          </Link>
          <GenerateReportButton
            campaignId={campaignId}
            hasSeries={summary.hasSeries}
            disabled={summary.hasGenerating}
          />
          {summary.hasFailed ? (
            <RetryReportButton
              campaignId={campaignId}
              disabled={summary.hasGenerating}
            />
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <ReportVersionMetadata summary={summary} />
      </div>
    </section>
  );
}
