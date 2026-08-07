import "server-only";

import { revalidatePath } from "next/cache";

import type { CreatorSnapshotCandidate } from "@/features/creator-sync/calculations";
import { listCampaignIdsForCreator } from "@/features/creator-sync/queries";
import {
  runCampaignCreatorSync,
  runCreatorSync,
  UUID_PATTERN,
  type CampaignCreatorSyncPort,
  type CreatorSyncPatch,
  type CreatorSyncPort,
  type CreatorSyncRecord,
} from "@/features/creator-sync/services/creator-sync-core";
import type {
  CreatorMetricSnapshot,
  SyncCampaignCreatorsResult,
  SyncCreatorResult,
} from "@/features/creator-sync/types";
import type { SyncDbClient } from "@/features/sync/db-client";
import { isTikTokSyncConfigured } from "@/lib/env.server";
import {
  createApifyTikTokProvider,
  TikTokProviderError,
} from "@/lib/providers/tiktok";
import type { TikTokCreatorProvider } from "@/lib/providers/tiktok/types";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>> | SyncDbClient;

export type SyncCreatorOptions = {
  client?: SyncDbClient;
};

function mapSupabaseMutationError(message: string, code?: string): string {
  if (code === "23505" || message.toLowerCase().includes("duplicate")) {
    return "Takipçi kaydı zaman çakışması nedeniyle oluşturulamadı.";
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
  options?: SyncCreatorOptions
): Promise<SupabaseClient> {
  return options?.client ?? (await requireAuthenticatedClient());
}

function resolveProvider(
  provider?: TikTokCreatorProvider
): TikTokCreatorProvider {
  if (provider) {
    return provider;
  }

  if (!isTikTokSyncConfigured()) {
    throw new TikTokProviderError("not_configured");
  }

  return createApifyTikTokProvider();
}

/**
 * A creator is global, so a refreshed profile affects the creator screens and
 * every campaign it is assigned to, including each campaign's live report.
 * Generated report versions are immutable and are deliberately not revalidated.
 */
async function revalidateCreatorPaths(
  creatorId: string,
  client?: SyncDbClient
): Promise<void> {
  revalidatePath("/creators");
  revalidatePath(`/creators/${creatorId}`);

  for (const campaignId of await listCampaignIdsForCreator(creatorId, client)) {
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath(`/campaigns/${campaignId}/report`);
  }
}

/**
 * An embedded to-one relation is typed as an array when Supabase cannot infer
 * cardinality from a projected column list.
 */
function firstEmbedded<T>(value: unknown): T | null {
  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }

  return (value as T | null) ?? null;
}

function createCreatorSyncPort(supabase: SupabaseClient): CreatorSyncPort {
  return {
    async loadCreator(creatorId): Promise<CreatorSyncRecord | null> {
      const { data, error } = await supabase
        .from("creators")
        .select(
          "id, platform, username, display_name, avatar_url, profile_url, follower_count, category, category_source"
        )
        .eq("id", creatorId)
        .maybeSingle();

      if (error) {
        throw new Error(mapSupabaseMutationError(error.message, error.code));
      }

      if (!data) {
        return null;
      }

      const categorySource =
        data.category_source === "manual" ? "manual" : "auto";

      return {
        id: data.id as string,
        platform: data.platform as string,
        username: data.username as string,
        displayName: (data.display_name as string | null) ?? null,
        avatarUrl: (data.avatar_url as string | null) ?? null,
        profileUrl: (data.profile_url as string | null) ?? null,
        followerCount: Number(data.follower_count),
        category: (data.category as CreatorSyncRecord["category"]) ?? null,
        categorySource,
      };
    },

    async createJob(creatorId, startedAt) {
      const { data, error } = await supabase
        .from("sync_jobs")
        .insert({
          creator_id: creatorId,
          job_type: "tiktok_creator_sync",
          status: "running",
          started_at: startedAt,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(mapSupabaseMutationError(error?.message ?? "", error?.code));
      }

      return data.id as string;
    },

    async getLatestSnapshot(creatorId) {
      const { data, error } = await supabase
        .from("creator_metric_snapshots")
        .select("*")
        .eq("creator_id", creatorId)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(mapSupabaseMutationError(error.message, error.code));
      }

      if (!data) {
        return null;
      }

      const row = data as CreatorMetricSnapshot;

      return {
        ...row,
        follower_count: Number(row.follower_count),
        following_count:
          row.following_count === null ? null : Number(row.following_count),
        total_likes: row.total_likes === null ? null : Number(row.total_likes),
        video_count: row.video_count === null ? null : Number(row.video_count),
      };
    },

    async insertSnapshot(creatorId, snapshot) {
      const result = await insertSnapshotWithRetry(supabase, creatorId, snapshot);

      if (!result.ok) {
        throw new Error(result.message);
      }
    },

    async updateCreator(creatorId, patch: CreatorSyncPatch) {
      const { error } = await supabase
        .from("creators")
        .update(patch)
        .eq("id", creatorId);

      if (error) {
        throw new Error(mapSupabaseMutationError(error.message, error.code));
      }
    },

    async markCreatorFailed(creatorId) {
      await supabase
        .from("creators")
        .update({ sync_status: "failed" })
        .eq("id", creatorId);
    },

    async completeJob(jobId, status, completedAt, errorMessage) {
      await supabase
        .from("sync_jobs")
        .update({ status, completed_at: completedAt, error_message: errorMessage })
        .eq("id", jobId);
    },

    async revalidate(creatorId) {
      await revalidateCreatorPaths(creatorId, supabase);
    },
  };
}

