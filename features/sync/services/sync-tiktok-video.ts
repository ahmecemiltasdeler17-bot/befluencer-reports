import "server-only";

import { revalidatePath } from "next/cache";

import { getLatestVideoMetricSnapshot } from "@/features/metrics/queries";
import type { VideoMetricSnapshot } from "@/features/metrics/types";
import type { SyncDbClient } from "@/features/sync/db-client";
import type {
  SyncCampaignResult,
  SyncVideoResult,
} from "@/features/sync/types";
import { getVideoById } from "@/features/videos/queries";
import { isTikTokSyncConfigured } from "@/lib/env.server";
import {
  createApifyTikTokProvider,
  inferProviderErrorCodeFromUserMessage,
  TikTokProviderError,
  toTurkishProviderMessage,
} from "@/lib/providers/tiktok";
import {
  chunkArray,
  evaluateVideoSyncEligibility,
} from "@/lib/providers/tiktok/sync-eligibility";
import {
  bumpNonRetriableSkip,
  createEmptySyncMetrics,
  createEmptyVideoSkipBreakdown,
  formatSyncMetricsTurkish,
  logSyncMetrics,
  logVideoSyncPlan,
} from "@/lib/providers/tiktok/sync-observability";
import {
  PROVIDER_BATCH_CONCURRENCY,
  VIDEO_BATCH_SIZE,
} from "@/lib/providers/tiktok/sync-policy";
import {
  isValidThumbnailUrl,
  logThumbnailDiagnostics,
  resolveStoredThumbnailUrl,
} from "@/lib/providers/tiktok/select-video-thumbnail";
import type {
  TikTokMetricsProvider,
  TikTokVideoMetrics,
} from "@/lib/providers/tiktok/types";
import { assertApprovedTikTokUrl } from "@/lib/providers/tiktok/url";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { mapWithConcurrency } from "@/features/creator-sync/services/creator-sync-core";

/** Shared across campaigns in one global sync — prevents duplicate Apify spend. */
export type TikTokSyncOperationCache = {
  videoResults: Map<
    string,
    import("@/lib/providers/tiktok/types").TikTokVideoBatchItemResult
  >;
  creatorResults: Map<
    string,
    import("@/lib/providers/tiktok/types").TikTokCreatorBatchItemResult
  >;
  actorRunsStarted: { value: number };
};

export type SyncTikTokOptions = {
  /** When provided, skips cookie-session auth (used by scheduled sync). */
  client?: SyncDbClient;
  /**
   * Bypass freshness / cooldown only.
   * Does not bypass definitive non-retryable codes unless
   * allowNonRetriableRecheck / recheckLoginRequired is also set.
   */
  force?: boolean;
  /** Apply manual single-item cooldown after recent success. */
  manualCooldown?: boolean;
  /** Explicit re-check of any non-retryable classification. */
  allowNonRetriableRecheck?: boolean;
  /**
   * Manual campaign bulk may soft-recheck login_required videos.
   * Scheduled/auto sync must leave this false.
   */
  recheckLoginRequired?: boolean;
  /** Cross-campaign dedupe cache for one global sync operation. */
  operationCache?: TikTokSyncOperationCache;
};

const SNAPSHOT_STALE_MS = 6 * 60 * 60 * 1000;

function metricsChanged(
  previous: VideoMetricSnapshot,
  next: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  }
): boolean {
  return (
    Number(previous.views) !== next.views ||
    Number(previous.likes) !== next.likes ||
    Number(previous.comments) !== next.comments ||
    Number(previous.shares) !== next.shares ||
    Number(previous.saves) !== next.saves
  );
}

function isSnapshotStale(capturedAt: string): boolean {
  const capturedMs = new Date(capturedAt).getTime();
  return Date.now() - capturedMs >= SNAPSHOT_STALE_MS;
}

