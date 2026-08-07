import type { MetricCounts, MetricDeltas, VideoMetricSnapshot } from "@/features/metrics/types";

export function engagementTotal(counts: Pick<MetricCounts, "likes" | "comments" | "shares" | "saves">): number {
  return counts.likes + counts.comments + counts.shares + counts.saves;
}

export function engagementRate(counts: MetricCounts): number {
  if (counts.views <= 0) {
    return 0;
  }

  return (engagementTotal(counts) / counts.views) * 100;
}

export function deltaViews(
  latest: Pick<MetricCounts, "views">,
  previous: Pick<MetricCounts, "views">
): number {
  return latest.views - previous.views;
}

export function deltaLikes(
  latest: Pick<MetricCounts, "likes">,
  previous: Pick<MetricCounts, "likes">
): number {
  return latest.likes - previous.likes;
}

export function deltaComments(
  latest: Pick<MetricCounts, "comments">,
  previous: Pick<MetricCounts, "comments">
): number {
  return latest.comments - previous.comments;
}

export function deltaShares(
  latest: Pick<MetricCounts, "shares">,
  previous: Pick<MetricCounts, "shares">
): number {
  return latest.shares - previous.shares;
}

export function deltaSaves(
  latest: Pick<MetricCounts, "saves">,
  previous: Pick<MetricCounts, "saves">
): number {
  return latest.saves - previous.saves;
}

export function metricDeltas(
  latest: MetricCounts,
  previous: MetricCounts
): MetricDeltas {
  return {
    views: deltaViews(latest, previous),
    likes: deltaLikes(latest, previous),
    comments: deltaComments(latest, previous),
    shares: deltaShares(latest, previous),
    saves: deltaSaves(latest, previous),
  };
}

export function growthPercentage(
  latest: Pick<MetricCounts, "views">,
  previous: Pick<MetricCounts, "views">
): number | null {
  if (previous.views <= 0) {
    return null;
  }

  return (deltaViews(latest, previous) / previous.views) * 100;
}

export function campaignTotalViews(
  latestSnapshots: MetricCounts[]
): number {
  return latestSnapshots.reduce((sum, snapshot) => sum + snapshot.views, 0);
}

export function campaignTotalEngagement(
  latestSnapshots: MetricCounts[]
): number {
  return latestSnapshots.reduce(
    (sum, snapshot) => sum + engagementTotal(snapshot),
    0
  );
}

export function campaignEngagementRate(
  latestSnapshots: MetricCounts[]
): number {
  const totalViews = campaignTotalViews(latestSnapshots);

  if (totalViews <= 0) {
    return 0;
  }

  return (campaignTotalEngagement(latestSnapshots) / totalViews) * 100;
}

export function creatorContribution(
  creatorLatestViews: number,
  campaignViews: number
): number {
  if (campaignViews <= 0) {
    return 0;
  }

  return (creatorLatestViews / campaignViews) * 100;
}

export function soundGrowthMultiplier(
  latestUses: number,
  initialUses: number
): number | null {
  if (initialUses <= 0) {
    return null;
  }

  return latestUses / initialUses;
}

export function soundGrowthAbsolute(
  latestUses: number,
  initialUses: number
): number {
  return latestUses - initialUses;
}

export function snapshotToMetricCounts(
  snapshot: VideoMetricSnapshot
): MetricCounts {
  return {
    views: Number(snapshot.views),
    likes: Number(snapshot.likes),
    comments: Number(snapshot.comments),
    shares: Number(snapshot.shares),
    saves: Number(snapshot.saves),
  };
}

export function getLatestSnapshotPerVideo(
  snapshots: VideoMetricSnapshot[]
): Map<string, VideoMetricSnapshot> {
  const latestByVideo = new Map<string, VideoMetricSnapshot>();

  for (const snapshot of snapshots) {
    const existing = latestByVideo.get(snapshot.video_id);

    if (
      !existing ||
      new Date(snapshot.captured_at).getTime() >
        new Date(existing.captured_at).getTime()
    ) {
      latestByVideo.set(snapshot.video_id, snapshot);
    }
  }

  return latestByVideo;
}

export function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}
