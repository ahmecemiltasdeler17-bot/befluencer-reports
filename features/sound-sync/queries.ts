import "server-only";

import {
  buildSoundDailyGrowthSeries,
  computeSoundMetricSummary,
  filterSoundSnapshotsByMetricType,
} from "@/features/sound-sync/calculations";
import type {
  CampaignSoundConfiguration,
  SoundDailyGrowthPoint,
  SoundMetricSnapshot,
  SoundMetricSummary,
  SoundMetricType,
  SoundSyncJob,
} from "@/features/sound-sync/types";
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

function mapSnapshot(row: Record<string, unknown>): SoundMetricSnapshot {
  const metricType =
    row.metric_type === "cluster" ? "cluster" : ("original" as const);

  return {
    id: row.id as string,
    campaign_id: row.campaign_id as string,
    captured_at: row.captured_at as string,
    usage_count: Number(row.usage_count),
    source: ((row.source as string | undefined) ?? "manual") as
      | "manual"
      | "apify",
    metric_type: metricType,
    note: (row.note as string | null | undefined) ?? null,
    created_at:
      (row.created_at as string | undefined) ?? (row.captured_at as string),
  };
}

export async function getCampaignSoundConfiguration(
  campaignId: string
): Promise<CampaignSoundConfiguration | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, sound_url, tiktok_sound_id, tiktok_sound_title, tiktok_sound_author, tiktok_sound_cover_url, sound_last_synced_at, sound_sync_status, sound_sync_error"
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  if (!data) {
    return null;
  }

  return {
    campaignId: data.id as string,
    soundUrl: (data.sound_url as string | null) ?? null,
    soundId: (data.tiktok_sound_id as string | null) ?? null,
    soundTitle: (data.tiktok_sound_title as string | null) ?? null,
    soundAuthor: (data.tiktok_sound_author as string | null) ?? null,
    soundCoverUrl: (data.tiktok_sound_cover_url as string | null) ?? null,
    lastSyncedAt: (data.sound_last_synced_at as string | null) ?? null,
    syncStatus:
      (data.sound_sync_status as CampaignSoundConfiguration["syncStatus"]) ??
      "pending",
    syncError: (data.sound_sync_error as string | null) ?? null,
  };
}

export async function listSoundMetricSnapshots(
  campaignId: string,
  metricType?: SoundMetricType
): Promise<SoundMetricSnapshot[]> {
  const supabase = await requireAuthenticatedClient();

  let query = supabase
    .from("sound_metric_snapshots")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("captured_at", { ascending: false });

  if (metricType) {
    query = query.eq("metric_type", metricType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  const mapped = (data ?? []).map((row) =>
    mapSnapshot(row as Record<string, unknown>)
  );

  // Defensive client-side filter if DB column is not yet migrated.
  return metricType
    ? filterSoundSnapshotsByMetricType(mapped, metricType)
    : mapped;
}

export async function getLatestSoundMetricSnapshot(
  campaignId: string,
  metricType: SoundMetricType = "original"
): Promise<SoundMetricSnapshot | null> {
  const snapshots = await listSoundMetricSnapshots(campaignId, metricType);
  return snapshots[0] ?? null;
}

export async function getFirstSoundMetricSnapshot(
  campaignId: string,
  metricType: SoundMetricType = "original"
): Promise<SoundMetricSnapshot | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("sound_metric_snapshots")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("metric_type", metricType)
    .order("captured_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return data ? mapSnapshot(data as Record<string, unknown>) : null;
}

export async function getSoundMetricSummary(
  campaignId: string,
  metricType: SoundMetricType = "original"
): Promise<SoundMetricSummary> {
  const snapshots = await listSoundMetricSnapshots(campaignId, metricType);
  return computeSoundMetricSummary(snapshots);
}

export async function getSoundDailyGrowthSeries(
  campaignId: string,
  metricType: SoundMetricType = "original"
): Promise<SoundDailyGrowthPoint[]> {
  const snapshots = await listSoundMetricSnapshots(campaignId, metricType);
  return buildSoundDailyGrowthSeries(snapshots);
}

export async function listSoundSyncJobs(
  campaignId: string,
  limit = 10
): Promise<SoundSyncJob[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("sync_jobs")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("job_type", "tiktok_sound_sync")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []) as SoundSyncJob[];
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

  return data ? mapSnapshot(data as Record<string, unknown>) : null;
}
