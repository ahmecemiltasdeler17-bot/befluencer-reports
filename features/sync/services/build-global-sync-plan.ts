import "server-only";

import {
  chunkArray,
  dedupePreserveOrder,
  evaluateCreatorSyncEligibility,
  evaluateSoundSyncEligibility,
  evaluateVideoSyncEligibility,
} from "@/lib/providers/tiktok/sync-eligibility";
import {
  CREATOR_BATCH_SIZE,
  VIDEO_BATCH_SIZE,
} from "@/lib/providers/tiktok/sync-policy";
import {
  emptyGlobalSyncPlan,
  type GlobalSyncPlan,
} from "@/lib/providers/tiktok/sync-observability";
import type { SyncDbClient } from "@/features/sync/db-client";
import { isTikTokSoundUrl } from "@/lib/providers/tiktok/sound-url";

/**
 * Builds a cost plan for global TikTok sync without mutating report data.
 * Counts freshness / non-retriable / planned actor batches only.
 */
export async function buildGlobalTikTokSyncPlan(
  supabase: SyncDbClient,
  campaignIds: string[],
  nowMs: number = Date.now()
): Promise<GlobalSyncPlan> {
  const plan = emptyGlobalSyncPlan();

  if (campaignIds.length === 0) {
    return plan;
  }

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(
      "id, status, sound_url, sound_last_synced_at, sound_sync_status, sound_sync_error"
    )
    .in("id", campaignIds);

  const campaignById = new Map(
    (campaigns ?? []).map((row) => [row.id as string, row])
  );

  const { data: videos } = await supabase
    .from("videos")
    .select(
      "id, campaign_id, video_url, platform_video_id, last_synced_at, sync_status, status, platform"
    )
    .in("campaign_id", campaignIds)
    .eq("platform", "tiktok")
    .neq("status", "unavailable");

  const videoKeys: string[] = [];
  for (const video of videos ?? []) {
    plan.totalEntities += 1;
    const campaign = campaignById.get(video.campaign_id as string);
    const decision = evaluateVideoSyncEligibility({
      lastSyncedAt: video.last_synced_at as string | null,
      syncStatus: video.sync_status as string | null,
      campaignStatus: (campaign?.status as string) ?? null,
      nowMs,
    });
    if (!decision.eligible) {
      if (decision.reason === "non_retriable") {
        plan.nonRetriable += 1;
      } else {
        plan.freshSkipped += 1;
      }
      continue;
    }
    plan.staleEligible += 1;
    const key =
      (video.platform_video_id as string | null) ??
      (video.video_url as string);
    videoKeys.push(key);
  }

  const uniqueVideoKeys = dedupePreserveOrder(videoKeys);
  plan.plannedVideoBatches = chunkArray(
    uniqueVideoKeys,
    VIDEO_BATCH_SIZE
  ).length;

  const { data: assignments } = await supabase
    .from("campaign_creators")
    .select("creator_id, campaign_id")
    .in("campaign_id", campaignIds);

  const creatorIds = dedupePreserveOrder(
    (assignments ?? []).map((row) => row.creator_id as string)
  );

  if (creatorIds.length > 0) {
    const { data: creators } = await supabase
      .from("creators")
      .select(
        "id, username, platform, last_synced_at, sync_status, account_status"
      )
      .in("id", creatorIds)
      .eq("platform", "tiktok");

    const creatorKeys: string[] = [];
    for (const creator of creators ?? []) {
      plan.totalEntities += 1;
      const decision = evaluateCreatorSyncEligibility({
        lastSyncedAt: creator.last_synced_at as string | null,
        syncStatus: creator.sync_status as string | null,
        accountStatus: (creator.account_status as string | null) ?? "active",
        nowMs,
      });
      if (!decision.eligible) {
        if (decision.reason === "unavailable_account") {
          plan.skippedUnavailable += 1;
        } else if (decision.reason === "non_retriable") {
          plan.nonRetriable += 1;
        } else {
          plan.freshSkipped += 1;
        }
        continue;
      }
      plan.staleEligible += 1;
      creatorKeys.push(
        ((creator.username as string) ?? "").trim().toLowerCase()
      );
    }

    plan.plannedCreatorBatches = chunkArray(
      dedupePreserveOrder(creatorKeys.filter(Boolean)),
      CREATOR_BATCH_SIZE
    ).length;
  }

  for (const campaign of campaigns ?? []) {
    const soundUrl = campaign.sound_url as string | null;
    if (!soundUrl || !isTikTokSoundUrl(soundUrl)) {
      continue;
    }
    plan.totalEntities += 1;
    const decision = evaluateSoundSyncEligibility({
      lastSyncedAt: campaign.sound_last_synced_at as string | null,
      syncStatus: campaign.sound_sync_status as string | null,
      campaignStatus: campaign.status as string | null,
      nowMs,
    });
    if (!decision.eligible) {
      if (decision.reason === "non_retriable") {
        plan.nonRetriable += 1;
      } else {
        plan.freshSkipped += 1;
      }
      continue;
    }
    plan.staleEligible += 1;
    plan.plannedSoundRuns += 1;
  }

  plan.estimatedProviderRuns =
    plan.plannedVideoBatches +
    plan.plannedCreatorBatches +
    plan.plannedSoundRuns;

  return plan;
}
