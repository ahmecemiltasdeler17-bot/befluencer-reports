import type { Creator, DashboardData } from "@/lib/types";

import { CreatorContributionList } from "./creator-contribution-list";
import { EngagementDistribution } from "./engagement-distribution";
import { PerformanceTrendSection } from "./performance-trend-section";

interface ReportAnalyticsSectionProps {
  data: Pick<
    DashboardData,
    "growth" | "trend" | "creators" | "kpis" | "videos" | "totalReach"
  >;
}

export function ReportAnalyticsSection({ data }: ReportAnalyticsSectionProps) {
  return (
    <div className="mt-24 w-full">
      <PerformanceTrendSection growth={data.growth} trend={data.trend} />

      <div className="mt-20 grid grid-cols-1 gap-16 min-[1000px]:grid-cols-[minmax(0,65%)_minmax(0,35%)] min-[1000px]:gap-12">
        <CreatorContributionList
          creators={data.creators}
          totalReach={data.totalReach.value}
        />
        <EngagementDistribution videos={data.videos} kpis={data.kpis} />
      </div>
    </div>
  );
}
