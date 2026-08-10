import "server-only";

import { revalidatePath } from "next/cache";

import {
  runSoundSync,
  UUID_PATTERN,
  type SoundSyncPatch,
  type SoundSyncPort,
} from "@/features/sound-sync/services/sound-sync-core";
import type {
  CampaignSoundConfiguration,
  SoundMetricSnapshot,
  SyncSoundResult,
} from "@/features/sound-sync/types";
import type { SyncDbClient } from "@/features/sync/db-client";
import { isTikTokSoundSyncConfigured } from "@/lib/env.server";
import {
  createApifyTikTokProvider,
  TikTokProviderError,
} from "@/lib/providers/tiktok";
import type { TikTokSoundProvider } from "@/lib/providers/tiktok/types";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>> | SyncDbClient;

export type SyncSoundOptions = {
  client?: SyncDbClient;
  force?: boolean;
  manualCooldown?: boolean;
};

function mapSupabaseMutationError(message: string, code?: string): string {
  if (code === "23505" || message.toLowerCase().includes("duplicate")) {
    return "Ses kullanım kaydı zaman çakışması nedeniyle oluşturulamadı.";
  }

  if (message.toLowerCase().includes("permission denied")) {
    return "Bu işlem için yetkiniz yok.";
  }

  return "Senkronizasyon kaydedilemedi.";
}

async function requireAuthenticatedClient(): Promise<SupabaseClient> {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  return supabase;
}

async function resolveClient(
  options?: SyncSoundOptions
): Promise<SupabaseClient> {
  return options?.client ?? (await requireAuthenticatedClient());
}

function resolveProvider(
  provider?: TikTokSoundProvider
): TikTokSoundProvider {
  if (provider) {
    return provider;
  }

  if (!isTikTokSoundSyncConfigured()) {
    throw new TikTokProviderError("not_configured");
  }

  return createApifyTikTokProvider();
}

