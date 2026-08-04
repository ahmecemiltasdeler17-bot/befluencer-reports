"use client";

import { useMemo, useState } from "react";

import { CREATOR_CATEGORY_LABELS } from "@/lib/content-helpers";
import type { CreatorCategory, KpiMetric, Video } from "@/lib/types";

import { ContentCategoryGroup } from "./content-category-group";

type SortOption = "views" | "engagement" | "date";

const SORT_LABELS: Record<SortOption, string> = {
  views: "İzlenme",
  engagement: "Etkileşim Oranı",
  date: "Yayın Tarihi",
};

const CATEGORY_ORDER: CreatorCategory[] = ["macro", "micro", "template"];

interface ContentGalleryProps {
  videos: Video[];
  kpis: KpiMetric[];
}

function sortVideos(videos: Video[], sortBy: SortOption): Video[] {
  const sorted = [...videos];

  switch (sortBy) {
    case "engagement":
      return sorted.sort((a, b) => b.engagementRate - a.engagementRate);
    case "date":
      return sorted.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    default:
      return sorted.sort((a, b) => b.views - a.views);
  }
}

export function ContentGallery({ videos, kpis }: ContentGalleryProps) {
  const [sortBy, setSortBy] = useState<SortOption>("views");
  const campaignAverageEngagement =
    kpis.find((kpi) => kpi.id === "engagement-rate")?.value ?? 7.2;

  const sortedVideos = useMemo(
    () => sortVideos(videos, sortBy),
    [videos, sortBy]
  );

  const groupedVideos = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      videos: sortedVideos.filter((video) => video.category === category),
    }));
  }, [sortedVideos]);

  return (
    <section aria-label="Tüm içerikler" className="mt-24 pb-16">
      <div className="flex flex-col gap-4 min-[800px]:flex-row min-[800px]:items-end min-[800px]:justify-between">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight text-white min-[1100px]:text-[32px]">
            Paylaşım Yapmış İçerik Üreticileri
          </h2>
          <p className="mt-2 text-base text-zinc-400">
            {videos.length} içerik ·{" "}
            {Object.values(CREATOR_CATEGORY_LABELS).length} kategori
          </p>
        </div>

        <label className="flex items-center gap-3 text-sm text-zinc-400">
          <span className="text-[10px] tracking-[0.18em] uppercase">
            Sırala
          </span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <option
                key={option}
                value={option}
                className="bg-[#09090B] text-white"
              >
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-12 space-y-14">
        {groupedVideos.map(({ category, videos: categoryVideos }) => (
          <ContentCategoryGroup
            key={category}
            category={category}
            videos={categoryVideos}
            campaignAverageEngagement={campaignAverageEngagement}
          />
        ))}
      </div>
    </section>
  );
}