function shouldAppendSnapshot(
  previous: VideoMetricSnapshot | null,
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  }
): boolean {
  if (!previous) {
    return true;
  }

  if (metricsChanged(previous, metrics)) {
    return true;
  }

  return isSnapshotStale(previous.captured_at);
}

function isMissingText(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function isMissingFollowerCount(value: number | null | undefined): boolean {
  return value === null || value === undefined || value === 0;
}

function mapSupabaseMutationError(message: string, code?: string): string {
  if (code === "23505" || message.toLowerCase().includes("duplicate")) {
    return "Metrik kaydı zaman çakışması nedeniyle oluşturulamadı.";
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("permission denied")) {
    return "Bu işlem için yetkiniz yok.";
  }

  return "Senkronizasyon kaydedilemedi.";
}

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  return supabase;
}

async function resolveClient(options?: SyncTikTokOptions) {
  return options?.client ?? (await requireAuthenticatedClient());
}

function revalidateSyncPaths(campaignId: string, videoId: string) {
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/videos/${videoId}`);
}

async function insertSnapshotWithRetry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  videoId: string,
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const capturedAt = new Date().toISOString();

  const attemptInsert = async (timestamp: string) => {
    return supabase.from("video_metric_snapshots").insert({
      video_id: videoId,
      captured_at: timestamp,
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      saves: metrics.saves,
    });
  };

  let result = await attemptInsert(capturedAt);

  if (result.error?.code === "23505") {
    const adjusted = new Date(Date.now() + 1000).toISOString();
    result = await attemptInsert(adjusted);
  }

  if (result.error) {
    return {
      ok: false,
      message: mapSupabaseMutationError(result.error.message, result.error.code),
    };
  }

  return { ok: true };
}

function resolveProvider(provider?: TikTokMetricsProvider): TikTokMetricsProvider {
  if (provider) {
    return provider;
  }

  if (!isTikTokSyncConfigured()) {
    throw new TikTokProviderError("not_configured");
  }

  return createApifyTikTokProvider();
}

function inferProviderErrorCode(
  message: string | null | undefined
): string | null {
  return inferProviderErrorCodeFromUserMessage(message);
}

export async function syncTikTokVideo(
  videoId: string,
  provider?: TikTokMetricsProvider,
  options?: SyncTikTokOptions
): Promise<SyncVideoResult> {
  const supabase = await resolveClient(options);

  const video = await getVideoById(videoId, supabase);

  if (!video) {
    return {
      outcome: "failed",
      message: "Video bulunamadı.",
      snapshotCreated: false,
      jobId: null,
    };
  }

  const campaignId = video.campaign_id;

  if (video.platform !== "tiktok") {
    return {
      outcome: "skipped",
      message: "Otomatik senkronizasyon şu an yalnızca TikTok videoları için kullanılabilir.",
      snapshotCreated: false,
      jobId: null,
    };
  }

  if (video.status === "unavailable") {
    return {
      outcome: "skipped",
      message: "Kaldırılmış veya kullanılamayan videolar senkronize edilemez.",
      snapshotCreated: false,
      jobId: null,
    };
  }

  let normalizedUrl: string;

  try {
    normalizedUrl = assertApprovedTikTokUrl(video.video_url).normalizedUrl;
  } catch (error) {
    return {
      outcome: "failed",
      message: toTurkishProviderMessage(error),
      snapshotCreated: false,
      jobId: null,
    };
  }

  const { data: campaignRow } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle();

  const previousSnapshotForEligibility = await getLatestVideoMetricSnapshot(
    videoId,
    supabase
  );

  const { data: lastJob } = await supabase
    .from("sync_jobs")
    .select("status, error_message")
    .eq("video_id", videoId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastErrorCode =
    lastJob?.status === "failed"
      ? inferProviderErrorCodeFromUserMessage(
          lastJob.error_message as string | null
        )
      : null;

  const eligibility = evaluateVideoSyncEligibility({
    lastSyncedAt: video.last_synced_at,
    syncStatus: video.sync_status,
    latestSuccessfulSnapshotAt: previousSnapshotForEligibility?.captured_at,
    campaignStatus: (campaignRow?.status as string) ?? null,
    lastErrorCode,
    force: options?.force,
    allowNonRetriableRecheck: options?.allowNonRetriableRecheck,
    recheckLoginRequired: options?.recheckLoginRequired,
    manualCooldown: options?.manualCooldown ?? true,
  });

  if (!eligibility.eligible) {
    return {
      outcome: "skipped",
      message: eligibility.message,
      snapshotCreated: false,
      jobId: null,
      skipReason: eligibility.reason,
    };
  }

  const startedAt = new Date().toISOString();

  const { data: job, error: jobInsertError } = await supabase
    .from("sync_jobs")
    .insert({
      campaign_id: campaignId,
      video_id: videoId,
      job_type: "tiktok_video_sync",
      status: "running",
      started_at: startedAt,
    })
    .select("id")
    .single();

  if (jobInsertError || !job) {
    return {
      outcome: "failed",
      message: mapSupabaseMutationError(jobInsertError?.message ?? ""),
      snapshotCreated: false,
      jobId: null,
    };
  }

  const jobId = job.id as string;

  try {
    const metricsProvider = resolveProvider(provider);
    const fetched = await metricsProvider.fetchVideoMetrics(normalizedUrl);
    const previousSnapshot = await getLatestVideoMetricSnapshot(
      videoId,
      supabase
    );
    const appendSnapshot = shouldAppendSnapshot(previousSnapshot, fetched);
    let snapshotCreated = false;

    if (appendSnapshot) {
      const insertResult = await insertSnapshotWithRetry(supabase, videoId, {
        views: fetched.views,
        likes: fetched.likes,
        comments: fetched.comments,
        shares: fetched.shares,
        saves: fetched.saves,
      });

      if (!insertResult.ok) {
        throw new Error(insertResult.message);
      }

      snapshotCreated = true;
    }

    const syncedAt = new Date().toISOString();
    const nextThumbnail = resolveStoredThumbnailUrl(
      video.thumbnail_url,
      fetched.thumbnailUrl
    );
    const preservedExisting =
      !isValidThumbnailUrl(fetched.thumbnailUrl) &&
      isValidThumbnailUrl(video.thumbnail_url);

    logThumbnailDiagnostics({
      field: null,
      validated: isValidThumbnailUrl(fetched.thumbnailUrl),
      preservedExisting,
      providerReturnedNone: !fetched.thumbnailUrl,
      host: (() => {
        try {
          return nextThumbnail ? new URL(nextThumbnail).host : null;
        } catch {
          return null;
        }
      })(),
    });

    const videoUpdate: Record<string, unknown> = {
      platform_video_id:
        fetched.platformVideoId ?? video.platform_video_id ?? null,
      thumbnail_url: nextThumbnail,
      caption: fetched.caption ?? video.caption,
      last_synced_at: syncedAt,
      sync_status: "success",
    };

    if (!video.published_at && fetched.publishedAt) {
      videoUpdate.published_at = fetched.publishedAt;
    }

    const { error: videoUpdateError } = await supabase
      .from("videos")
      .update(videoUpdate)
      .eq("id", videoId);

    if (videoUpdateError) {
      throw new Error(mapSupabaseMutationError(videoUpdateError.message));
    }

    const { data: creatorRow } = await supabase
      .from("creators")
      .select("display_name, avatar_url, follower_count")
      .eq("id", video.creator_id)
      .maybeSingle();

    const creatorUpdate: Record<string, unknown> = {};

    if (
      isMissingText(creatorRow?.display_name) &&
      fetched.creatorDisplayName
    ) {
      creatorUpdate.display_name = fetched.creatorDisplayName;
    }

    if (isMissingText(creatorRow?.avatar_url) && fetched.creatorAvatarUrl) {
      creatorUpdate.avatar_url = fetched.creatorAvatarUrl;
    }

    if (
      isMissingFollowerCount(
        creatorRow?.follower_count !== undefined
          ? Number(creatorRow.follower_count)
          : null
      ) &&
      fetched.creatorFollowerCount !== null
    ) {
      creatorUpdate.follower_count = fetched.creatorFollowerCount;
    }

    if (Object.keys(creatorUpdate).length > 0) {
      await supabase
        .from("creators")
        .update(creatorUpdate)
        .eq("id", video.creator_id);
    }

    await supabase
      .from("sync_jobs")
      .update({
        status: "success",
        completed_at: syncedAt,
        error_message: null,
      })
      .eq("id", jobId);

    revalidateSyncPaths(campaignId, videoId);

    const message = snapshotCreated
      ? "TikTok verisi başarıyla güncellendi."
      : "TikTok verisi alındı; metrikler değişmediği için yeni kayıt eklenmedi.";

    return {
      outcome: "success",
      message,
      snapshotCreated,
      jobId,
    };
  } catch (error) {
    const userMessage =
      error instanceof TikTokProviderError
        ? error.toUserMessage()
        : error instanceof Error
          ? error.message
          : "TikTok verisi alınırken beklenmeyen bir hata oluştu.";

    const completedAt = new Date().toISOString();

    await supabase
      .from("videos")
      .update({ sync_status: "failed" })
      .eq("id", videoId);

    await supabase
      .from("sync_jobs")
      .update({
        status: "failed",
        completed_at: completedAt,
        error_message: userMessage,
      })
      .eq("id", jobId);

    revalidateSyncPaths(campaignId, videoId);

    return {
      outcome: "failed",
      message: userMessage,
      snapshotCreated: false,
      jobId,
    };
  }
}

type CampaignVideoRow = {
  id: string;
  video_url: string;
  platform_video_id: string | null;
  last_synced_at: string | null;
  sync_status: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  published_at: string | null;
  creator_id: string;
};

/**
 * Applies a successful provider payload to one video row.
 * Missing batch results must not call this — good metrics stay untouched.
 */
async function applyFetchedVideoMetrics(
  supabase: Awaited<ReturnType<typeof resolveClient>>,
  video: CampaignVideoRow,
  campaignId: string,
  fetched: TikTokVideoMetrics
): Promise<SyncVideoResult> {
  const startedAt = new Date().toISOString();
  const { data: job, error: jobInsertError } = await supabase
    .from("sync_jobs")
    .insert({
      campaign_id: campaignId,
      video_id: video.id,
      job_type: "tiktok_video_sync",
      status: "running",
      started_at: startedAt,
    })
    .select("id")
    .single();

  if (jobInsertError || !job) {
    return {
      outcome: "failed",
      message: mapSupabaseMutationError(jobInsertError?.message ?? ""),
      snapshotCreated: false,
      jobId: null,
    };
  }

  const jobId = job.id as string;

  try {
    const previousSnapshot = await getLatestVideoMetricSnapshot(
      video.id,
      supabase
    );
    const appendSnapshot = shouldAppendSnapshot(previousSnapshot, fetched);
    let snapshotCreated = false;

    if (appendSnapshot) {
      const insertResult = await insertSnapshotWithRetry(supabase, video.id, {
        views: fetched.views,
        likes: fetched.likes,
        comments: fetched.comments,
        shares: fetched.shares,
        saves: fetched.saves,
      });

      if (!insertResult.ok) {
        throw new Error(insertResult.message);
      }

      snapshotCreated = true;
    }

    const syncedAt = new Date().toISOString();
    const nextThumbnail = resolveStoredThumbnailUrl(
      video.thumbnail_url,
      fetched.thumbnailUrl
    );

    const videoUpdate: Record<string, unknown> = {
      platform_video_id:
        fetched.platformVideoId ?? video.platform_video_id ?? null,
      thumbnail_url: nextThumbnail,
      caption: fetched.caption ?? video.caption,
      last_synced_at: syncedAt,
      sync_status: "success",
    };

    if (!video.published_at && fetched.publishedAt) {
      videoUpdate.published_at = fetched.publishedAt;
    }

    const { error: videoUpdateError } = await supabase
      .from("videos")
      .update(videoUpdate)
      .eq("id", video.id);

    if (videoUpdateError) {
      throw new Error(mapSupabaseMutationError(videoUpdateError.message));
    }

    const { data: creatorRow } = await supabase
      .from("creators")
      .select("display_name, avatar_url, follower_count")
      .eq("id", video.creator_id)
      .maybeSingle();

    const creatorUpdate: Record<string, unknown> = {};

    if (
      isMissingText(creatorRow?.display_name) &&
      fetched.creatorDisplayName
    ) {
      creatorUpdate.display_name = fetched.creatorDisplayName;
    }

    if (isMissingText(creatorRow?.avatar_url) && fetched.creatorAvatarUrl) {
      creatorUpdate.avatar_url = fetched.creatorAvatarUrl;
    }

    if (
      isMissingFollowerCount(
        creatorRow?.follower_count !== undefined
          ? Number(creatorRow.follower_count)
          : null
      ) &&
      fetched.creatorFollowerCount !== null
    ) {
      creatorUpdate.follower_count = fetched.creatorFollowerCount;
    }

    if (Object.keys(creatorUpdate).length > 0) {
      await supabase
        .from("creators")
        .update(creatorUpdate)
        .eq("id", video.creator_id);
    }

    await supabase
      .from("sync_jobs")
      .update({
        status: "success",
        completed_at: syncedAt,
        error_message: null,
      })
      .eq("id", jobId);

    return {
      outcome: "success",
      message: snapshotCreated
        ? "TikTok verisi başarıyla güncellendi."
        : "TikTok verisi alındı; metrikler değişmediği için yeni kayıt eklenmedi.",
      snapshotCreated,
      jobId,
    };
  } catch (error) {
    const userMessage =
      error instanceof TikTokProviderError
        ? error.toUserMessage()
        : error instanceof Error
          ? error.message
          : "TikTok verisi alınırken beklenmeyen bir hata oluştu.";

    await supabase
      .from("videos")
      .update({ sync_status: "failed" })
      .eq("id", video.id);

    await supabase
      .from("sync_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: userMessage,
      })
      .eq("id", jobId);

    return {
      outcome: "failed",
      message: userMessage,
      snapshotCreated: false,
      jobId,
    };
  }
}

async function markVideoSyncFailed(
  supabase: Awaited<ReturnType<typeof resolveClient>>,
  campaignId: string,
  videoId: string,
  message: string
): Promise<void> {
  const startedAt = new Date().toISOString();
  const { data: job } = await supabase
    .from("sync_jobs")
    .insert({
      campaign_id: campaignId,
      video_id: videoId,
      job_type: "tiktok_video_sync",
      status: "failed",
      started_at: startedAt,
      completed_at: startedAt,
      error_message: message,
    })
    .select("id")
    .maybeSingle();

  await supabase
    .from("videos")
    .update({ sync_status: "failed" })
    .eq("id", videoId);

  void job;
}

export async function syncCampaignTikTokVideos(
  campaignId: string,
  provider?: TikTokMetricsProvider,
  options?: SyncTikTokOptions
): Promise<SyncCampaignResult> {
  const startedMs = Date.now();
  const metrics = createEmptySyncMetrics();
  const supabase = await resolveClient(options);
  const metricsProvider = resolveProvider(provider);

  const { data: campaignRow } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle();

  const campaignStatus = (campaignRow?.status as string) ?? null;

  const { data: videos, error } = await supabase
    .from("videos")
    .select(
      "id, platform, status, video_url, platform_video_id, last_synced_at, sync_status, thumbnail_url, caption, published_at, creator_id"
    )
    .eq("campaign_id", campaignId)
    .eq("platform", "tiktok")
    .neq("status", "unavailable");

  if (error) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      message: mapSupabaseMutationError(error.message),
    };
  }

  const candidates = (videos ?? []) as CampaignVideoRow[];
  const videoIds = candidates.map((video) => video.id);

  const latestSnapshotByVideoId = new Map<string, string>();
  if (videoIds.length > 0) {
    const { data: snapshotRows } = await supabase
      .from("video_metric_snapshots")
      .select("video_id, captured_at")
      .in("video_id", videoIds)
      .order("captured_at", { ascending: false });

    for (const row of snapshotRows ?? []) {
      const id = row.video_id as string;
      if (!latestSnapshotByVideoId.has(id)) {
        latestSnapshotByVideoId.set(id, row.captured_at as string);
      }
    }
  }

  // Latest attempt per video (not latest failed-only) — a later success clears blocks.
  const lastErrorCodeByVideoId = new Map<string, string | null>();
  if (videoIds.length > 0) {
    const { data: recentJobs } = await supabase
      .from("sync_jobs")
      .select("video_id, status, error_message, completed_at")
      .in("video_id", videoIds)
      .order("completed_at", { ascending: false });

    for (const row of recentJobs ?? []) {
      const id = row.video_id as string;
      if (!id || lastErrorCodeByVideoId.has(id)) continue;
      if (row.status === "failed") {
        lastErrorCodeByVideoId.set(
          id,
          inferProviderErrorCode((row.error_message as string | null) ?? null)
        );
      } else {
        lastErrorCodeByVideoId.set(id, null);
      }
    }
  }

  const skipBreakdown = createEmptyVideoSkipBreakdown();
  const eligible: CampaignVideoRow[] = [];
  let skipped = 0;

  // Manual campaign button soft-rechecks login_required; scheduled paths pass false.
  const recheckLoginRequired = options?.recheckLoginRequired === true;

  for (const video of candidates) {
    const lastErrorCode = lastErrorCodeByVideoId.get(video.id) ?? null;
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: video.last_synced_at,
      syncStatus: video.sync_status,
      latestSuccessfulSnapshotAt: latestSnapshotByVideoId.get(video.id) ?? null,
      campaignStatus,
      lastErrorCode,
      force: options?.force,
      allowNonRetriableRecheck: options?.allowNonRetriableRecheck,
      recheckLoginRequired,
      manualCooldown: false,
    });

    if (!decision.eligible) {
      skipped += 1;
      if (decision.reason === "non_retriable") {
        metrics.skippedNonRetriable += 1;
        bumpNonRetriableSkip(skipBreakdown, lastErrorCode);
      } else if (decision.reason === "cooldown") {
        metrics.skippedCooldown += 1;
        skipBreakdown.cooldown += 1;
      } else if (decision.reason === "archived_no_auto") {
        metrics.skippedFresh += 1;
        skipBreakdown.archived += 1;
      } else {
        metrics.skippedFresh += 1;
        skipBreakdown.fresh += 1;
      }
      continue;
    }
    eligible.push(video);
  }

  logVideoSyncPlan({
    total: candidates.length,
    eligible: eligible.length,
    fresh: skipBreakdown.fresh,
    cooldown: skipBreakdown.cooldown,
    nonRetryable: metrics.skippedNonRetriable,
    loginRequired: skipBreakdown.loginRequired,
    unavailable: skipBreakdown.unavailable,
    invalidUrl: skipBreakdown.invalidUrl,
    malformed: skipBreakdown.malformed,
    otherNonRetriable: skipBreakdown.otherNonRetriable,
    archived: skipBreakdown.archived,
  });

  // Deduplicate by platform_video_id / normalized URL within this operation.
  type FetchGroup = {
    key: string;
    normalizedUrl: string;
    platformVideoId: string | null;
    videos: CampaignVideoRow[];
  };

  const groups = new Map<string, FetchGroup>();

  for (const video of eligible) {
    let normalizedUrl: string;
    let platformVideoId: string | null = video.platform_video_id;
    try {
      const normalized = assertApprovedTikTokUrl(video.video_url);
      normalizedUrl = normalized.normalizedUrl;
      platformVideoId = video.platform_video_id ?? normalized.platformVideoId;
    } catch (error) {
      metrics.failed += 1;
      await markVideoSyncFailed(
        supabase,
        campaignId,
        video.id,
        toTurkishProviderMessage(error)
      );
      continue;
    }

    const key = platformVideoId ?? normalizedUrl;
    const existing = groups.get(key);
    if (existing) {
      existing.videos.push(video);
    } else {
      groups.set(key, {
        key,
        normalizedUrl,
        platformVideoId,
        videos: [video],
      });
    }
  }

  const uniqueGroups = [...groups.values()];
  metrics.entitiesRequested = uniqueGroups.length;
  const baselineRuns = uniqueGroups.length;
  const batches = chunkArray(uniqueGroups, VIDEO_BATCH_SIZE);

  const operationCache = options?.operationCache;

  // Batch is required at the provider boundary — never Promise.all(single).
  await mapWithConcurrency(
    batches,
    PROVIDER_BATCH_CONCURRENCY,
    async (batch) => {
      const results = new Map<
        string,
        import("@/lib/providers/tiktok/types").TikTokVideoBatchItemResult
      >();
      const toFetch: typeof batch = [];

      for (const group of batch) {
        const cached = operationCache?.videoResults.get(group.normalizedUrl);
        if (cached) {
          results.set(group.normalizedUrl, cached);
        } else {
          toFetch.push(group);
        }
      }

      if (toFetch.length > 0) {
        const batchResult = await metricsProvider.fetchVideoMetricsBatch(
          toFetch.map((group) => ({
            videoUrl: group.normalizedUrl,
            platformVideoId: group.platformVideoId,
          }))
        );

        metrics.providerRunsStarted += batchResult.actorRunsStarted;
        if (operationCache) {
          operationCache.actorRunsStarted.value += batchResult.actorRunsStarted;
        }

        for (const [url, item] of batchResult.results) {
          results.set(url, item);
          operationCache?.videoResults.set(url, item);
        }
      }

      for (const group of batch) {
        const item = results.get(group.normalizedUrl);
        if (!item || item.status === "error") {
          const message = item
            ? item.error.toUserMessage()
            : "TikTok veri sağlayıcı sonuç döndürmedi.";
          // Missing batch item: fail the row without nulling existing metrics.
          // Do not re-run the whole batch.
          for (const video of group.videos) {
            metrics.failed += 1;
            await markVideoSyncFailed(
              supabase,
              campaignId,
              video.id,
              message
            );
          }
          continue;
        }

        metrics.entitiesReturned += 1;
        for (const video of group.videos) {
          const applied = await applyFetchedVideoMetrics(
            supabase,
            video,
            campaignId,
            item.metrics
          );
          if (applied.outcome === "success") {
            metrics.success += 1;
          } else {
            metrics.failed += 1;
          }
        }
      }
    }
  );

  metrics.estimatedRunsSaved = Math.max(
    0,
    baselineRuns - metrics.providerRunsStarted
  );
  metrics.durationMs = Date.now() - startedMs;
  logSyncMetrics("sync_campaign_tiktok_videos", metrics);

  revalidatePath(`/campaigns/${campaignId}`);

  const message = formatSyncMetricsTurkish(metrics, skipBreakdown);

  return {
    total: candidates.length,
    success: metrics.success,
    failed: metrics.failed,
    skipped,
    message,
    providerRunsStarted: metrics.providerRunsStarted,
    skippedFresh: metrics.skippedFresh,
    skippedNonRetriable: metrics.skippedNonRetriable,
    estimatedRunsSaved: metrics.estimatedRunsSaved,
  };
}
