import type { Creator, KpiMetric, Video } from "@/lib/types";

import { FeaturedContentMedia } from "./featured-content-media";
import { FeaturedContentMetrics } from "./featured-content-metrics";

interface FeaturedContentSectionProps {
  video: Video;
  creators: Creator[];
  kpis: KpiMetric[];
}

export function FeaturedContentSection({
  video,
  creators,
  kpis,
}: FeaturedContentSectionProps) {
  const creator = creators.find(
    (item) => item.handle === video.creatorHandle
  );
  const campaignAverageEngagement =
    kpis.find((kpi) => kpi.id === "engagement-rate")?.value ?? 7.2;

  return (
    <section
      aria-label="Öne çıkan içerik"
      className="mt-24 border-y border-white/[0.06] py-16"
    >
      <h2 className="text-[28px] font-semibold tracking-tight text-white min-[1100px]:text-[32px]">
        Öne Çıkan İçerik
      </h2>

      <div className="mt-10 grid grid-cols-1 items-center gap-10 min-[800px]:grid-cols-[35%_65%] min-[800px]:gap-12">
        <FeaturedContentMedia video={video} />
        <FeaturedContentMetrics
          video={video}
          creator={creator}
          campaignAverageEngagement={campaignAverageEngagement}
        />
      </div>
    </section>
  );
}
