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
  TikTokProviderError,
  toTurkishProviderMessage,
} from "@/lib/providers/tiktok";
import {
  isValidThumbnailUrl,
  logThumbnailDiagnostics,
  resolveStoredThumbnailUrl,
} from "@/lib/providers/tiktok/select-video-thumbnail";
import type { TikTokMetricsProvider } from "@/lib/providers/tiktok/types";
import { assertApprovedTikTokUrl } from "@/lib/providers/tiktok/url";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type SyncTikTokOptions = {
  /** When provided, skips cookie-session auth (used by scheduled sync). */
  client?: SyncDbClient;
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

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += limit) {
    const batch = items.slice(index, index + limit);
    const batchResults = await Promise.all(batch.map(worker));
    results.push(...batchResults);
  }

  return results;
}

export async function syncCampaignTikTokVideos(
  campaignId: string,
  provider?: TikTokMetricsProvider,
  options?: SyncTikTokOptions
): Promise<SyncCampaignResult> {
  const supabase = await resolveClient(options);

  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, platform, status")
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

  const candidates = videos ?? [];
  let success = 0;
  let failed = 0;
  let skipped = 0;

  const results = await mapWithConcurrency(candidates, 2, (video) =>
    syncTikTokVideo(video.id as string, provider, { client: supabase })
  );

  for (const result of results) {
    if (result.outcome === "success") {
      success += 1;
    } else if (result.outcome === "failed") {
      failed += 1;
    } else {
      skipped += 1;
    }
  }

  revalidatePath(`/campaigns/${campaignId}`);

  const message =
    failed === 0
      ? `${success} TikTok videosu güncellendi${skipped > 0 ? `, ${skipped} atlandı` : ""}.`
      : `${success} başarılı, ${failed} başarısız${skipped > 0 ? `, ${skipped} atlandı` : ""}.`;

  return {
    total: candidates.length,
    success,
    failed,
    skipped,
    message,
  };
}
