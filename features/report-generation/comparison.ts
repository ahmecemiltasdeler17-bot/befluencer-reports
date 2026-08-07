import type {
  ComparisonMetricRow,
  ReportVersionComparison,
  ReportVersionSummary,
} from "@/features/report-generation/types";
import { parseReportSnapshot } from "@/features/report-generation/schemas";

function percentDelta(
  oldValue: number | null,
  newValue: number | null
): number | null {
  if (oldValue === null || newValue === null) {
    return null;
  }

  if (oldValue === 0) {
    return newValue === 0 ? 0 : null;
  }

  return ((newValue - oldValue) / oldValue) * 100;
}

function absoluteDelta(
  oldValue: number | null,
  newValue: number | null
): number | null {
  if (oldValue === null || newValue === null) {
    return null;
  }

  return newValue - oldValue;
}

function metricRow(
  key: string,
  label: string,
  oldValue: number | null,
  newValue: number | null
): ComparisonMetricRow {
  return {
    key,
    label,
    oldValue,
    newValue,
    absoluteDelta: absoluteDelta(oldValue, newValue),
    percentDelta: percentDelta(oldValue, newValue),
  };
}

function sumVideoMetric(
  videos: Array<{ likes: number; comments: number; shares: number; saves: number }>,
  key: "likes" | "comments" | "shares" | "saves"
): number {
  return videos.reduce((sum, video) => sum + video[key], 0);
}

function creatorAudience(creators: Array<{ followers: number }>): number {
  return creators.reduce((sum, creator) => sum + creator.followers, 0);
}

export function compareReportSnapshots(input: {
  fromVersion: ReportVersionSummary;
  toVersion: ReportVersionSummary;
  fromSnapshot: unknown;
  toSnapshot: unknown;
}): ReportVersionComparison {
  const from = parseReportSnapshot(input.fromSnapshot);
  const to = parseReportSnapshot(input.toSnapshot);

  const fromVideos = from.data.videos;
  const toVideos = to.data.videos;

  const metrics: ComparisonMetricRow[] = [
    metricRow(
      "totalViews",
      "Toplam izlenme",
      from.data.totalReach.value,
      to.data.totalReach.value
    ),
    metricRow(
      "totalEngagement",
      "Toplam etkileşim",
      from.data.kpis.find((kpi) => kpi.id === "total-engagement")?.value ?? null,
      to.data.kpis.find((kpi) => kpi.id === "total-engagement")?.value ?? null
    ),
    metricRow(
      "engagementRate",
      "Etkileşim oranı",
      from.data.kpis.find((kpi) => kpi.id === "engagement-rate")?.value ?? null,
      to.data.kpis.find((kpi) => kpi.id === "engagement-rate")?.value ?? null
    ),
    metricRow(
      "creatorCount",
      "İçerik üreticisi sayısı",
      from.sourceCounts.creatorCount,
      to.sourceCounts.creatorCount
    ),
    metricRow(
      "videoCount",
      "Video sayısı",
      from.sourceCounts.videoCount,
      to.sourceCounts.videoCount
    ),
    metricRow(
      "creatorAudience",
      "Takipçi ağı",
      creatorAudience(from.data.creators),
      creatorAudience(to.data.creators)
    ),
    metricRow(
      "likes",
      "Beğeni",
      sumVideoMetric(fromVideos, "likes"),
      sumVideoMetric(toVideos, "likes")
    ),
    metricRow(
      "comments",
      "Yorum",
      sumVideoMetric(fromVideos, "comments"),
      sumVideoMetric(toVideos, "comments")
    ),
    metricRow(
      "shares",
      "Paylaşım",
      sumVideoMetric(fromVideos, "shares"),
      sumVideoMetric(toVideos, "shares")
    ),
    metricRow(
      "saves",
      "Kaydetme",
      sumVideoMetric(fromVideos, "saves"),
      sumVideoMetric(toVideos, "saves")
    ),
    metricRow(
      "soundUsage",
      "Güncel ses kullanımı",
      from.data.soundGrowth.currentUses,
      to.data.soundGrowth.currentUses
    ),
    metricRow(
      "soundMultiplier",
      "Ses büyüme çarpanı",
      from.data.soundGrowth.multiplier,
      to.data.soundGrowth.multiplier
    ),
    metricRow(
      "videosWithoutMetrics",
      "Metriksiz içerik",
      from.data.metadata.freshness.videosWithoutMetrics,
      to.data.metadata.freshness.videosWithoutMetrics
    ),
    metricRow(
      "staleVideos",
      "Güncelliğini yitirmiş içerik",
      from.data.metadata.freshness.staleVideoCount,
      to.data.metadata.freshness.staleVideoCount
    ),
  ];

  return {
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    metrics,
  };
}

export function formatComparisonValue(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatComparisonPercent(value: number | null): string {
  if (value === null) {
    return "—";
  }

  const formatted = value.toFixed(1).replace(".", ",");
  return value > 0 ? `+${formatted}%` : `${formatted}%`;
}
