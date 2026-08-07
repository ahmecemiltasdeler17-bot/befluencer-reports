import {
  campaignEngagementRate,
  campaignTotalEngagement,
  campaignTotalViews,
  engagementRate,
  engagementTotal,
  getLatestSnapshotPerVideo,
  soundGrowthMultiplier,
  toDateKey,
} from "@/features/metrics/calculations";
import type { VideoMetricSnapshot } from "@/features/metrics/types";
import type { RawVideoSnapshotRow } from "@/features/reports/types";
import type {
  Creator,
  GrowthDataPoint,
  Platform,
  TrendDataPoint,
  Video,
} from "@/lib/types";
import { formatTurkishDayMonth } from "@/lib/format";
import { resolveCreatorProfileUrl } from "@/lib/report-links/build-platform-profile-url";

export type MetricSnapshot = {
  videoId: string;
  capturedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

export function mapRawSnapshots(rows: RawVideoSnapshotRow[]): MetricSnapshot[] {
  return rows.map((row) => ({
    videoId: row.video_id,
    capturedAt: row.captured_at,
    views: Number(row.views),
    likes: Number(row.likes),
    comments: Number(row.comments),
    shares: Number(row.shares),
    saves: Number(row.saves),
  }));
}

export function getLatestSnapshotsByVideo(
  snapshots: MetricSnapshot[]
): Map<string, MetricSnapshot> {
  const mapped = snapshots.map(
    (snapshot): VideoMetricSnapshot => ({
      id: snapshot.videoId,
      video_id: snapshot.videoId,
      captured_at: snapshot.capturedAt,
      views: snapshot.views,
      likes: snapshot.likes,
      comments: snapshot.comments,
      shares: snapshot.shares,
      saves: snapshot.saves,
    })
  );

  const latest = getLatestSnapshotPerVideo(mapped);
  const result = new Map<string, MetricSnapshot>();

  for (const [videoId, row] of latest.entries()) {
    result.set(videoId, {
      videoId,
      capturedAt: row.captured_at,
      views: Number(row.views),
      likes: Number(row.likes),
      comments: Number(row.comments),
      shares: Number(row.shares),
      saves: Number(row.saves),
    });
  }

  return result;
}

export function aggregateLatestMetrics(latestByVideo: Map<string, MetricSnapshot>) {
  const snapshots = [...latestByVideo.values()];

  return {
    totalViews: campaignTotalViews(snapshots),
    totalLikes: snapshots.reduce((sum, item) => sum + item.likes, 0),
    totalComments: snapshots.reduce((sum, item) => sum + item.comments, 0),
    totalShares: snapshots.reduce((sum, item) => sum + item.shares, 0),
    totalSaves: snapshots.reduce((sum, item) => sum + item.saves, 0),
    totalEngagement: campaignTotalEngagement(snapshots),
    engagementRate: campaignEngagementRate(snapshots),
  };
}

export type TimelinePoint = {
  dateKey: string;
  views: number;
  engagement: number;
};

export function buildCampaignTimeline(
  activeVideoIds: string[],
  snapshots: MetricSnapshot[]
): TimelinePoint[] {
  if (activeVideoIds.length === 0 || snapshots.length === 0) {
    return [];
  }

  const snapshotsByVideo = new Map<string, MetricSnapshot[]>();

  for (const snapshot of snapshots) {
    if (!activeVideoIds.includes(snapshot.videoId)) {
      continue;
    }

    const bucket = snapshotsByVideo.get(snapshot.videoId) ?? [];
    bucket.push(snapshot);
    snapshotsByVideo.set(snapshot.videoId, bucket);
  }

  for (const bucket of snapshotsByVideo.values()) {
    bucket.sort(
      (a, b) =>
        new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );
  }

  const dateKeys = [
    ...new Set(snapshots.map((snapshot) => toDateKey(snapshot.capturedAt))),
  ].sort();

  return dateKeys.map((dateKey) => {
    let views = 0;
    let engagement = 0;

    for (const videoId of activeVideoIds) {
      const videoSnapshots = snapshotsByVideo.get(videoId) ?? [];
      const eligible = videoSnapshots.filter(
        (snapshot) => toDateKey(snapshot.capturedAt) <= dateKey
      );
      const latest = eligible[eligible.length - 1];

      if (latest) {
        views += latest.views;
        engagement += engagementTotal(latest);
      }
    }

    return { dateKey, views, engagement };
  });
}

export function calculateGrowthSinceStart(
  currentTotalViews: number,
  timeline: TimelinePoint[]
): number | null {
  if (timeline.length < 2) {
    return null;
  }

  const earliest = timeline[0].views;

  if (earliest <= 0) {
    return null;
  }

  return ((currentTotalViews - earliest) / earliest) * 100;
}

export function buildTrendAndGrowth(timeline: TimelinePoint[]): {
  trend: TrendDataPoint[];
  growth: GrowthDataPoint[];
} {
  if (timeline.length === 0) {
    return { trend: [], growth: [] };
  }

  const trend: TrendDataPoint[] = timeline.map((point) => ({
    date: point.dateKey,
    views: point.views,
    engagement: point.engagement,
  }));

  const growth: GrowthDataPoint[] = timeline.map((point, index) => {
    const previousViews = index > 0 ? timeline[index - 1].views : 0;

    return {
      date: formatTurkishDayMonth(point.dateKey),
      views: Math.max(point.views - previousViews, 0),
      cumulativeViews: point.views,
    };
  });

  return { trend, growth };
}

export function selectFeaturedVideo(videos: Video[]): Video | null {
  const candidates = videos.filter((video) => video.hasMetrics !== false);

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    if (right.views !== left.views) {
      return right.views - left.views;
    }

    if (right.engagementRate !== left.engagementRate) {
      return right.engagementRate - left.engagementRate;
    }

    return (
      new Date(left.publishedAt).getTime() - new Date(right.publishedAt).getTime()
    );
  })[0];
}

