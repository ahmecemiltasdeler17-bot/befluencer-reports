import {
  buildCampaignAudienceSummary,
  buildCreatorMetricHistory,
  buildCreatorMetricSummary,
} from "@/features/creator-sync/calculations";
import type {
  CampaignAudienceSummary,
  CreatorMetricHistoryRow,
  CreatorMetricSnapshot,
  CreatorMetricSummary,
  CreatorSyncStatus,
  CreatorSyncSummary,
} from "@/features/creator-sync/types";
import type { CreatorPlatform } from "@/features/creators/types";
import type { SyncJob } from "@/features/sync/types";
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

/** Postgres bigint arrives as a string over the wire. */
function mapSnapshot(row: CreatorMetricSnapshot): CreatorMetricSnapshot {
  return {
    ...row,
    follower_count: Number(row.follower_count),
    following_count:
      row.following_count === null ? null : Number(row.following_count),
    total_likes: row.total_likes === null ? null : Number(row.total_likes),
    video_count: row.video_count === null ? null : Number(row.video_count),
  };
}

export async function listCreatorMetricSnapshots(
  creatorId: string
): Promise<CreatorMetricSnapshot[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("creator_metric_snapshots")
    .select("*")
    .eq("creator_id", creatorId)
    .order("captured_at", { ascending: true });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return ((data ?? []) as CreatorMetricSnapshot[]).map(mapSnapshot);
}

export async function getLatestCreatorMetricSnapshot(
  creatorId: string
): Promise<CreatorMetricSnapshot | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("creator_metric_snapshots")
    .select("*")
    .eq("creator_id", creatorId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return data ? mapSnapshot(data as CreatorMetricSnapshot) : null;
}

export async function getFirstCreatorMetricSnapshot(
  creatorId: string
): Promise<CreatorMetricSnapshot | null> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("creator_metric_snapshots")
    .select("*")
    .eq("creator_id", creatorId)
    .order("captured_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return data ? mapSnapshot(data as CreatorMetricSnapshot) : null;
}

export async function getCreatorMetricSummary(
  creatorId: string,
  creatorFollowerCount: number
): Promise<CreatorMetricSummary> {
  const snapshots = await listCreatorMetricSnapshots(creatorId);
  return buildCreatorMetricSummary(snapshots, creatorFollowerCount);
}

export async function buildCreatorFollowerHistory(
  creatorId: string
): Promise<CreatorMetricHistoryRow[]> {
  const snapshots = await listCreatorMetricSnapshots(creatorId);
  return buildCreatorMetricHistory(snapshots);
}

type CreatorSyncRow = {
  id: string;
  username: string;
  display_name: string | null;
  platform: CreatorPlatform;
  follower_count: number;
  last_synced_at: string | null;
  sync_status: CreatorSyncStatus;
};

/**
 * An embedded to-one relation is typed as an array when Supabase cannot infer
 * cardinality from a projected column list. Both shapes describe one creator.
 */
function firstEmbedded<T>(value: unknown): T | null {
  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }

  return (value as T | null) ?? null;
}

/**
 * Reads sync state plus follower growth for every creator assigned to a
 * campaign. One snapshot query covers all of them, so adding creators does not
 * add round trips.
 */
export async function listCampaignCreatorSyncSummaries(
  campaignId: string
): Promise<CreatorSyncSummary[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("campaign_creators")
    .select(
      `
      creator:creators (
        id,
        username,
        display_name,
        platform,
        follower_count,
        last_synced_at,
        sync_status
      )
    `
    )
    .eq("campaign_id", campaignId);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  const creators = new Map<string, CreatorSyncRow>();

  for (const row of data ?? []) {
    const creator = firstEmbedded<CreatorSyncRow>(row.creator);

    if (creator && !creators.has(creator.id)) {
      creators.set(creator.id, creator);
    }
  }

  if (creators.size === 0) {
    return [];
  }

  const snapshotsByCreator = await listSnapshotsForCreators([...creators.keys()]);

  return [...creators.values()].map((creator) => {
    const summary = buildCreatorMetricSummary(
      snapshotsByCreator.get(creator.id) ?? [],
      Number(creator.follower_count)
    );

    return {
      creatorId: creator.id,
      username: creator.username,
      displayName: creator.display_name,
      platform: creator.platform,
      currentFollowers: summary.currentFollowers,
      absoluteGrowth: summary.absoluteGrowth,
      growthPercentage: summary.growthPercentage,
      lastSyncedAt: creator.last_synced_at,
      syncStatus: creator.sync_status ?? "pending",
    };
  });
}

