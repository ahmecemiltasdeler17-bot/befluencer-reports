import { CREATOR_CATEGORY_LABELS } from "@/lib/content-helpers";
import type { CreatorCategory, Video } from "@/lib/types";

import { TikTokContentCard } from "./tiktok-content-card";

interface ContentCategoryGroupProps {
  category: CreatorCategory;
  videos: Video[];
  campaignAverageEngagement: number;
}

export function ContentCategoryGroup({
  category,
  videos,
  campaignAverageEngagement,
}: ContentCategoryGroupProps) {
  if (videos.length === 0) return null;

  return (
    <div className="space-y-6">
      <h3 className="text-[11px] font-semibold tracking-[0.24em] text-[#FF5A00] uppercase">
        {CREATOR_CATEGORY_LABELS[category]}
      </h3>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,280px))] justify-start gap-4 min-[800px]:gap-5">
        {videos.map((video) => (
          <TikTokContentCard
            key={video.id}
            video={video}
            campaignAverageEngagement={campaignAverageEngagement}
          />
        ))}
      </div>
    </div>
  );
}