export function buildCreatorContributions(
  creators: Creator[]
): Creator[] {
  return [...creators]
    .sort((left, right) => right.views - left.views)
    .map((creator, index) => ({
      ...creator,
      rank: index + 1,
    }));
}

export function computeCreatorMetrics(
  creator: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    profile_url?: string | null;
    follower_count: number;
    category: string | null;
    platform?: string | null;
  },
  videos: Video[]
): Creator {
  const creatorVideos = videos.filter((video) =>
    video.creatorHandle === `@${creator.username}`
  );
  const withMetrics = creatorVideos.filter((video) => video.hasMetrics !== false);
  const views = withMetrics.reduce((sum, video) => sum + video.views, 0);
  const engagement = withMetrics.reduce(
    (sum, video) => sum + video.likes + video.comments + video.shares + video.saves,
    0
  );

  const platform = normalizeCreatorPlatform(creator.platform);

  return {
    id: creator.id,
    rank: 0,
    handle: `@${creator.username}`,
    displayName: creator.display_name?.trim() || creator.username,
    avatar: creator.avatar_url ?? "",
    followers: Number(creator.follower_count),
    videos: creatorVideos.length,
    views,
    engagement,
    engagementRate: views > 0 ? (engagement / views) * 100 : 0,
    category: (creator.category ?? "uncategorized") as Creator["category"],
    platform,
    profileUrl: resolveCreatorProfileUrl({
      profileUrl: creator.profile_url ?? null,
      platform,
      username: creator.username,
    }).href,
  };
}

function normalizeCreatorPlatform(platform: string | null | undefined): Platform {
  if (platform === "instagram" || platform === "youtube") {
    return platform;
  }

  return "tiktok";
}

export function buildSoundGrowthData(input: {
  trackName: string;
  snapshots: Array<{ captured_at: string; usage_count: number }>;
  soundId?: string | null;
  soundAuthor?: string | null;
  soundUrl?: string | null;
}) {
  if (input.snapshots.length === 0) {
    return {
      soundName: input.trackName,
      initialUses: 0,
      currentUses: 0,
      multiplier: 0,
      absoluteGrowth: 0,
      growthPercentage: null as number | null,
      soundId: input.soundId ?? null,
      soundAuthor: input.soundAuthor ?? null,
      soundUrl: input.soundUrl ?? null,
      timeline: [] as Array<{ date: string; uses: number }>,
    };
  }

  const sorted = [...input.snapshots].sort(
    (left, right) =>
      new Date(left.captured_at).getTime() - new Date(right.captured_at).getTime()
  );

  const initialUses = Number(sorted[0].usage_count);
  const currentUses = Number(sorted[sorted.length - 1].usage_count);
  const absoluteGrowth = currentUses - initialUses;
  const multiplier = soundGrowthMultiplier(currentUses, initialUses) ?? 0;
  const growthPercentage =
    initialUses > 0 ? (absoluteGrowth / initialUses) * 100 : null;

  return {
    soundName: input.trackName,
    initialUses,
    currentUses,
    multiplier,
    absoluteGrowth,
    growthPercentage,
    soundId: input.soundId ?? null,
    soundAuthor: input.soundAuthor ?? null,
    soundUrl: input.soundUrl ?? null,
    timeline: sorted.map((snapshot) => ({
      date: snapshot.captured_at,
      uses: Number(snapshot.usage_count),
    })),
  };
}

export function computeReportFreshness(input: {
  videos: Array<{
    last_synced_at: string | null;
    sync_status: string;
  }>;
  videosWithoutMetrics: number;
}): {
  lastSuccessfulSyncAt: string | null;
  videosWithoutMetrics: number;
  staleVideoCount: number;
} {
  const staleThresholdMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  let lastSuccessfulSyncAt: string | null = null;
  let staleVideoCount = 0;

  for (const video of input.videos) {
    if (video.sync_status === "success" && video.last_synced_at) {
      const syncedAt = new Date(video.last_synced_at).getTime();
      if (!lastSuccessfulSyncAt || syncedAt > new Date(lastSuccessfulSyncAt).getTime()) {
        lastSuccessfulSyncAt = video.last_synced_at;
      }

      if (now - syncedAt > staleThresholdMs) {
        staleVideoCount += 1;
      }
    }
  }

  return {
    lastSuccessfulSyncAt,
    videosWithoutMetrics: input.videosWithoutMetrics,
    staleVideoCount,
  };
}

export function videoEngagementRate(video: Pick<Video, "views" | "likes" | "comments" | "shares" | "saves">): number {
  return engagementRate({
    views: video.views,
    likes: video.likes,
    comments: video.comments,
    shares: video.shares,
    saves: video.saves,
  });
}