async function revalidateSoundPaths(campaignId: string): Promise<void> {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/report`);
  revalidatePath(`/campaigns/${campaignId}/reports`);
}

function mapConfiguration(row: Record<string, unknown>): CampaignSoundConfiguration {
  return {
    campaignId: row.id as string,
    soundUrl: (row.sound_url as string | null) ?? null,
    soundId: (row.tiktok_sound_id as string | null) ?? null,
    soundTitle: (row.tiktok_sound_title as string | null) ?? null,
    soundAuthor: (row.tiktok_sound_author as string | null) ?? null,
    soundCoverUrl: (row.tiktok_sound_cover_url as string | null) ?? null,
    lastSyncedAt: (row.sound_last_synced_at as string | null) ?? null,
    syncStatus: (row.sound_sync_status as CampaignSoundConfiguration["syncStatus"]) ??
      "pending",
    syncError: (row.sound_sync_error as string | null) ?? null,
  };
}

function mapSnapshot(row: Record<string, unknown>): SoundMetricSnapshot {
  return {
    id: row.id as string,
    campaign_id: row.campaign_id as string,
    captured_at: row.captured_at as string,
    usage_count: Number(row.usage_count),
    source: ((row.source as string | undefined) ?? "manual") as
      | "manual"
      | "apify",
    metric_type: row.metric_type === "cluster" ? "cluster" : "original",
    note: (row.note as string | null | undefined) ?? null,
    created_at: (row.created_at as string | undefined) ?? (row.captured_at as string),
  };
}

async function insertSnapshotWithRetry(
  supabase: SupabaseClient,
  campaignId: string,
  usageCount: number,
  source: "apify"
): Promise<{ ok: true } | { ok: false; message: string }> {
  const attemptInsert = (capturedAt: string) =>
    supabase.from("sound_metric_snapshots").insert({
      campaign_id: campaignId,
      captured_at: capturedAt,
      usage_count: usageCount,
      source,
      metric_type: "original",
    });

  let result = await attemptInsert(new Date().toISOString());

  if (result.error?.code === "23505") {
    result = await attemptInsert(new Date(Date.now() + 1000).toISOString());
  }

  if (result.error) {
    return {
      ok: false,
      message: mapSupabaseMutationError(result.error.message, result.error.code),
    };
  }

  return { ok: true };
}

function createSoundSyncPort(supabase: SupabaseClient): SoundSyncPort {
  return {
    async loadConfiguration(campaignId) {
      const { data, error } = await supabase
        .from("campaigns")
        .select(
          "id, sound_url, tiktok_sound_id, tiktok_sound_title, tiktok_sound_author, tiktok_sound_cover_url, sound_last_synced_at, sound_sync_status, sound_sync_error"
        )
        .eq("id", campaignId)
        .maybeSingle();

      if (error) {
        throw new Error(mapSupabaseMutationError(error.message, error.code));
      }

      if (!data) {
        return null;
      }

      return mapConfiguration(data as Record<string, unknown>);
    },

    async createJob(campaignId, startedAt) {
      const { data, error } = await supabase
        .from("sync_jobs")
        .insert({
          campaign_id: campaignId,
          job_type: "tiktok_sound_sync",
          status: "running",
          started_at: startedAt,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(
          mapSupabaseMutationError(error?.message ?? "", error?.code)
        );
      }

      return data.id as string;
    },

    async getLatestSnapshot(campaignId) {
      const { data, error } = await supabase
        .from("sound_metric_snapshots")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("metric_type", "original")
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(mapSupabaseMutationError(error.message, error.code));
      }

      return data ? mapSnapshot(data as Record<string, unknown>) : null;
    },

    async insertSnapshot(campaignId, usageCount, source) {
      const result = await insertSnapshotWithRetry(
        supabase,
        campaignId,
        usageCount,
        source
      );

      if (!result.ok) {
        throw new Error(result.message);
      }
    },

    async updateCampaign(campaignId, patch: SoundSyncPatch) {
      const { error } = await supabase
        .from("campaigns")
        .update(patch)
        .eq("id", campaignId);

      if (error) {
        throw new Error(mapSupabaseMutationError(error.message, error.code));
      }
    },

    async markCampaignFailed(campaignId, errorMessage) {
      await supabase
        .from("campaigns")
        .update({
          sound_sync_status: "failed",
          sound_sync_error: errorMessage,
        })
        .eq("id", campaignId);
    },

    async completeJob(jobId, status, completedAt, errorMessage) {
      await supabase
        .from("sync_jobs")
        .update({
          status,
          completed_at: completedAt,
          error_message: errorMessage,
        })
        .eq("id", jobId);
    },

    async revalidate(campaignId) {
      await revalidateSoundPaths(campaignId);
    },
  };
}

/**
 * Refreshes one campaign's TikTok sound usage count.
 *
 * Failure never destroys data: previous sound metadata and snapshots stay
 * untouched; only sound_sync_status / sound_sync_error are updated.
 */
export async function syncTikTokSound(
  campaignId: string,
  provider?: TikTokSoundProvider,
  options?: SyncSoundOptions
): Promise<SyncSoundResult> {
  if (!UUID_PATTERN.test(campaignId)) {
    return {
      outcome: "failed",
      message: "Geçersiz kampanya kimliği.",
      snapshotCreated: false,
      usageCount: null,
      jobId: null,
    };
  }

  const supabase = await resolveClient(options);

  let soundProvider: TikTokSoundProvider;

  try {
    soundProvider = resolveProvider(provider);
  } catch (error) {
    return {
      outcome: "failed",
      message:
        error instanceof TikTokProviderError
          ? error.toUserMessage()
          : "TikTok ses senkronizasyonu yapılandırılmamış.",
      snapshotCreated: false,
      usageCount: null,
      jobId: null,
    };
  }

  const { data: campaignRow } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle();

  return runSoundSync(
    campaignId,
    soundProvider,
    createSoundSyncPort(supabase),
    () => new Date(),
    {
      force: options?.force,
      // Scheduled / campaign sync should not apply the short manual cooldown.
      manualCooldown: options?.manualCooldown ?? Boolean(!options?.client),
      campaignStatus: (campaignRow?.status as string) ?? null,
    }
  );
}
