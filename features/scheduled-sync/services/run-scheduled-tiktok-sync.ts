import "server-only";

import { revalidatePath } from "next/cache";

import {
  prefetchCreatorBatchesForCampaigns,
  syncCampaignTikTokCreators,
} from "@/features/creator-sync/services/sync-tiktok-creator";
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
import { buildGlobalTikTokSyncPlan } from "@/features/sync/services/build-global-sync-plan";
import {
  syncCampaignTikTokVideos,
  type TikTokSyncOperationCache,
} from "@/features/sync/services/sync-tiktok-video";
import { isTikTokSoundUrl } from "@/lib/providers/tiktok/sound-url";
import { createServiceClient } from "@/lib/supabase/admin";

const DEFAULT_MAX_DURATION_MS = 300_000;

function createScheduledSyncPort(
  supabase: SyncDbClient,
  operationCache: TikTokSyncOperationCache
): ScheduledSyncPort {
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
      syncCampaignTikTokVideos(campaignId, undefined, {
        client: supabase,
        force: false,
        manualCooldown: false,
        operationCache,
      }),

    syncCampaignCreators: (campaignId) =>
      syncCampaignTikTokCreators(campaignId, undefined, {
        client: supabase,
        force: false,
        manualCooldown: false,
        operationCache,
      }),

    syncCampaignSound: (campaignId) =>
      syncTikTokSound(campaignId, undefined, {
        client: supabase,
        force: false,
        manualCooldown: false,
      }),

    async buildSyncPlan(campaignIds) {
      const plan = await buildGlobalTikTokSyncPlan(supabase, campaignIds);
      return {
        totalEntities: plan.totalEntities,
        freshSkipped: plan.freshSkipped,
        staleEligible: plan.staleEligible,
        nonRetriable: plan.nonRetriable,
        skippedUnavailable: plan.skippedUnavailable,
        estimatedProviderRuns: plan.estimatedProviderRuns,
        plannedVideoBatches: plan.plannedVideoBatches,
        plannedCreatorBatches: plan.plannedCreatorBatches,
        plannedSoundRuns: plan.plannedSoundRuns,
      };
    },

    async prefetchCreatorBatches(campaignIds) {
      await prefetchCreatorBatchesForCampaigns(campaignIds, operationCache, {
        client: supabase,
        force: false,
      });
    },

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
  const operationCache: TikTokSyncOperationCache = {
    videoResults: new Map(),
    creatorResults: new Map(),
    actorRunsStarted: { value: 0 },
  };
  const port = createScheduledSyncPort(supabase, operationCache);
  const maxDurationMs = input.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;

  const summary = await runScheduledTikTokSync(port, {
    triggeredBy: input.triggeredBy,
    deadlineMs: Date.now() + maxDurationMs,
  });

  // Prefer the real Apify start counter from the shared operation cache.
  return {
    ...summary,
    providerRunsStarted: operationCache.actorRunsStarted.value,
    message: [
      summary.plan
        ? [
            `Plan: ${summary.plan.totalEntities} varlık`,
            `${summary.plan.freshSkipped} zaten günceldi`,
            `${summary.plan.staleEligible} senkronize edilecek`,
            summary.plan.skippedUnavailable > 0
              ? `${summary.plan.skippedUnavailable} hesap erişilemiyor / pasif`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : null,
      `${summary.video.success} güncellendi`,
      `${summary.video.skipped} zaten günceldi`,
      summary.video.failed > 0 ? `${summary.video.failed} başarısız` : null,
      `${operationCache.actorRunsStarted.value} sağlayıcı çalıştırması kullanıldı`,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Sanitized JSON body for HTTP responses — strips internal debug-only fields. */
export function toPublicScheduledSyncSummary(
  summary: ScheduledSyncSummary
): Omit<ScheduledSyncSummary, never> {
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
    plan: summary.plan,
    providerRunsStarted: summary.providerRunsStarted,
    message: summary.message,
  };
}