async function listSnapshotsForCreators(
  creatorIds: string[]
): Promise<Map<string, CreatorMetricSnapshot[]>> {
  const supabase = await requireAuthenticatedClient();
  const grouped = new Map<string, CreatorMetricSnapshot[]>();

  if (creatorIds.length === 0) {
    return grouped;
  }

  const { data, error } = await supabase
    .from("creator_metric_snapshots")
    .select("*")
    .in("creator_id", creatorIds)
    .order("captured_at", { ascending: true });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  for (const row of (data ?? []) as CreatorMetricSnapshot[]) {
    const bucket = grouped.get(row.creator_id) ?? [];
    bucket.push(mapSnapshot(row));
    grouped.set(row.creator_id, bucket);
  }

  return grouped;
}

export type CreatorGrowth = {
  currentFollowers: number;
  absoluteGrowth: number | null;
  growthPercentage: number | null;
};

/**
 * Growth for an explicit set of creators, in one snapshot query.
 *
 * Used by the creator list, which already has the creator rows and only needs
 * the growth overlay — so this avoids re-reading the creators table.
 */
export async function listCreatorGrowthByIds(
  creators: Array<{ id: string; follower_count: number }>
): Promise<Map<string, CreatorGrowth>> {
  const growth = new Map<string, CreatorGrowth>();

  if (creators.length === 0) {
    return growth;
  }

  const snapshotsByCreator = await listSnapshotsForCreators(
    creators.map((creator) => creator.id)
  );

  for (const creator of creators) {
    const summary = buildCreatorMetricSummary(
      snapshotsByCreator.get(creator.id) ?? [],
      Number(creator.follower_count)
    );

    growth.set(creator.id, {
      currentFollowers: summary.currentFollowers,
      absoluteGrowth: summary.absoluteGrowth,
      growthPercentage: summary.growthPercentage,
    });
  }

  return growth;
}

export async function getCampaignAudienceSummary(
  campaignId: string
): Promise<CampaignAudienceSummary> {
  const summaries = await listCampaignCreatorSyncSummaries(campaignId);

  return buildCampaignAudienceSummary(
    summaries.map((summary) => ({
      creatorId: summary.creatorId,
      currentFollowers: summary.currentFollowers,
      initialFollowers:
        summary.absoluteGrowth === null
          ? null
          : summary.currentFollowers - summary.absoluteGrowth,
    }))
  );
}

export async function listCreatorSyncJobs(
  creatorId: string,
  limit = 10
): Promise<SyncJob[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("sync_jobs")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("job_type", "tiktok_creator_sync")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []) as SyncJob[];
}

/**
 * Creator sync jobs for creators currently assigned to a campaign. Creator sync
 * jobs carry no campaign id — a creator is global — so the campaign scope is
 * resolved through the assignment table.
 */
export async function listCampaignCreatorSyncJobs(
  campaignId: string,
  limit = 20
): Promise<SyncJob[]> {
  const supabase = await requireAuthenticatedClient();

  const { data: assignments, error: assignmentError } = await supabase
    .from("campaign_creators")
    .select("creator_id")
    .eq("campaign_id", campaignId);

  if (assignmentError) {
    throw new Error(mapSupabaseError(assignmentError.message));
  }

  const creatorIds = [
    ...new Set((assignments ?? []).map((row) => row.creator_id as string)),
  ];

  if (creatorIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("sync_jobs")
    .select("*")
    .in("creator_id", creatorIds)
    .eq("job_type", "tiktok_creator_sync")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []) as SyncJob[];
}

/** Campaign ids a creator is assigned to — used to revalidate affected reports. */
export async function listCampaignIdsForCreator(
  creatorId: string,
  client?: SyncDbClient
): Promise<string[]> {
  const supabase = await resolveClient(client);

  const { data, error } = await supabase
    .from("campaign_creators")
    .select("campaign_id")
    .eq("creator_id", creatorId);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return [...new Set((data ?? []).map((row) => row.campaign_id as string))];
}
