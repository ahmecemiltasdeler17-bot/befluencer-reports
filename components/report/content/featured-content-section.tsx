import { ReportSection } from "@/components/report/report-section";
import type { Creator, KpiMetric, Video } from "@/lib/types";

import { FeaturedContentMedia } from "./featured-content-media";
import { FeaturedContentMetrics } from "./featured-content-metrics";

interface FeaturedContentSectionProps {
  video: Video | null;
  creators: Creator[];
  kpis: KpiMetric[];
}

export function FeaturedContentSection({
  video,
  creators,
  kpis,
}: FeaturedContentSectionProps) {
  const campaignAverageEngagement =
    kpis.find((kpi) => kpi.id === "engagement-rate")?.value ?? 0;

  if (!video) {
    return (
      <ReportSection
        id="featured"
        eyebrow="Öne çıkan"
        title="Öne Çıkan İçerik"
        description="Kampanyada en yüksek erişime sahip video."
      >
        <p className="text-sm text-zinc-500">
          Öne çıkarılacak içerik için en az bir videoda metrik kaydı gerekli.
        </p>
      </ReportSection>
    );
  }

  const creator = creators.find((item) => item.handle === video.creatorHandle);

  return (
    <ReportSection
      id="featured"
      eyebrow="Öne çıkan"
      title="Öne Çıkan İçerik"
      description="Kampanyada en yüksek erişime sahip video."
    >
      <div className="grid grid-cols-1 items-center gap-10 min-[800px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] min-[800px]:gap-12">
        <FeaturedContentMedia video={video} />
        <FeaturedContentMetrics
          video={video}
          creator={creator}
          campaignAverageEngagement={campaignAverageEngagement}
        />
      </div>
    </ReportSection>
  );
}
