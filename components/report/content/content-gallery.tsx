"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ReportSection } from "@/components/report/report-section";
import type { CreatorCategory, KpiMetric, Video } from "@/lib/types";

import { ContentCategoryGroup } from "./content-category-group";

type SortOption = "views" | "engagement" | "published";

const SORT_LABELS: Record<SortOption, string> = {
  views: "İzlenme",
  engagement: "Etkileşim Oranı",
  published: "Yayın Tarihi",
};

const SORT_PARAM_MAP: Record<SortOption, string> = {
  views: "views",
  engagement: "engagement",
  published: "date",
};

const CATEGORY_ORDER: CreatorCategory[] = [
  "mega",
  "macro",
  "micro",
  "nano",
  "template",
  "uncategorized",
];

interface ContentGalleryProps {
  videos: Video[];
  kpis: KpiMetric[];
  initialSort?: SortOption;
  persistSortInUrl?: boolean;
}

function parseSortParam(value: string | null): SortOption {
  if (value === "engagement" || value === "published" || value === "date") {
    return value === "date" ? "published" : value;
  }

  return "views";
}

function sortVideos(videos: Video[], sortBy: SortOption): Video[] {
  const sorted = [...videos];

  sorted.sort((left, right) => {
    const leftHasMetrics = left.hasMetrics !== false;
    const rightHasMetrics = right.hasMetrics !== false;

    if (leftHasMetrics !== rightHasMetrics) {
      return leftHasMetrics ? -1 : 1;
    }

    switch (sortBy) {
      case "engagement":
        return right.engagementRate - left.engagementRate;
      case "published":
        return (
          new Date(right.publishedAt).getTime() -
          new Date(left.publishedAt).getTime()
        );
      default:
        return right.views - left.views;
    }
  });

  return sorted;
}

export function ContentGallery({
  videos,
  kpis,
  initialSort = "views",
  persistSortInUrl = true,
}: ContentGalleryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localSort, setLocalSort] = useState<SortOption>(initialSort);
  const sortBy = persistSortInUrl
    ? parseSortParam(searchParams.get("sort") ?? initialSort)
    : localSort;
  const campaignAverageEngagement =
    kpis.find((kpi) => kpi.id === "engagement-rate")?.value ?? 0;

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

  function handleSortChange(nextSort: SortOption) {
    if (persistSortInUrl) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", SORT_PARAM_MAP[nextSort]);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }

    setLocalSort(nextSort);
  }

  const populatedCategories = groupedVideos.filter(
    (group) => group.videos.length > 0
  ).length;

  if (videos.length === 0) {
    return (
      <ReportSection
        id="videos"
        eyebrow="İçerikler"
        title="Video Performansı"
        description="Kampanyadaki tüm videolar."
        className="pb-8"
      >
        <p className="text-sm text-[var(--report-text-tertiary)]">
          Bu kampanyada henüz yayında video yok.
        </p>
      </ReportSection>
    );
  }

  return (
    <ReportSection
      id="videos"
      eyebrow="İçerikler"
      title="Video Performansı"
      description={`${videos.length} içerik · ${populatedCategories} kategori`}
      className="pb-8"
      aside={
        <label className="flex items-center gap-3 text-sm text-[var(--report-text-secondary)]">
          <span className="text-[10px] tracking-[0.14em] uppercase">
            Sırala
          </span>
          <select
            value={sortBy}
            onChange={(event) =>
              handleSortChange(event.target.value as SortOption)
            }
            className="rounded-lg border border-[var(--report-border)] bg-transparent px-3 py-2 text-sm text-[var(--report-text)] outline-none focus:border-[var(--report-border-strong)]"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <option
                key={option}
                value={option}
                className="bg-[var(--report-surface)] text-[var(--report-text)]"
              >
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="space-y-9">
        {groupedVideos.map(({ category, videos: categoryVideos }) => (
          <ContentCategoryGroup
            key={category}
            category={category}
            videos={categoryVideos}
            campaignAverageEngagement={campaignAverageEngagement}
          />
        ))}
      </div>
    </ReportSection>
  );
}
