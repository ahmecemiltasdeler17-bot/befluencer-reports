import { ReportSection } from "@/components/report/report-section";
import type { DashboardData } from "@/lib/types";

import { CreatorContributionList } from "./creator-contribution-list";
import { EngagementDistribution } from "./engagement-distribution";
import { PerformanceTrendSection } from "./performance-trend-section";

interface ReportAnalyticsSectionProps {
  data: Pick<
    DashboardData,
    "growth" | "trend" | "creators" | "kpis" | "videos" | "totalReach"
  >;
  hasTimeline?: boolean;
}

export function ReportAnalyticsSection({
  data,
  hasTimeline = true,
}: ReportAnalyticsSectionProps) {
  return (
    <div className="w-full">
      <ReportSection
        id="performance"
        eyebrow="Performans"
        title="Performans Trendi"
        description="Kampanya başlangıcından itibaren kümülatif izlenme."
      >
        <PerformanceTrendSection
          growth={data.growth}
          trend={data.trend}
          hasTimeline={hasTimeline}
          hideHeading
        />
      </ReportSection>

      <ReportSection
        id="distribution"
        eyebrow="Dağılım"
        title="Erişim ve Etkileşim"
        description="İçerik üreticisi katkıları ile etkileşim bileşenlerinin dağılımı."
        contentClassName="mt-6"
      >
        {/* Below ~1180px the donut column becomes too narrow for its legend,
            so the two blocks stack instead of squeezing. */}
        <div className="grid grid-cols-1 gap-12 min-[1180px]:grid-cols-[minmax(0,62%)_minmax(0,38%)] min-[1180px]:gap-10">
          <CreatorContributionList
            creators={data.creators}
            totalReach={data.totalReach.value}
          />
          <EngagementDistribution videos={data.videos} kpis={data.kpis} />
        </div>
      </ReportSection>
    </div>
  );
}
