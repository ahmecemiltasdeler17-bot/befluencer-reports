import {
  aggregateLatestMetrics,
  buildCampaignTimeline,
  buildCreatorContributions,
  buildSoundGrowthData,
  buildTrendAndGrowth,
  calculateGrowthSinceStart,
  computeCreatorMetrics,
  computeReportFreshness,
  getLatestSnapshotsByVideo,
  mapRawSnapshots,
  selectFeaturedVideo,
  videoEngagementRate,
  type MetricSnapshot,
} from "@/features/reports/calculations";
import type {
  CampaignReportData,
  RawCampaignReportInput,
  RawVideoRow,
} from "@/features/reports/types";
import { formatTurkishDate } from "@/lib/format";
import { resolveCreatorProfileUrl } from "@/lib/report-links/build-platform-profile-url";
import type {
  Campaign,
  CreatorCategory,
  DashboardData,
  Platform,
  Video,
} from "@/lib/types";

const DEFAULT_COVER_COLOR = "#1e1b4b";

function mapCampaignStatus(
  status: string
): Campaign["status"] {
  if (
    status === "active" ||
    status === "completed" ||
    status === "draft" ||
    status === "paused"
  ) {
    return status;
  }

  if (status === "archived") {
    return "completed";
  }

  return "active";
}

function mapPlatform(platform: string): Platform {
  if (platform === "instagram" || platform === "youtube") {
    return platform;
  }

  return "tiktok";
}

function mapReportCreatorCategory(
  category: string | null | undefined
): CreatorCategory {
  if (
    category === "nano" ||
    category === "micro" ||
    category === "macro" ||
    category === "mega" ||
    category === "template" ||
    category === "uncategorized"
  ) {
    return category;
  }

  return "uncategorized";
}

function mapVideoRow(
  row: RawVideoRow,
  latestSnapshot: MetricSnapshot | undefined,
  creatorCategory: CreatorCategory
): Video {
  const hasMetrics = Boolean(latestSnapshot);
  const creatorPlatform = mapPlatform(row.creator.platform);
  const metrics = latestSnapshot ?? {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
  };

  return {
    id: row.id,
    title: row.caption?.trim() || "Video",
    creatorHandle: `@${row.creator.username}`,
    creatorName: row.creator.display_name?.trim() || row.creator.username,
    creatorAvatar: row.creator.avatar_url ?? "",
    thumbnail: row.thumbnail_url ?? "",
    platform: mapPlatform(row.platform),
    views: metrics.views,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    saves: metrics.saves,
    engagementRate: hasMetrics ? videoEngagementRate(metrics) : 0,
    publishedAt: row.published_at ?? row.created_at,
    url: row.video_url,
    category: creatorCategory,
    hasMetrics,
    creatorProfileUrl: resolveCreatorProfileUrl({
      profileUrl: row.creator.profile_url ?? null,
      platform: creatorPlatform,
      username: row.creator.username,
    }).href,
    previewMediaUrl: row.preview_media_url ?? null,
    previewMediaType: row.preview_media_type ?? null,
  };
}

function uniqueCreatorsFromVideos(videos: RawVideoRow[]) {
  const creators = new Map<string, RawVideoRow["creator"]>();

  for (const video of videos) {
    const raw = video.creator as RawVideoRow["creator"] | RawVideoRow["creator"][] | null;
    // Supabase embeds can occasionally return a one-element array; unwrap it.
    const creator = Array.isArray(raw) ? (raw[0] ?? null) : raw;

    if (
      !creator ||
      typeof creator !== "object" ||
      typeof creator.id !== "string" ||
      creator.id.trim().length === 0
    ) {
      continue;
    }

    creators.set(creator.id, creator);
  }

  return [...creators.values()];
}

