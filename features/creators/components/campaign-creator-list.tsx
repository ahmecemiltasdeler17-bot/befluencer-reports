import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { buildCampaignAudienceSummary } from "@/features/creator-sync/calculations";
import type { CreatorSyncSummary } from "@/features/creator-sync/types";
import { CampaignCreatorRow } from "@/features/creators/components/campaign-creator-row";
import { CreatorEmptyState } from "@/features/creators/components/creator-empty-state";
import type { CampaignCreatorWithCreator } from "@/features/creators/types";
import { MetricDelta } from "@/features/metrics/components/metric-delta";
import { CompactCountText } from "@/components/format/compact-count-text";
import { cn } from "@/lib/utils";

type CampaignCreatorListProps = {
  campaignId: string;
  assignments: CampaignCreatorWithCreator[];
  /** Sync state per creator, keyed by creator id. */
  syncSummaries?: CreatorSyncSummary[];
  syncConfigured?: boolean;
  /** Campaign-level bulk sync control, rendered next to the add action. */
  syncAction?: React.ReactNode;
};

export function CampaignCreatorList({
  campaignId,
  assignments,
  syncSummaries = [],
  syncConfigured = false,
  syncAction,
}: CampaignCreatorListProps) {
  const creatorCount = assignments.length;
  const summaryByCreator = new Map(
    syncSummaries.map((summary) => [summary.creatorId, summary])
  );

  // Deduplicated so a creator assigned twice is counted once in the audience.
  const audience = buildCampaignAudienceSummary(
    assignments.map((item) => {
      const summary = summaryByCreator.get(item.creator_id);

      return {
        creatorId: item.creator_id,
        currentFollowers:
          summary?.currentFollowers ?? item.creator.follower_count,
        initialFollowers:
          summary?.absoluteGrowth === null || summary?.absoluteGrowth === undefined
            ? null
            : summary.currentFollowers - summary.absoluteGrowth,
      };
    })
  );

  const totalAgreedContent = assignments.reduce(
    (sum, item) => sum + item.agreed_content_count,
    0
  );

  return (
    <section id="creators" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-bf-text">İçerik Üreticileri</h2>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-bf-steel">
            <span>{creatorCount} içerik üreticisi</span>
            <span>
              <CompactCountText
                value={audience.currentAudience}
                variant="management"
                showNoun
              />
            </span>
            {audience.audienceGrowth !== 0 ? (
              <MetricDelta
                value={audience.audienceGrowth}
                percentage={audience.growthPercentage}
              />
            ) : null}
            <span>{totalAgreedContent} anlaşılan içerik</span>
          </div>
        </div>
        {creatorCount > 0 ? (
          <div className="flex flex-wrap items-start gap-2">
            {syncAction}
            <Link
              href={`/campaigns/${campaignId}/creators/add`}
              className={cn(buttonVariants({ variant: "default" }))}
            >
              İçerik Üreticisi Ekle
            </Link>
          </div>
        ) : null}
      </div>

      {creatorCount === 0 ? (
        <CreatorEmptyState campaignId={campaignId} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-bf-border">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-bf-border text-sm">
              <thead className="bg-bf-surface">
                <tr className="text-left text-bf-steel">
                  <th className="px-4 py-2.5 font-medium">İçerik Üreticisi</th>
                  <th className="px-4 py-2.5 font-medium">Platform</th>
                  <th className="px-4 py-2.5 font-medium">Kategori</th>
                  <th className="px-4 py-2.5 font-medium">Takipçi</th>
                  <th className="px-4 py-2.5 font-medium">Büyüme</th>
                  <th className="px-4 py-2.5 font-medium">Senkronizasyon</th>
                  <th className="px-4 py-2.5 font-medium">İçerik</th>
                  <th className="px-4 py-2.5 font-medium">Ücret</th>
                  <th className="px-4 py-2.5 font-medium">Not</th>
                  <th className="px-4 py-2.5 font-medium text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bf-border/80 bg-bf-bg/40">
                {assignments.map((assignment) => (
                  <CampaignCreatorRow
                    key={assignment.id}
                    assignment={assignment}
                    campaignId={campaignId}
                    syncSummary={summaryByCreator.get(assignment.creator_id)}
                    syncConfigured={syncConfigured}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
