import { ContentGallery } from "@/components/report/content/content-gallery";
import { CreatorLeaderboard } from "@/components/report/content/creator-leaderboard";
import { FeaturedContentSection } from "@/components/report/content/featured-content-section";
import { ReportAnalyticsSection } from "@/components/report/report-analytics-section";
import { ReportFooter } from "@/components/report/report-footer";
import { ReportHeroSection } from "@/components/report/report-hero-section";
import { SoundGrowthSection } from "@/components/report/sound-growth-section";
import { dashboardData } from "@/lib/mock-data";

export default function DashboardPage() {
  const {
    campaign,
    totalReach,
    kpis,
    trend,
    growth,
    topVideo,
    creators,
    videos,
    soundGrowth,
  } = dashboardData;

  return (
    <div className="min-h-screen bg-[#09090B] font-sans">
      <div className="mx-auto max-w-[1360px] px-6 pt-10 min-[1100px]:px-12">
        <ReportHeroSection
          data={{ campaign, totalReach, kpis, creators, videos }}
        />

        <ReportAnalyticsSection
          data={{ growth, trend, creators, kpis, videos, totalReach }}
        />

        <FeaturedContentSection
          video={topVideo}
          creators={creators}
          kpis={kpis}
        />

        <CreatorLeaderboard
          creators={creators}
          totalReach={totalReach.value}
        />

        <ContentGallery videos={videos} kpis={kpis} />

        <SoundGrowthSection data={soundGrowth} />

        <ReportFooter />
      </div>
    </div>
  );
}
