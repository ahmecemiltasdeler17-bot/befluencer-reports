import { Suspense } from "react";

import { ContentGallery } from "@/components/report/content/content-gallery";
import { CreatorLeaderboard } from "@/components/report/content/creator-leaderboard";
import { FeaturedContentSection } from "@/components/report/content/featured-content-section";
import { ReportAnalyticsSection } from "@/components/report/report-analytics-section";
import { ReportFooter } from "@/components/report/report-footer";
import { ReportHeroSection } from "@/components/report/report-hero-section";
import type { ReportPresentationContext } from "@/components/report/report-presentation";
import { ReportWatermark } from "@/components/report/report-watermark";
import { SoundGrowthSection } from "@/components/report/sound-growth-section";
import type { CampaignReportData } from "@/features/reports/types";
import type { ReportFreshness } from "@/features/reports/types";
import { formatTurkishDate } from "@/lib/format";

export function CampaignReportView({
  report,
  reportNumber,
  reportDate,
  freshness,
  persistGallerySortInUrl = true,
  versionLabel,
  presentationContext,
}: {
  report: CampaignReportData;
  reportNumber?: string;
  reportDate?: string;
  freshness?: ReportFreshness;
  persistGallerySortInUrl?: boolean;
  versionLabel?: string;
  presentationContext?: ReportPresentationContext;
}) {
  const resolvedNumber = reportNumber ?? report.metadata.reportNumber;
  const resolvedDate = reportDate ?? report.metadata.reportDate;
  const resolvedFreshness = freshness ?? report.metadata.freshness;

  return (
    <div className="report-surface relative isolate">
      <ReportWatermark />

      <div className="report-surface__content relative z-[1]">
        <ReportHeroSection
          data={{
            campaign: report.campaign,
            totalReach: report.totalReach,
            kpis: report.kpis,
            creators: report.creators,
            videos: report.videos,
            soundGrowth: report.soundGrowth,
          }}
          reportNumber={resolvedNumber}
          reportDate={resolvedDate}
          freshness={resolvedFreshness}
          presentationContext={presentationContext}
          versionLabel={versionLabel}
        />

        <ReportAnalyticsSection
          data={{
            growth: report.growth,
            trend: report.trend,
            creators: report.creators,
            kpis: report.kpis,
            videos: report.videos,
            totalReach: report.totalReach,
          }}
          hasTimeline={report.hasTimeline}
        />

        <FeaturedContentSection
          video={report.featuredVideo}
          creators={report.creators}
          kpis={report.kpis}
        />

        <CreatorLeaderboard
          creators={report.creators}
          totalReach={report.totalReach.value}
        />

        <Suspense fallback={null}>
          <ContentGallery
            videos={report.videos}
            kpis={report.kpis}
            persistSortInUrl={persistGallerySortInUrl}
          />
        </Suspense>

        <SoundGrowthSection
          data={report.soundGrowth}
          hasTimeline={report.hasSoundTimeline}
        />

        <ReportFooter
          reportNumber={resolvedNumber}
          reportDate={resolvedDate}
          lastUpdated={
            presentationContext === "live" &&
            resolvedFreshness.lastSuccessfulSyncAt
              ? formatTurkishDate(resolvedFreshness.lastSuccessfulSyncAt)
              : undefined
          }
        />
      </div>
    </div>
  );
}
