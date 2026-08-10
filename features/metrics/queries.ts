import {
  campaignEngagementRate,
  campaignTotalEngagement,
  campaignTotalViews,
  creatorContribution,
  engagementRate,
  engagementTotal,
  getLatestSnapshotPerVideo,
  growthPercentage,
  metricDeltas,
  snapshotToMetricCounts,
  soundGrowthAbsolute,
  soundGrowthMultiplier,
  toDateKey,
} from "@/features/metrics/calculations";
import type {
  CampaignMetricSummary,
  CampaignMetricTimelineRow,
  CreatorMetricSummaryRow,
  SoundMetricSummary,
  SoundMetricSnapshot,
  VideoMetricHistoryRow,
  VideoMetricSnapshot,
  VideoMetricSummary,
} from "@/features/metrics/types";
import type { SyncDbClient } from "@/features/sync/db-client";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function mapSupabaseError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("permission denied")) {
    return "Bu işlem için yetkiniz yok.";
  }

  if (normalized.includes("jwt")) {
    return "Oturumunuz geçersiz. Lütfen tekrar giriş yapın.";
  }

  return "Veritabanı hatası oluştu. Lütfen tekrar deneyin.";
}

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  return supabase;
}

async function resolveClient(client?: SyncDbClient) {
  return client ?? (await requireAuthenticatedClient());
}

function mapVideoSnapshot(row: VideoMetricSnapshot): VideoMetricSnapshot {
  return {
    ...row,
    views: Number(row.views),
    likes: Number(row.likes),
    comments: Number(row.comments),
    shares: Number(row.shares),
    saves: Number(row.saves),
  };
}

function mapSoundSnapshot(row: SoundMetricSnapshot): SoundMetricSnapshot {
  return {
    ...row,
    usage_count: Number(row.usage_count),
  };
}

export async function listVideoMetricSnapshots(
  videoId: string,
  client?: SyncDbClient
): Promise<VideoMetricSnapshot[]> {
  const supabase = await resolveClient(client);

  const { data, error } = await supabase
    .from("video_metric_snapshots")
    .select("*")
    .eq("video_id", videoId)
    .order("captured_at", { ascending: false });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []).map((row) => mapVideoSnapshot(row as VideoMetricSnapshot));
}

export async function getLatestVideoMetricSnapshot(
  videoId: string,
  client?: SyncDbClient
): Promise<VideoMetricSnapshot | null> {
  const snapshots = await listVideoMetricSnapshots(videoId, client);
  return snapshots[0] ?? null;
}

export async function getPreviousVideoMetricSnapshot(
  videoId: string
): Promise<VideoMetricSnapshot | null> {
  const snapshots = await listVideoMetricSnapshots(videoId);
  return snapshots[1] ?? null;
}

export async function getVideoMetricSummary(
  videoId: string
): Promise<VideoMetricSummary> {
  const snapshots = await listVideoMetricSnapshots(videoId);
  const latest = snapshots[0] ?? null;
  const previous = snapshots[1] ?? null;

  if (!latest) {
    return {
      latest: null,
      previous: null,
      engagementRate: 0,
      engagementTotal: 0,
      deltas: null,
      growthPercentage: null,
    };
  }

  const latestCounts = snapshotToMetricCounts(latest);

  return {
    latest,
    previous,
    engagementRate: engagementRate(latestCounts),
    engagementTotal: engagementTotal(latestCounts),
    deltas: previous ? metricDeltas(latestCounts, snapshotToMetricCounts(previous)) : null,
    growthPercentage: previous
      ? growthPercentage(latestCounts, snapshotToMetricCounts(previous))
      : null,
  };
}

export async function buildVideoMetricHistory(
  videoId: string
): Promise<VideoMetricHistoryRow[]> {
  const snapshots = await listVideoMetricSnapshots(videoId);

  return snapshots.map((snapshot, index) => {
    const counts = snapshotToMetricCounts(snapshot);
    const older = snapshots[index + 1];

    return {
      ...snapshot,
      engagementRate: engagementRate(counts),
      deltas: older ? metricDeltas(counts, snapshotToMetricCounts(older)) : null,
    };
  });
}

async function getActiveCampaignVideoIds(campaignId: string): Promise<string[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("videos")
    .select("id, status")
    .eq("campaign_id", campaignId)
    .neq("status", "unavailable");

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []).map((row) => row.id as string);
}

async function listCampaignVideoSnapshots(
  campaignId: string
): Promise<Array<VideoMetricSnapshot & { creator_id: string }>> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("video_metric_snapshots")
    .select("*, video:videos!inner(id, campaign_id, creator_id, status)")
    .eq("video.campaign_id", campaignId)
    .neq("video.status", "unavailable");

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []).map((row) => {
    const video = row.video as { creator_id: string };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit join payload
    const { video: _videoJoin, ...snapshot } = row;

    return {
      ...mapVideoSnapshot(snapshot as VideoMetricSnapshot),
      creator_id: video.creator_id,
    };
  });
}

export async function getCampaignMetricSummary(
  campaignId: string
): Promise<CampaignMetricSummary> {
  const videoIds = await getActiveCampaignVideoIds(campaignId);
  const snapshots = await listCampaignVideoSnapshots(campaignId);
  const latestByVideo = getLatestSnapshotPerVideo(snapshots);
  const latestSnapshots = Array.from(latestByVideo.values()).map(
    snapshotToMetricCounts
  );

  let lastUpdatedAt: string | null = null;

  for (const snapshot of latestByVideo.values()) {
    if (
      !lastUpdatedAt ||
      new Date(snapshot.captured_at).getTime() >
        new Date(lastUpdatedAt).getTime()
    ) {
      lastUpdatedAt = snapshot.captured_at;
    }
  }

  return {
    totalViews: campaignTotalViews(latestSnapshots),
    totalEngagement: campaignTotalEngagement(latestSnapshots),
    engagementRate: campaignEngagementRate(latestSnapshots),
    totalVideos: videoIds.length,
    videosWithMetrics: latestByVideo.size,
    videosWithoutMetrics: Math.max(videoIds.length - latestByVideo.size, 0),
    lastUpdatedAt,
  };
}