function buildKpis(metrics: ReturnType<typeof aggregateLatestMetrics>, creatorCount: number, videoCount: number): DashboardData["kpis"] {
  return [
    {
      id: "total-engagement",
      label: "Total Engagement",
      value: metrics.totalEngagement,
      previousValue: 0,
      format: "compact",
    },
    {
      id: "videos-live",
      label: "Videos Live",
      value: videoCount,
      previousValue: 0,
      format: "number",
    },
    {
      id: "creators",
      label: "Creators",
      value: creatorCount,
      previousValue: 0,
      format: "number",
    },
    {
      id: "engagement-rate",
      label: "Avg. Engagement Rate",
      value: metrics.engagementRate,
      previousValue: 0,
      format: "percent",
    },
    {
      id: "total-shares",
      label: "Total Shares",
      value: metrics.totalShares,
      previousValue: 0,
      format: "compact",
    },
  ];
}

export function mapCampaignReportData(
  input: RawCampaignReportInput
): CampaignReportData {
  const snapshots = mapRawSnapshots(input.videoSnapshots);
  const latestByVideo = getLatestSnapshotsByVideo(snapshots);
  const activeVideoIds = input.videos.map((video) => video.id);
  const metrics = aggregateLatestMetrics(latestByVideo);
  const timeline = buildCampaignTimeline(activeVideoIds, snapshots);
  const { trend, growth } = buildTrendAndGrowth(timeline);
  const growthSinceStart = calculateGrowthSinceStart(metrics.totalViews, timeline);

  const mappedVideos = input.videos.map((video) =>
    mapVideoRow(
      video,
      latestByVideo.get(video.id),
      mapReportCreatorCategory(video.creator.category)
    )
  );

  const creatorRows = buildCreatorContributions(
    uniqueCreatorsFromVideos(input.videos).map((creator) =>
      computeCreatorMetrics(creator, mappedVideos)
    )
  );

  const featuredVideo = selectFeaturedVideo(mappedVideos);
  const soundGrowth = buildSoundGrowthData({
    trackName: input.campaign.track_name,
    snapshots: input.soundSnapshots,
    soundId: input.campaign.tiktok_sound_id,
    soundAuthor: input.campaign.tiktok_sound_author,
    soundUrl: input.campaign.sound_url,
    soundCoverUrl: input.campaign.tiktok_sound_cover_url,
  });

  const videosWithoutMetrics = mappedVideos.filter(
    (video) => video.hasMetrics === false
  ).length;

  const reportNumber =
    input.report?.report_number ??
    input.campaign.report_number ??
    "—";

  const reportDate = formatTurkishDate(
    input.report?.generated_at ??
      input.report?.last_updated_at ??
      input.campaign.updated_at
  );

  const campaign: Campaign = {
    id: input.campaign.id,
    name: input.campaign.name,
    artist: input.campaign.artist_name,
    track: input.campaign.track_name,
    client: input.campaign.client_name ?? "—",
    status: mapCampaignStatus(input.campaign.status),
    startDate: input.campaign.start_date ?? input.campaign.created_at,
    endDate: input.campaign.end_date ?? input.campaign.updated_at,
    soundUrl: input.campaign.sound_url ?? "",
    coverColor: DEFAULT_COVER_COLOR,
  };

  const clusterTimelineLength = soundGrowth.cluster?.timeline.length ?? 0;

  return {
    campaign,
    totalReach: {
      label: "Total Reach",
      value: metrics.totalViews,
      previousValue: timeline[0]?.views ?? 0,
      growthSinceStart,
    },
    summary: {
      headline: "",
      paragraphs: [],
    },
    kpis: buildKpis(metrics, creatorRows.length, mappedVideos.length),
    trend,
    growth,
    platforms: [],
    topVideo: featuredVideo,
    featuredVideo,
    creators: creatorRows,
    videos: mappedVideos,
    soundGrowth,
    metadata: {
      reportNumber,
      reportDate,
      hasReportRecord: Boolean(input.report),
      freshness: computeReportFreshness({
        videos: input.videos,
        videosWithoutMetrics,
      }),
    },
    hasTimeline: timeline.length >= 2,
    hasSoundTimeline:
      soundGrowth.timeline.length >= 2 || clusterTimelineLength >= 2,
  };
}