/**
 * Inserts a snapshot, retrying once with a one-second offset.
 * `unique (creator_id, captured_at)` can collide when two writes land inside the
 * same clock tick.
 */
async function insertSnapshotWithRetry(
  supabase: SupabaseClient,
  creatorId: string,
  snapshot: CreatorSnapshotCandidate
): Promise<{ ok: true } | { ok: false; message: string }> {
  const attemptInsert = (capturedAt: string) =>
    supabase.from("creator_metric_snapshots").insert({
      creator_id: creatorId,
      captured_at: capturedAt,
      follower_count: snapshot.followerCount,
      following_count: snapshot.followingCount,
      total_likes: snapshot.totalLikes,
      video_count: snapshot.videoCount,
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

/**
 * Refreshes one TikTok creator profile.
 *
 * Failure never destroys data: the previous follower count, display name and
 * avatar stay untouched and only `sync_status` becomes `failed`. Snapshots are
 * append-only and are never rewritten or removed by a sync.
 */
export async function syncTikTokCreator(
  creatorId: string,
  provider?: TikTokCreatorProvider,
  options?: SyncCreatorOptions
): Promise<SyncCreatorResult> {
  const supabase = await resolveClient(options);

  let creatorProvider: TikTokCreatorProvider;

  try {
    creatorProvider = resolveProvider(provider);
  } catch (error) {
    return {
      outcome: "failed",
      message:
        error instanceof TikTokProviderError
          ? error.toUserMessage()
          : "TikTok senkronizasyonu yapılandırılmamış.",
      snapshotCreated: false,
      followerCount: null,
      jobId: null,
    };
  }

  try {
    return await runCreatorSync(
      creatorId,
      creatorProvider,
      createCreatorSyncPort(supabase)
    );
  } catch (error) {
    // Reaching here means a port failed before a job row existed, so there is no
    // job to mark failed and no creator state to roll back.
    return {
      outcome: "failed",
      message:
        error instanceof Error ? error.message : "Senkronizasyon kaydedilemedi.",
      snapshotCreated: false,
      followerCount: null,
      jobId: null,
    };
  }
}

/**
 * Refreshes every TikTok creator assigned to a campaign, two at a time.
 * Deduplicates creator ids and keeps going after an individual failure.
 */
export async function syncCampaignTikTokCreators(
  campaignId: string,
  provider?: TikTokCreatorProvider,
  options?: SyncCreatorOptions
): Promise<SyncCampaignCreatorsResult> {
  if (!UUID_PATTERN.test(campaignId)) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      message: "Geçersiz kampanya kimliği.",
    };
  }

  const supabase = await resolveClient(options);

  const port: CampaignCreatorSyncPort = {
    async campaignExists(id) {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new Error(mapSupabaseMutationError(error.message, error.code));
      }

      return data !== null;
    },

    async listAssignedCreators(id) {
      const { data, error } = await supabase
        .from("campaign_creators")
        .select("creator:creators (id, platform)")
        .eq("campaign_id", id);

      if (error) {
        throw new Error(mapSupabaseMutationError(error.message, error.code));
      }

      const creators: Array<{ id: string; platform: string }> = [];

      for (const row of data ?? []) {
        const creator = firstEmbedded<{ id: string; platform: string }>(
          row.creator
        );

        if (creator) {
          creators.push(creator);
        }
      }

      return creators;
    },

    syncCreator: (creatorId) =>
      syncTikTokCreator(creatorId, provider, { client: supabase }),

    async revalidate(id) {
      revalidatePath(`/campaigns/${id}`);
      revalidatePath(`/campaigns/${id}/report`);
      revalidatePath("/creators");
    },
  };

  try {
    return await runCampaignCreatorSync(campaignId, port);
  } catch (error) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      message:
        error instanceof Error ? error.message : "Senkronizasyon kaydedilemedi.",
    };
  }
}
