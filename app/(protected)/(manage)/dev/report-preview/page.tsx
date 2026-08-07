import { notFound } from "next/navigation";

import { ContentGallery } from "@/components/report/content/content-gallery";
import { CreatorLeaderboard } from "@/components/report/content/creator-leaderboard";
import { FeaturedContentSection } from "@/components/report/content/featured-content-section";
import { ReportAnalyticsSection } from "@/components/report/report-analytics-section";
import { ReportFooter } from "@/components/report/report-footer";
import { ReportHeroSection } from "@/components/report/report-hero-section";
import { SoundGrowthSection } from "@/components/report/sound-growth-section";
import { dashboardData } from "@/lib/mock-data";

/**
 * Internal mock report preview formerly served at `/`.
 * Authenticated via (protected); hidden from production navigation.
 */
export default function DevReportPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

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
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-700/40 bg-amber-950/30 px-4 py-3">
        <p className="text-xs font-medium tracking-wide text-amber-200 uppercase">
          Geliştirme Önizlemesi
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Onaylı rapor bileşenlerinin mock veri ile önizlemesi. Üretimde
          kullanılamaz; canlı ve tarihsel rapor rotalarını etkilemez.
        </p>
      </div>

      <div className="min-h-screen rounded-xl border border-zinc-800 bg-[#09090B] font-sans">
        <div className="relative mx-auto max-w-[1360px] px-6 pt-10 min-[1100px]:px-12">
          <ReportHeroSection
            data={{
              campaign,
              totalReach,
              kpis,
              creators,
              videos,
              soundGrowth,
            }}
          />

          <ReportAnalyticsSection
            data={{ growth, trend, creators, kpis, videos, totalReach }}
          />

          <FeaturedContentSection
            video={topVideo ?? null}
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
    </div>
  );
}
