import { CREATOR_CATEGORY_LABELS } from "@/lib/content-helpers";
import type { CreatorCategory, Video } from "@/lib/types";

import { ContentRail } from "./content-rail";
import { TikTokContentCard } from "./tiktok-content-card";

interface ContentCategoryGroupProps {
  category: CreatorCategory;
  videos: Video[];
  campaignAverageEngagement: number;
}

/**
 * One category = one horizontal catalog rail. Card order mirrors the active
 * gallery sort; the rail never filters or truncates the category.
 */
export function ContentCategoryGroup({
  category,
  videos,
  campaignAverageEngagement,
}: ContentCategoryGroupProps) {
  if (videos.length === 0) return null;

  const label = CREATOR_CATEGORY_LABELS[category];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[11px] font-semibold tracking-[0.16em] text-[var(--report-accent)] uppercase">
          {label}
        </h3>
        <span className="shrink-0 text-[11px] text-[var(--report-text-tertiary)] tabular-nums">
          {videos.length} içerik
        </span>
      </div>

      <ContentRail label={label}>
        {videos.map((video) => (
          <TikTokContentCard
            key={video.id}
            video={video}
            campaignAverageEngagement={campaignAverageEngagement}
          />
        ))}
      </ContentRail>
    </div>
  );
}