export async function getCampaignMetricTimeline(
  campaignId: string
): Promise<CampaignMetricTimelineRow[]> {
  const snapshots = await listCampaignVideoSnapshots(campaignId);
  const grouped = new Map<
    string,
    { totalViews: number; totalEngagement: number; videoIds: Set<string> }
  >();

  for (const snapshot of snapshots) {
    const date = toDateKey(snapshot.captured_at);
    const counts = snapshotToMetricCounts(snapshot);
    const existing = grouped.get(date) ?? {
      totalViews: 0,
      totalEngagement: 0,
      videoIds: new Set<string>(),
    };

    existing.totalViews += counts.views;
    existing.totalEngagement += engagementTotal(counts);
    existing.videoIds.add(snapshot.video_id);
    grouped.set(date, existing);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, value]) => ({
      date,
      totalViews: value.totalViews,
      totalEngagement: value.totalEngagement,
      videoCount: value.videoIds.size,
    }));
}

export async function getCampaignCreatorMetricSummary(
  campaignId: string
): Promise<CreatorMetricSummaryRow[]> {
  const supabase = await requireAuthenticatedClient();
  const snapshots = await listCampaignVideoSnapshots(campaignId);
  const latestByVideo = getLatestSnapshotPerVideo(snapshots);
  const campaignSummary = await getCampaignMetricSummary(campaignId);

  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, creator_id, creator:creators(id, username, display_name, avatar_url)")
    .eq("campaign_id", campaignId)
    .neq("status", "unavailable");

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  const creatorMap = new Map<
    string,
    CreatorMetricSummaryRow & { engagementNumerator: number; engagementDenominator: number }
  >();

  for (const video of videos ?? []) {
    const creatorRaw = video.creator as
      | {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
        }
      | Array<{
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
        }>
      | null;

    const creator = Array.isArray(creatorRaw) ? creatorRaw[0] : creatorRaw;

    if (!creator) {
      continue;
    }
    const latest = latestByVideo.get(video.id as string);
    const counts = latest ? snapshotToMetricCounts(latest) : null;

    const existing = creatorMap.get(creator.id) ?? {
      creatorId: creator.id,
      username: creator.username,
      displayName: creator.display_name,
      avatarUrl: creator.avatar_url,
      videoCount: 0,
      latestTotalViews: 0,
      contributionPercentage: 0,
      engagementRate: 0,
      engagementNumerator: 0,
      engagementDenominator: 0,
    };

    existing.videoCount += 1;

    if (counts) {
      existing.latestTotalViews += counts.views;
      existing.engagementNumerator += engagementTotal(counts);
      existing.engagementDenominator += counts.views;
    }

    creatorMap.set(creator.id, existing);
  }

  return Array.from(creatorMap.values())
    .map(({ engagementNumerator, engagementDenominator, ...row }) => ({
      ...row,
      contributionPercentage: creatorContribution(
        row.latestTotalViews,
        campaignSummary.totalViews
      ),
      engagementRate:
        engagementDenominator > 0
          ? (engagementNumerator / engagementDenominator) * 100
          : 0,
    }))
    .sort((a, b) => b.latestTotalViews - a.latestTotalViews);
}

export async function listSoundMetricSnapshots(
  campaignId: string,
  metricType: "original" | "cluster" = "original"
): Promise<SoundMetricSnapshot[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("sound_metric_snapshots")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("metric_type", metricType)
    .order("captured_at", { ascending: false });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []).map((row) => mapSoundSnapshot(row as SoundMetricSnapshot));
}

export async function getLatestSoundMetricSnapshot(
  campaignId: string
): Promise<SoundMetricSnapshot | null> {
  const snapshots = await listSoundMetricSnapshots(campaignId);
  return snapshots[0] ?? null;
}

export async function getSoundMetricSummary(
  campaignId: string
): Promise<SoundMetricSummary> {
  const snapshots = await listSoundMetricSnapshots(campaignId);
  const latest = snapshots[0] ?? null;
  const initial = snapshots.length > 0 ? snapshots[snapshots.length - 1]! : null;

  return {
    latest,
    initial,
    growthMultiplier:
      latest && initial
        ? soundGrowthMultiplier(latest.usage_count, initial.usage_count)
        : null,
    growthAbsolute:
      latest && initial
        ? soundGrowthAbsolute(latest.usage_count, initial.usage_count)
        : null,
  };
}

export async function getVideoMetricSnapshotById(
  snapshotId: string
): Promise<(VideoMetricSnapshot & { campaign_id: string }) | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("video_metric_snapshots")
    .select("*, video:videos(campaign_id)")
    .eq("id", snapshotId)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  if (!data) {
    return null;
  }

  const video = data.video as { campaign_id: string };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit join payload
  const { video: _videoJoin, ...snapshot } = data;

  return {
    ...mapVideoSnapshot(snapshot as VideoMetricSnapshot),
    campaign_id: video.campaign_id,
  };
}

export async function getSoundMetricSnapshotById(
  snapshotId: string
): Promise<SoundMetricSnapshot | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("sound_metric_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return data ? mapSoundSnapshot(data as SoundMetricSnapshot) : null;
}
