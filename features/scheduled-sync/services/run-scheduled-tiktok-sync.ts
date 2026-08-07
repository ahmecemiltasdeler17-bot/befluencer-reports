import "server-only";

import { revalidatePath } from "next/cache";

import { syncCampaignTikTokCreators } from "@/features/creator-sync/services/sync-tiktok-creator";
import {
  runScheduledTikTokSync,
  type ScheduledSyncPort,
} from "@/features/scheduled-sync/services/scheduled-sync-core";
import type {
  EligibleCampaign,
  ScheduledSyncSummary,
  ScheduledSyncTrigger,
} from "@/features/scheduled-sync/types";
import { syncTikTokSound } from "@/features/sound-sync/services/sync-tiktok-sound";
import type { SyncDbClient } from "@/features/sync/db-client";
import { syncCampaignTikTokVideos } from "@/features/sync/services/sync-tiktok-video";
import { isTikTokSoundUrl } from "@/lib/providers/tiktok/sound-url";
import { createServiceClient } from "@/lib/supabase/admin";

const DEFAULT_MAX_DURATION_MS = 300_000;

function createScheduledSyncPort(supabase: SyncDbClient): ScheduledSyncPort {
  return {
    async tryAcquireLock() {
      const { data, error } = await supabase.rpc(
        "try_acquire_scheduled_sync_lock"
      );

      if (error) {
        throw new Error("Senkronizasyon kilidi alınamadı.");
      }

      return Boolean(data);
    },

    async releaseLock() {
      await supabase.rpc("release_scheduled_sync_lock");
    },

    async listEligibleCampaigns() {
      return listEligibleCampaignsWithClient(supabase);
    },

    async createRun({ triggeredBy, startedAt }) {
      const { data, error } = await supabase
        .from("scheduled_sync_runs")
        .insert({
          run_type: "full_tiktok_sync",
          status: "running",
          triggered_by: triggeredBy,
          started_at: startedAt,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error("Senkronizasyon kaydı oluşturulamadı.");
      }

      return data.id as string;
    },

    async completeRun(runId, patch) {
      const { error } = await supabase
        .from("scheduled_sync_runs")
        .update({
          status: patch.status,
          completed_at: patch.completedAt,
          total_campaigns: patch.totalCampaigns,
          successful_campaigns: patch.successfulCampaigns,
          failed_campaigns: patch.failedCampaigns,
          skipped_campaigns: patch.skippedCampaigns,
          video_success: patch.videoSuccess,
          video_failed: patch.videoFailed,
          creator_success: patch.creatorSuccess,
          creator_failed: patch.creatorFailed,
          sound_success: patch.soundSuccess,
          sound_failed: patch.soundFailed,
          error_message: patch.errorMessage,
        })
        .eq("id", runId);

      if (error) {
        throw new Error("Senkronizasyon kaydı güncellenemedi.");
      }
    },

    syncCampaignVideos: (campaignId) =>
      syncCampaignTikTokVideos(campaignId, undefined, { client: supabase }),

    syncCampaignCreators: (campaignId) =>
      syncCampaignTikTokCreators(campaignId, undefined, { client: supabase }),

    syncCampaignSound: (campaignId) =>
      syncTikTokSound(campaignId, undefined, { client: supabase }),

    async revalidateCampaign(campaignId) {
      revalidatePath(`/campaigns/${campaignId}`);
      revalidatePath(`/campaigns/${campaignId}/report`);
      revalidatePath("/campaigns");
      revalidatePath("/settings/sync");
    },
  };
}

export async function listEligibleCampaignsWithClient(
  supabase: SyncDbClient
): Promise<EligibleCampaign[]> {
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name, status, sound_url")
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("Kampanyalar yüklenemedi.");
  }

  const rows = campaigns ?? [];
  if (rows.length === 0) {
    return [];
  }

  const campaignIds = rows.map((row) => row.id as string);

  const [videosResult, creatorsResult] = await Promise.all([
    supabase
      .from("videos")
      .select("campaign_id")
      .in("campaign_id", campaignIds)
      .eq("platform", "tiktok")
      .neq("status", "unavailable"),
    supabase
      .from("campaign_creators")
      .select("campaign_id, creator:creators(platform)")
      .in("campaign_id", campaignIds),
  ]);

  if (videosResult.error || creatorsResult.error) {
    throw new Error("Kampanya hedefleri yüklenemedi.");
  }

  const videoCampaignIds = new Set(
    (videosResult.data ?? []).map((row) => row.campaign_id as string)
  );

  const creatorCampaignIds = new Set<string>();
  for (const row of creatorsResult.data ?? []) {
    const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
    if (
      creator &&
      typeof creator === "object" &&
      "platform" in creator &&
      (creator as { platform: string }).platform === "tiktok"
    ) {
      creatorCampaignIds.add(row.campaign_id as string);
    }
  }

  const eligible: EligibleCampaign[] = [];

  for (const row of rows) {
    const soundUrl = (row.sound_url as string | null) ?? null;
    const hasSoundUrl = Boolean(soundUrl && isTikTokSoundUrl(soundUrl));
    const hasTikTokVideo = videoCampaignIds.has(row.id as string);
    const hasTikTokCreator = creatorCampaignIds.has(row.id as string);

    if (!hasTikTokVideo && !hasTikTokCreator && !hasSoundUrl) {
      continue;
    }

    eligible.push({
      id: row.id as string,
      name: row.name as string,
      status: row.status as string,
      soundUrl,
      hasTikTokVideo,
      hasTikTokCreator,
      hasSoundUrl,
    });
  }

  return eligible;
}

/**
 * Runs the full TikTok sync using the service-role client.
 * Callers must already authenticate (cron secret or verified user session).
 */
export async function executeScheduledTikTokSync(input: {
  triggeredBy: ScheduledSyncTrigger;
  maxDurationMs?: number;
}): Promise<ScheduledSyncSummary> {
  const supabase = createServiceClient();
  const port = createScheduledSyncPort(supabase);
  const maxDurationMs = input.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;

  return runScheduledTikTokSync(port, {
    triggeredBy: input.triggeredBy,
    deadlineMs: Date.now() + maxDurationMs,
  });
}

/** Sanitized JSON body for HTTP responses — strips internal message. */
export function toPublicScheduledSyncSummary(
  summary: ScheduledSyncSummary
): Omit<ScheduledSyncSummary, "message"> {
  return {
    runId: summary.runId,
    status: summary.status,
    startedAt: summary.startedAt,
    completedAt: summary.completedAt,
    totalCampaigns: summary.totalCampaigns,
    successfulCampaigns: summary.successfulCampaigns,
    failedCampaigns: summary.failedCampaigns,
    skippedCampaigns: summary.skippedCampaigns,
    video: summary.video,
    creators: summary.creators,
    sound: summary.sound,
  };
}
